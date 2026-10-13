/**
 * pdf.js del lado del cliente: carga perezosa (no puede importarse en el
 * servidor), apertura de documentos y un renderizador de páginas con caché.
 *
 * El worker y sus recursos se sirven desde public/pdfjs/<versión>/ (los copia
 * scripts/copy-pdfjs-assets.mjs en el postinstall).
 */
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'

type Pdfjs = typeof import('pdfjs-dist')

let pdfjsPromise: Promise<Pdfjs> | null = null

export function loadPdfjs(): Promise<Pdfjs> {
    if (!pdfjsPromise) {
        pdfjsPromise = import('pdfjs-dist').then(pdfjs => {
            pdfjs.GlobalWorkerOptions.workerSrc = `/pdfjs/${pdfjs.version}/pdf.worker.min.mjs`
            return pdfjs
        })
        // Si falla (sin conexión, chunk viejo), el próximo intento vuelve a probar.
        pdfjsPromise.catch(() => { pdfjsPromise = null })
    }
    return pdfjsPromise
}

export async function openPdf(data: Uint8Array): Promise<PDFDocumentProxy> {
    const pdfjs = await loadPdfjs()
    const base = `/pdfjs/${pdfjs.version}/`
    try {
        return await pdfjs.getDocument({
            data,
            cMapUrl: `${base}cmaps/`,
            standardFontDataUrl: `${base}standard_fonts/`,
            wasmUrl: `${base}wasm/`,
            iccUrl: `${base}iccs/`
        }).promise
    } catch (e: any) {
        if (e?.name === 'PasswordException') throw new Error('El PDF está protegido con contraseña y no lo puedo abrir.')
        if (e?.name === 'InvalidPDFException') throw new Error('El archivo no es un PDF válido o está dañado.')
        throw e
    }
}

/** Título y autor que trae el PDF, descartando los que pone Word y compañía. */
export async function readPdfInfo(doc: PDFDocumentProxy): Promise<{ title: string | null; author: string | null }> {
    try {
        const { info } = await doc.getMetadata() as { info: Record<string, any> }
        const clean = (v: unknown) => {
            if (typeof v !== 'string') return null
            const s = v.replace(/\s+/g, ' ').trim()
            if (s.length < 2 || /^(microsoft|untitled|sin t[ií]tulo|unknown|desconocido)/i.test(s) || /\.(docx?|pdf|indd|tex)$/i.test(s)) return null
            return s
        }
        return { title: clean(info?.Title), author: clean(info?.Author) }
    } catch {
        return { title: null, author: null }
    }
}

/** Tapa en miniatura (JPEG en data URL) a partir de la primera página. */
export async function renderCover(doc: PDFDocumentProxy, width = 240): Promise<string | null> {
    try {
        const page = await doc.getPage(1)
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: width / base.width })
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(viewport.width)
        canvas.height = Math.round(viewport.height)
        await page.render({ canvas, viewport }).promise
        return canvas.toDataURL('image/jpeg', 0.72)
    } catch {
        return null
    }
}

export interface OutlineEntry {
    title: string
    depth: number
    dest: string | any[] | null
}

/** Índice del libro aplanado (con profundidad) para mostrarlo como lista. */
export async function readOutline(doc: PDFDocumentProxy): Promise<OutlineEntry[]> {
    const outline = await doc.getOutline().catch(() => null)
    if (!outline) return []
    const out: OutlineEntry[] = []
    const walk = (items: any[], depth: number) => {
        for (const item of items) {
            out.push({ title: (item.title || '').trim() || '—', depth, dest: item.dest })
            if (item.items?.length && depth < 3) walk(item.items, depth + 1)
        }
    }
    walk(outline, 0)
    return out
}

/** Número de página (1-based) al que apunta una entrada del índice. */
export async function resolveDest(doc: PDFDocumentProxy, dest: string | any[] | null): Promise<number | null> {
    try {
        const explicit = typeof dest === 'string' ? await doc.getDestination(dest) : dest
        if (!explicit || !explicit.length) return null
        const ref = explicit[0]
        if (typeof ref === 'number') return ref + 1
        return (await doc.getPageIndex(ref)) + 1
    } catch {
        return null
    }
}

// ─────────────────────────────────────────────────────────────
// Renderizado
// ─────────────────────────────────────────────────────────────

/** Tamaño de la página en puntos (escala 1, ya rotada). */
export interface PageSize { w: number; h: number }

/** Recorte normalizado (0..1) de la zona con contenido. */
export interface Crop { x0: number; y0: number; x1: number; y1: number }

export const FULL_CROP: Crop = { x0: 0, y0: 0, x1: 1, y1: 1 }

// Tope de píxeles por canvas: Safari en iOS no dibuja canvas de más de ~16 Mpx
// y en el celu cada página cacheada ocupa memoria de verdad.
const MAX_CANVAS_PIXELS = 10_000_000

export class PageRenderer {
    private sizes = new Map<number, Promise<PageSize>>()
    private crops = new Map<number, Promise<Crop>>()
    private cache = new Map<string, HTMLCanvasElement>()
    private inflight = new Map<string, { promise: Promise<HTMLCanvasElement>; task: RenderTask | null; cancelled: boolean }>()

    constructor(readonly doc: PDFDocumentProxy, private maxCached = 6) {}

    get numPages() {
        return this.doc.numPages
    }

    size(n: number): Promise<PageSize> {
        let p = this.sizes.get(n)
        if (!p) {
            p = this.doc.getPage(n).then(page => {
                const vp = page.getViewport({ scale: 1 })
                return { w: vp.width, h: vp.height }
            })
            this.sizes.set(n, p)
        }
        return p
    }

    /**
     * Detecta los márgenes en blanco con un render chiquito de la página.
     * Nunca recorta a menos del 60% del ancho/alto, para que una página con
     * solo un título no termine ampliada de forma ridícula.
     */
    crop(n: number): Promise<Crop> {
        let p = this.crops.get(n)
        if (!p) {
            p = this.detectCrop(n).catch(() => FULL_CROP)
            this.crops.set(n, p)
        }
        return p
    }

    private async detectCrop(n: number): Promise<Crop> {
        const page = await this.doc.getPage(n)
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: 320 / base.width })
        const canvas = document.createElement('canvas')
        const W = (canvas.width = Math.max(1, Math.round(viewport.width)))
        const H = (canvas.height = Math.max(1, Math.round(viewport.height)))
        await page.render({ canvas, viewport }).promise
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return FULL_CROP
        const { data } = ctx.getImageData(0, 0, W, H)

        const rows = new Uint32Array(H)
        const cols = new Uint32Array(W)
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const i = (y * W + x) * 4
                const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
                // Umbral alto: a esta resolución la letra fina sale gris clarito, no negra.
                if (lum < 235) { rows[y]++; cols[x]++ }
            }
        }
        // Una fila/columna cuenta como contenido si tiene algo más que una mota suelta.
        const first = (arr: Uint32Array, min: number) => arr.findIndex(v => v >= min)
        const last = (arr: Uint32Array, min: number) => {
            for (let i = arr.length - 1; i >= 0; i--) if (arr[i] >= min) return i
            return -1
        }
        const y0 = first(rows, 2), y1 = last(rows, 2)
        const x0 = first(cols, 2), x1 = last(cols, 2)
        if (y0 < 0 || x0 < 0) return FULL_CROP

        const pad = 0.03
        let c: Crop = {
            x0: Math.max(0, x0 / W - pad),
            x1: Math.min(1, (x1 + 1) / W + pad),
            y0: Math.max(0, y0 / H - pad),
            y1: Math.min(1, (y1 + 1) / H + pad)
        }
        const expand = (a: number, b: number): [number, number] => {
            const min = 0.6
            if (b - a >= min) return [a, b]
            const mid = (a + b) / 2
            let lo = mid - min / 2, hi = mid + min / 2
            if (lo < 0) { hi -= lo; lo = 0 }
            if (hi > 1) { lo -= hi - 1; hi = 1 }
            return [Math.max(0, lo), Math.min(1, hi)]
        }
        ;[c.x0, c.x1] = expand(c.x0, c.x1)
        ;[c.y0, c.y1] = expand(c.y0, c.y1)
        // Si casi no hay margen que sacar, no vale la pena que la página "salte".
        if (c.x0 < 0.02 && c.y0 < 0.02 && c.x1 > 0.98 && c.y1 > 0.98) c = FULL_CROP
        return c
    }

    private key(n: number, scale: number, crop: Crop) {
        return `${n}|${scale.toFixed(4)}|${crop.x0.toFixed(3)},${crop.y0.toFixed(3)},${crop.x1.toFixed(3)},${crop.y1.toFixed(3)}`
    }

    /** Página n a `scale` píxeles por punto, recortada a `crop`. Cacheada. */
    render(n: number, scale: number, crop: Crop = FULL_CROP): Promise<HTMLCanvasElement> {
        const key = this.key(n, scale, crop)
        const cached = this.cache.get(key)
        if (cached) {
            // LRU: se reinserta al final
            this.cache.delete(key)
            this.cache.set(key, cached)
            return Promise.resolve(cached)
        }
        const running = this.inflight.get(key)
        if (running && !running.cancelled) return running.promise

        const entry = { promise: null as any as Promise<HTMLCanvasElement>, task: null as RenderTask | null, cancelled: false }
        entry.promise = (async () => {
            const page = await this.doc.getPage(n)
            if (entry.cancelled) throw new Error('cancelled')
            let s = scale
            const base = page.getViewport({ scale: 1 })
            const area = base.width * (crop.x1 - crop.x0) * base.height * (crop.y1 - crop.y0)
            if (area * s * s > MAX_CANVAS_PIXELS) s = Math.sqrt(MAX_CANVAS_PIXELS / area)
            const viewport = page.getViewport({ scale: s })

            const canvas = document.createElement('canvas')
            canvas.width = Math.max(1, Math.floor(viewport.width * (crop.x1 - crop.x0)))
            canvas.height = Math.max(1, Math.floor(viewport.height * (crop.y1 - crop.y0)))
            const isFull = crop.x0 === 0 && crop.y0 === 0
            entry.task = page.render({
                canvas,
                viewport,
                transform: isFull ? undefined : [1, 0, 0, 1, -crop.x0 * viewport.width, -crop.y0 * viewport.height]
            })
            await entry.task.promise
            return canvas
        })()

        this.inflight.set(key, entry)
        entry.promise.then(
            canvas => {
                if (this.inflight.get(key) === entry) this.inflight.delete(key)
                this.cache.set(key, canvas)
                while (this.cache.size > this.maxCached) {
                    const oldest = this.cache.keys().next().value as string
                    this.cache.delete(oldest)
                }
            },
            () => { if (this.inflight.get(key) === entry) this.inflight.delete(key) }
        )
        return entry.promise
    }

    /** Cancela los renders en curso de páginas que ya no interesan (pasé de página rápido). */
    cancelExcept(pages: number[]) {
        const keep = new Set(pages)
        for (const [key, entry] of this.inflight) {
            const n = Number(key.split('|')[0])
            if (!keep.has(n)) {
                entry.cancelled = true
                entry.task?.cancel()
            }
        }
    }

    clearCache() {
        this.cache.clear()
    }

    destroy() {
        this.cancelExcept([])
        this.cache.clear()
        this.doc.loadingTask.destroy()
    }
}
