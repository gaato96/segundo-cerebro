'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
    ArrowLeft, ListTree, Type, Maximize, Minimize, CheckCircle2, ChevronLeft, ChevronRight,
    Loader2, X, RefreshCw, ZoomIn, ZoomOut, Columns2, Crop as CropIcon, MoveHorizontal,
    RectangleVertical, SunDim, BookOpen
} from 'lucide-react'
import {
    type BookItem, saveReadingProgress, getReadingProgress, finishBook
} from '@/lib/actions/books'
import {
    PageRenderer, FULL_CROP, openPdf, readOutline, resolveDest,
    type Crop, type OutlineEntry
} from '@/lib/reader/pdf'
import { getLocalBook, saveLocalBook, deleteLocalBook, downloadBookPdf, formatBytes } from '@/lib/reader/files'
import { RatingModal } from '@/components/media/RatingModal'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// Apariencia
// ─────────────────────────────────────────────────────────────

type ThemeId = 'day' | 'sepia' | 'night'

interface ReaderTheme {
    label: string
    /** Fondo alrededor de la página: igual al color final del papel, así no se ven bordes. */
    bg: string
    /** Sepia: el blanco se multiplica por el color papel y el negro se aclara al color tinta. */
    paper?: string
    ink?: string
    /** Noche: se invierte la página (el texto queda claro sobre gris oscuro). */
    filter?: string
    swatch: string
    swatchText: string
    chrome: string
    chromeMuted: string
    divider: string
    accent: string
}

const THEMES: Record<ThemeId, ReaderTheme> = {
    day: {
        label: 'Día',
        bg: '#ffffff',
        swatch: '#ffffff',
        swatchText: '#1f2937',
        chrome: 'bg-white/95 text-neutral-800 border-black/10',
        chromeMuted: 'text-neutral-500',
        divider: 'border-black/10',
        accent: '#4f46e5'
    },
    sepia: {
        label: 'Sepia',
        bg: '#f8f1e0',
        paper: '#f4ecd8',
        ink: '#5b4636',
        swatch: '#f4ecd8',
        swatchText: '#5b4636',
        chrome: 'bg-[#efe3c8]/95 text-[#4a3a2c] border-[#5b4636]/15',
        chromeMuted: 'text-[#7a6650]',
        divider: 'border-[#5b4636]/20',
        accent: '#b45309'
    },
    night: {
        label: 'Noche',
        bg: '#1f1f1f',
        filter: 'invert(0.88) hue-rotate(180deg)',
        swatch: '#1f1f1f',
        swatchText: '#d4d4d4',
        chrome: 'bg-[#161616]/95 text-neutral-200 border-white/10',
        chromeMuted: 'text-neutral-400',
        divider: 'border-white/10',
        accent: '#f59e0b'
    }
}

interface Prefs {
    theme: ThemeId
    /** 0 = brillo normal, 0.7 = muy atenuado */
    dim: number
    fit: 'page' | 'width'
    zoom: number
    spread: boolean
    crop: boolean
}

const ZOOM_MIN = 1
const ZOOM_MAX = 4

const PREFS_KEY = 'reader:prefs'
const posKey = (id: string) => `reader:pos:${id}`

function defaultPrefs(): Prefs {
    const narrow = typeof window !== 'undefined' && window.innerWidth < 768
    // En el celu recortar márgenes hace la letra bastante más grande.
    return { theme: 'sepia', dim: 0, fit: 'page', zoom: 1, spread: true, crop: narrow }
}

function loadPrefs(): Prefs {
    try {
        const raw = localStorage.getItem(PREFS_KEY)
        if (raw) return { ...defaultPrefs(), ...JSON.parse(raw) }
    } catch { /* storage bloqueado */ }
    return defaultPrefs()
}

interface LocalPos { page: number; synced: boolean }

function readLocalPos(id: string): LocalPos | null {
    try {
        const raw = localStorage.getItem(posKey(id))
        return raw ? JSON.parse(raw) : null
    } catch {
        return null
    }
}

function writeLocalPos(id: string, pos: LocalPos) {
    try { localStorage.setItem(posKey(id), JSON.stringify(pos)) } catch { /* sin storage */ }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const isCancel = (e: any) => e?.name === 'RenderingCancelledException' || e?.message === 'cancelled'

// ─────────────────────────────────────────────────────────────
// Tipos de render
// ─────────────────────────────────────────────────────────────

interface SlotSpec {
    n: number
    crop: Crop
    cssW: number
    cssH: number
    devScale: number
}

interface Frame {
    key: string
    slots: (SlotSpec & { canvas: HTMLCanvasElement })[]
}

type LoadState =
    | { kind: 'opening' }
    | { kind: 'downloading'; fraction: number }
    | { kind: 'ready' }
    | { kind: 'error'; message: string }

// ─────────────────────────────────────────────────────────────

export function BookReader({ book }: { book: BookItem }) {
    const router = useRouter()
    const rootRef = useRef<HTMLDivElement>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const pagesRef = useRef<HTMLDivElement>(null)
    const rendererRef = useRef<PageRenderer | null>(null)

    const [load, setLoad] = useState<LoadState>({ kind: 'opening' })
    const [reloadKey, setReloadKey] = useState(0)
    const [numPages, setNumPages] = useState(0)
    const [page, setPage] = useState(book.current_page)
    const [prefs, setPrefs] = useState<Prefs | null>(null)
    const [size, setSize] = useState({ w: 0, h: 0 })
    const [frame, setFrame] = useState<Frame | null>(null)
    const [slowRender, setSlowRender] = useState(false)
    const [overflow, setOverflow] = useState({ x: false, y: false })

    const [uiVisible, setUiVisible] = useState(true)
    const [panel, setPanel] = useState<null | 'settings' | 'outline'>(null)
    const [outline, setOutline] = useState<OutlineEntry[] | null>(null)
    const [sliderValue, setSliderValue] = useState<number | null>(null)
    const [gotoOpen, setGotoOpen] = useState(false)
    const [gotoValue, setGotoValue] = useState('')
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [canFullscreen, setCanFullscreen] = useState(false)
    const [remotePage, setRemotePage] = useState<number | null>(null)
    const [finishDismissed, setFinishDismissed] = useState(false)
    const [finishing, setFinishing] = useState(false)

    const theme = THEMES[prefs?.theme || 'sepia']

    // ── Preferencias (por dispositivo) ──────────────────────────
    useEffect(() => {
        setPrefs(loadPrefs())
        setCanFullscreen(!!document.fullscreenEnabled)
    }, [])

    const updatePrefs = useCallback((patch: Partial<Prefs>) => {
        setPrefs(prev => {
            const next = { ...(prev || defaultPrefs()), ...patch }
            try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)) } catch { /* sin storage */ }
            return next
        })
    }, [])

    // ── Tamaño disponible ───────────────────────────────────────
    useEffect(() => {
        const el = rootRef.current
        if (!el) return
        let t: ReturnType<typeof setTimeout> | undefined
        const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
        measure()
        const ro = new ResizeObserver(() => {
            clearTimeout(t)
            t = setTimeout(measure, 120)
        })
        ro.observe(el)
        return () => { ro.disconnect(); clearTimeout(t) }
    }, [])

    // ── Color de la barra de estado del celu ────────────────────
    useEffect(() => {
        const meta = document.querySelector('meta[name="theme-color"]')
        if (!meta) return
        const previous = meta.getAttribute('content')
        meta.setAttribute('content', theme.bg)
        return () => { if (previous) meta.setAttribute('content', previous) }
    }, [theme.bg])

    // ── Descargar (o tomar la copia local) y abrir el PDF ───────
    useEffect(() => {
        let cancelled = false
        let renderer: PageRenderer | null = null
        const path = book.file_path!

        ;(async () => {
            try {
                setLoad({ kind: 'opening' })
                let blob = await getLocalBook(book.id, path)
                if (!blob) {
                    setLoad({ kind: 'downloading', fraction: 0 })
                    blob = await downloadBookPdf(path, f => { if (!cancelled) setLoad({ kind: 'downloading', fraction: f }) })
                    if (cancelled) return
                    saveLocalBook(book.id, path, blob)
                    setLoad({ kind: 'opening' })
                }
                const doc = await openPdf(new Uint8Array(await blob.arrayBuffer()))
                if (cancelled) { doc.loadingTask.destroy(); return }

                renderer = new PageRenderer(doc)
                rendererRef.current = renderer
                setNumPages(doc.numPages)

                // Si en este dispositivo se leyó sin conexión y no llegó a guardarse,
                // manda lo local; si no, la página del servidor (la de cualquier dispositivo).
                const local = readLocalPos(book.id)
                const start = local && !local.synced ? local.page : book.current_page
                setPage(clamp(start, 1, doc.numPages))
                setLoad({ kind: 'ready' })
            } catch (e: any) {
                if (!cancelled) setLoad({ kind: 'error', message: e?.message || 'No pude abrir el libro.' })
            }
        })()

        return () => {
            cancelled = true
            renderer?.destroy()
            if (rendererRef.current === renderer) rendererRef.current = null
        }
    }, [book.id, book.file_path, book.current_page, reloadKey])

    // ── Qué páginas se ven ──────────────────────────────────────
    const spreadActive = !!prefs && prefs.spread && prefs.fit === 'page' && prefs.zoom === 1
        && size.w >= 900 && size.w > size.h * 1.1 && numPages > 2

    const pagesAt = useCallback((p: number): number[] => {
        if (!numPages) return []
        const n = clamp(p, 1, numPages)
        // A doble página la tapa va sola y después 2-3, 4-5… como un libro abierto.
        if (!spreadActive || n === 1) return [n]
        const start = n % 2 === 0 ? n : n - 1
        return start + 1 <= numPages ? [start, start + 1] : [start]
    }, [numPages, spreadActive])

    const displayed = useMemo(() => pagesAt(page), [pagesAt, page])
    const displayedKey = displayed.join('-')

    const pageRef = useRef(page)
    pageRef.current = page
    const scrollTarget = useRef<'top' | 'bottom'>('top')

    const goTo = useCallback((p: number, opts?: { toBottom?: boolean }) => {
        if (!numPages) return
        scrollTarget.current = opts?.toBottom ? 'bottom' : 'top'
        setPage(clamp(Math.round(p), 1, numPages))
    }, [numPages])

    const next = useCallback(() => {
        const last = displayed[displayed.length - 1]
        if (last < numPages) goTo(last + 1)
    }, [displayed, numPages, goTo])

    const prev = useCallback((opts?: { toBottom?: boolean }) => {
        const first = displayed[0]
        if (first > 1) goTo(pagesAt(first - 1)[0], opts)
    }, [displayed, goTo, pagesAt])

    // ── Render de las páginas visibles (+ precarga de las vecinas) ──
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2.5) : 1

    useEffect(() => {
        const r = rendererRef.current
        if (load.kind !== 'ready' || !r || !prefs || !size.w || !displayed.length) return

        const narrow = size.w < 640
        const margin = narrow ? (prefs.crop ? 6 : 0) : 20
        const availW = Math.max(100, size.w - margin * 2)
        const availH = Math.max(100, size.h - margin * 2)

        const computeSpec = async (pages: number[]): Promise<SlotSpec[]> => {
            let crops = await Promise.all(pages.map(n => prefs.crop ? r.crop(n) : Promise.resolve(FULL_CROP)))
            // A doble página las dos hojas se recortan igual, si no quedan de distinto alto.
            if (crops.length === 2) {
                const [a, b] = crops
                const merged = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }
                crops = [merged, merged]
            }
            const boxes = await Promise.all(pages.map(async (n, i) => {
                const s = await r.size(n)
                const crop = crops[i]
                return { n, crop, w: s.w * (crop.x1 - crop.x0), h: s.h * (crop.y1 - crop.y0) }
            }))
            const totalW = boxes.reduce((sum, b) => sum + b.w, 0)
            const maxH = Math.max(...boxes.map(b => b.h))
            let scale = prefs.fit === 'width'
                ? Math.min(availW, 1100) / totalW // en la compu, "ancho" no estira a 1900 px
                : Math.min(availW / totalW, availH / maxH)
            scale *= prefs.zoom
            return boxes.map(b => ({
                n: b.n,
                crop: b.crop,
                cssW: Math.floor(b.w * scale),
                cssH: Math.floor(b.h * scale),
                devScale: scale * dpr
            }))
        }

        const last = displayed[displayed.length - 1]
        const neighbors = [
            last < numPages ? pagesAt(last + 1) : [],
            displayed[0] > 1 ? pagesAt(displayed[0] - 1) : []
        ].filter(p => p.length)

        r.cancelExcept([...displayed, ...neighbors.flat()])

        let stale = false
        const slowTimer = setTimeout(() => setSlowRender(true), 250)

        ;(async () => {
            try {
                const spec = await computeSpec(displayed)
                const canvases = await Promise.all(spec.map(s => r.render(s.n, s.devScale, s.crop)))
                if (stale) return
                setFrame({ key: displayedKey, slots: spec.map((s, i) => ({ ...s, canvas: canvases[i] })) })

                // Precarga: pasar de página tiene que ser instantáneo.
                for (const pages of neighbors) {
                    computeSpec(pages)
                        .then(specs => specs.forEach(s => r.render(s.n, s.devScale, s.crop).catch(() => null)))
                        .catch(() => null)
                }
            } catch (e) {
                if (!stale && !isCancel(e)) console.error('[lector] error renderizando', e)
            } finally {
                clearTimeout(slowTimer)
                if (!stale) setSlowRender(false)
            }
        })()

        return () => { stale = true; clearTimeout(slowTimer) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load.kind, displayedKey, size.w, size.h, prefs?.fit, prefs?.zoom, prefs?.crop, spreadActive, numPages, dpr])

    // Al cambiar de página: scroll arriba (o abajo si se volvió con la rueda) y fuera el zoom del pellizco.
    const lastFrameKey = useRef('')
    useLayoutEffect(() => {
        if (!frame) return
        const el = scrollRef.current
        if (pagesRef.current) pagesRef.current.style.transform = ''
        if (el) {
            if (frame.key !== lastFrameKey.current) {
                el.scrollTop = scrollTarget.current === 'bottom' ? el.scrollHeight : 0
                scrollTarget.current = 'top'
            }
            setOverflow({ x: el.scrollWidth > el.clientWidth + 1, y: el.scrollHeight > el.clientHeight + 1 })
        }
        lastFrameKey.current = frame.key
    }, [frame])

    // ── Guardar dónde quedé ─────────────────────────────────────
    const pendingPage = useRef<number | null>(null)
    const lastSavedPage = useRef(book.current_page)
    const lastServerStamp = useRef(new Date(book.progress_updated_at).getTime())
    const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const saving = useRef(false)

    const flush = useCallback(async () => {
        clearTimeout(saveTimer.current)
        const p = pendingPage.current
        if (p == null || saving.current) return
        pendingPage.current = null
        if (p === lastSavedPage.current) {
            writeLocalPos(book.id, { page: p, synced: true })
            return
        }
        saving.current = true
        try {
            const res = await saveReadingProgress(book.id, p)
            if (res.ok) {
                lastSavedPage.current = p
                lastServerStamp.current = new Date(res.data.progress_updated_at).getTime()
                if (pendingPage.current == null) writeLocalPos(book.id, { page: p, synced: true })
            } else if (pendingPage.current == null) {
                // Queda marcada como no sincronizada: se reintenta en el próximo cambio o al volver.
                pendingPage.current = p
            }
        } catch {
            if (pendingPage.current == null) pendingPage.current = p
        } finally {
            saving.current = false
        }
        // Si se pasó de página mientras se guardaba, se guarda también esa.
        if (pendingPage.current != null && pendingPage.current !== p) flush()
    }, [book.id])

    useEffect(() => {
        if (load.kind !== 'ready') return
        if (page === lastSavedPage.current && pendingPage.current == null) return
        pendingPage.current = page
        writeLocalPos(book.id, { page, synced: false })
        clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(flush, 1500)
    }, [page, load.kind, book.id, flush])

    // ¿Avancé en otro dispositivo mientras esta pestaña estaba en segundo plano?
    const lastRemoteCheck = useRef(0)
    const checkRemote = useCallback(async () => {
        if (pendingPage.current != null || Date.now() - lastRemoteCheck.current < 5000) return
        lastRemoteCheck.current = Date.now()
        const res = await getReadingProgress(book.id).catch(() => null)
        if (!res?.ok) return
        const stamp = new Date(res.data.progress_updated_at).getTime()
        if (stamp > lastServerStamp.current) {
            lastServerStamp.current = stamp
            lastSavedPage.current = res.data.current_page
            if (res.data.current_page !== pageRef.current) setRemotePage(res.data.current_page)
        }
    }, [book.id])

    useEffect(() => {
        const onVisibility = () => {
            if (document.visibilityState === 'hidden') flush()
            else checkRemote()
        }
        const onHide = () => { flush() }
        document.addEventListener('visibilitychange', onVisibility)
        window.addEventListener('pagehide', onHide)
        window.addEventListener('focus', checkRemote)
        return () => {
            document.removeEventListener('visibilitychange', onVisibility)
            window.removeEventListener('pagehide', onHide)
            window.removeEventListener('focus', checkRemote)
            flush()
        }
    }, [flush, checkRemote])

    // ── Pantalla completa ───────────────────────────────────────
    useEffect(() => {
        const onChange = () => setIsFullscreen(!!document.fullscreenElement)
        document.addEventListener('fullscreenchange', onChange)
        return () => document.removeEventListener('fullscreenchange', onChange)
    }, [])

    const toggleFullscreen = useCallback(() => {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => null)
        else rootRef.current?.requestFullscreen({ navigationUI: 'hide' }).catch(() => null)
    }, [])

    // ── Zoom ────────────────────────────────────────────────────
    const zoomTo = useCallback((z: number) => {
        updatePrefs({ zoom: Math.round(clamp(z, ZOOM_MIN, ZOOM_MAX) * 100) / 100 })
    }, [updatePrefs])
    const zoom = prefs?.zoom ?? 1

    // ── Teclado y rueda ─────────────────────────────────────────
    const actions = useRef({ next, prev, goTo, toggleFullscreen, zoomTo, zoom, numPages, panel })
    actions.current = { next, prev, goTo, toggleFullscreen, zoomTo, zoom, numPages, panel }

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target
            if (target instanceof HTMLElement && target.closest('input, textarea, select')) return
            const a = actions.current
            const el = scrollRef.current
            const canScrollY = !!el && el.scrollHeight > el.clientHeight + 1
            switch (e.key) {
                case 'ArrowRight': case 'PageDown':
                    e.preventDefault(); a.next(); break
                case 'ArrowLeft': case 'PageUp':
                    e.preventDefault(); a.prev(); break
                case ' ':
                    e.preventDefault()
                    if (e.shiftKey) a.prev()
                    else a.next()
                    break
                case 'ArrowDown':
                    if (!canScrollY) { e.preventDefault(); a.next() }
                    break
                case 'ArrowUp':
                    if (!canScrollY) { e.preventDefault(); a.prev() }
                    break
                case 'Home': e.preventDefault(); a.goTo(1); break
                case 'End': e.preventDefault(); a.goTo(a.numPages); break
                case 'f': case 'F': a.toggleFullscreen(); break
                case '+': case '=': a.zoomTo(a.zoom + 0.25); break
                case '-': a.zoomTo(a.zoom - 0.25); break
                case '0': a.zoomTo(1); break
                case 'Escape':
                    if (a.panel) setPanel(null)
                    break
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return
        let lockUntil = 0
        let acc = 0
        const onWheel = (e: WheelEvent) => {
            const a = actions.current
            if (e.ctrlKey) {
                e.preventDefault()
                a.zoomTo(a.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1))
                return
            }
            const now = Date.now()
            if (now < lockUntil) return
            const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2
            const atTop = el.scrollTop <= 1
            // La rueda primero recorre la página; recién al llegar al borde la da vuelta.
            if ((e.deltaY > 0 && atBottom) || (e.deltaY < 0 && atTop)) {
                acc += e.deltaY
                if (Math.abs(acc) > 60) {
                    if (acc > 0) a.next()
                    else a.prev({ toBottom: true })
                    acc = 0
                    lockUntil = now + 450
                }
            } else {
                acc = 0
            }
        }
        el.addEventListener('wheel', onWheel, { passive: false })
        return () => el.removeEventListener('wheel', onWheel)
    }, [load.kind])

    // ── Toques, deslizar y pellizcar ────────────────────────────
    const gesture = useRef<{ x: number; y: number; t: number; multi: boolean } | null>(null)
    const activePointers = useRef(new Set<number>())
    const pinch = useRef<{ d0: number; ratio: number } | null>(null)

    const onPointerDown = (e: React.PointerEvent) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        // El primer dedo que apoya arranca de cero: si un puntero se soltó fuera
        // de la pantalla nunca llegó su pointerup y quedaría "colgado".
        if (e.isPrimary) activePointers.current.clear()
        activePointers.current.add(e.pointerId)
        if (activePointers.current.size > 1) {
            if (gesture.current) gesture.current.multi = true
            return
        }
        gesture.current = { x: e.clientX, y: e.clientY, t: Date.now(), multi: false }
    }

    const onPointerUp = (e: React.PointerEvent) => {
        activePointers.current.delete(e.pointerId)
        const g = gesture.current
        if (!g || activePointers.current.size > 0) return
        gesture.current = null
        if (g.multi) return

        const dx = e.clientX - g.x
        const dy = e.clientY - g.y
        const dt = Date.now() - g.t

        if (panel) {
            if (Math.abs(dx) < 10 && Math.abs(dy) < 10) setPanel(null)
            return
        }

        if (!overflow.x && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 800) {
            if (dx < 0) next()
            else prev()
            setUiVisible(false)
            return
        }

        if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 500) {
            const width = rootRef.current?.clientWidth || window.innerWidth
            const ratio = e.clientX / width
            if (ratio < 0.3) { prev(); setUiVisible(false) }
            else if (ratio > 0.7) { next(); setUiVisible(false) }
            else setUiVisible(v => !v)
        }
    }

    const onPointerCancel = (e: React.PointerEvent) => {
        activePointers.current.delete(e.pointerId)
        gesture.current = null
    }

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return
        const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
        const onStart = (e: TouchEvent) => {
            if (e.touches.length === 2) pinch.current = { d0: dist(e.touches), ratio: 1 }
        }
        const onMove = (e: TouchEvent) => {
            if (!pinch.current || e.touches.length !== 2) return
            e.preventDefault()
            const a = actions.current
            const target = clamp(a.zoom * (dist(e.touches) / pinch.current.d0), ZOOM_MIN, ZOOM_MAX)
            pinch.current.ratio = target / a.zoom
            if (pagesRef.current) pagesRef.current.style.transform = `scale(${pinch.current.ratio})`
        }
        const onEnd = (e: TouchEvent) => {
            if (!pinch.current || e.touches.length >= 2) return
            const { ratio } = pinch.current
            pinch.current = null
            const a = actions.current
            if (Math.abs(ratio - 1) < 0.04) {
                if (pagesRef.current) pagesRef.current.style.transform = ''
                return
            }
            // El transform se saca cuando llega el render nuevo, así no "rebota".
            a.zoomTo(a.zoom * ratio)
        }
        el.addEventListener('touchstart', onStart, { passive: true })
        el.addEventListener('touchmove', onMove, { passive: false })
        el.addEventListener('touchend', onEnd, { passive: true })
        el.addEventListener('touchcancel', onEnd, { passive: true })
        return () => {
            el.removeEventListener('touchstart', onStart)
            el.removeEventListener('touchmove', onMove)
            el.removeEventListener('touchend', onEnd)
            el.removeEventListener('touchcancel', onEnd)
        }
    }, [load.kind])

    // ── Índice ──────────────────────────────────────────────────
    async function openOutline() {
        setPanel(p => p === 'outline' ? null : 'outline')
        if (outline === null && rendererRef.current) {
            setOutline(await readOutline(rendererRef.current.doc).catch(() => []))
        }
    }

    async function jumpToOutline(entry: OutlineEntry) {
        const r = rendererRef.current
        if (!r) return
        const target = await resolveDest(r.doc, entry.dest)
        if (target) {
            goTo(target)
            setPanel(null)
        }
    }

    // ── Terminar el libro ───────────────────────────────────────
    const atEnd = numPages > 0 && displayed[displayed.length - 1] === numPages
    const showFinishPrompt = atEnd && book.status === 'reading' && !finishDismissed && load.kind === 'ready'

    async function handleFinish(rating: number) {
        await flush()
        const res = await finishBook(book.id, rating)
        if (!res.ok) throw new Error(res.error)
        writeLocalPos(book.id, { page: numPages, synced: true })
        router.push('/lectura?tab=leidos')
        router.refresh()
    }

    // ── Derivados para la UI ────────────────────────────────────
    const pct = numPages ? Math.round((displayed[displayed.length - 1] / numPages) * 100) : 0
    const pageLabel = displayed.length > 1 ? `${displayed[0]}–${displayed[1]}` : `${displayed[0] ?? page}`
    const touchAction = overflow.x ? 'pan-x pan-y' : 'pan-y'

    return (
        <div
            ref={rootRef}
            className="fixed inset-0 overflow-hidden select-none"
            style={{ background: theme.bg, overscrollBehavior: 'none' }}
        >
            {/* Páginas */}
            <div
                ref={scrollRef}
                className="absolute inset-0 overflow-auto no-scrollbar"
                style={{ touchAction, overscrollBehavior: 'contain' }}
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                onContextMenu={e => e.preventDefault()}
            >
                <div className="flex" style={{ minWidth: '100%', minHeight: '100%', width: 'max-content' }}>
                    <div
                        ref={pagesRef}
                        className="m-auto flex"
                        style={{ padding: size.w < 640 ? (prefs?.crop ? 6 : 0) : 20, transformOrigin: 'center center' }}
                    >
                        {frame?.slots.map(slot => (
                            <PageSlot key={slot.n} slot={slot} theme={theme} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Atenuar brillo (por encima de las páginas, por debajo de los menús) */}
            {!!prefs?.dim && (
                <div className="absolute inset-0 pointer-events-none bg-black" style={{ opacity: prefs.dim }} />
            )}

            {/* Cargando / descargando / error */}
            {load.kind !== 'ready' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center" style={{ color: theme.swatchText }}>
                    {load.kind === 'error' ? (
                        <>
                            <BookOpen className="w-10 h-10 opacity-60" />
                            <p className="max-w-sm text-sm">{load.message}</p>
                            <div className="flex gap-2">
                                <Link href="/lectura" className={cn('px-4 py-2 rounded-xl border text-sm', theme.chrome)}>
                                    Volver
                                </Link>
                                <button
                                    onClick={async () => { await deleteLocalBook(book.id); setReloadKey(k => k + 1) }}
                                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white flex items-center gap-2"
                                    style={{ background: theme.accent }}
                                >
                                    <RefreshCw className="w-4 h-4" /> Volver a descargar
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            {book.cover && <img src={book.cover} alt="" className="w-28 rounded-lg shadow-2xl" />}
                            <p className="font-heading font-semibold">{book.title}</p>
                            {load.kind === 'downloading' ? (
                                <div className="w-56 space-y-1.5">
                                    <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                                        <div className="h-full transition-[width]" style={{ width: `${Math.round(load.fraction * 100)}%`, background: theme.accent }} />
                                    </div>
                                    <p className="text-xs opacity-70">
                                        Descargando a este dispositivo… {Math.round(load.fraction * 100)}%
                                        {book.file_size ? ` de ${formatBytes(book.file_size)}` : ''}
                                    </p>
                                    <p className="text-[11px] opacity-50">Es una sola vez: después abre al instante.</p>
                                </div>
                            ) : (
                                <Loader2 className="w-6 h-6 animate-spin opacity-60" />
                            )}
                        </>
                    )}
                </div>
            )}

            {slowRender && load.kind === 'ready' && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: theme.accent }} />
                </div>
            )}

            {/* Indicador mínimo cuando el menú está oculto */}
            {!uiVisible && load.kind === 'ready' && numPages > 0 && (
                <div
                    className="absolute bottom-0 inset-x-0 flex justify-center pointer-events-none text-[11px] font-medium tabular-nums"
                    style={{ color: theme.swatchText, opacity: 0.45, paddingBottom: 'max(6px, env(safe-area-inset-bottom))' }}
                >
                    {pageLabel} / {numPages}
                </div>
            )}

            {/* Barra superior */}
            <AnimatePresence>
                {uiVisible && (
                    <motion.header
                        initial={{ y: -64, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -64, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className={cn('absolute top-0 inset-x-0 border-b backdrop-blur-md z-20', theme.chrome)}
                        style={{ paddingTop: 'env(safe-area-inset-top)' }}
                    >
                        <div className="flex items-center gap-1 px-2 h-14">
                            <Link href="/lectura" className="p-2.5 rounded-full hover:bg-black/5" aria-label="Volver a la biblioteca">
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <div className="flex-1 min-w-0 px-1">
                                <p className="text-sm font-semibold truncate leading-tight">{book.title}</p>
                                {book.author && <p className={cn('text-[11px] truncate', theme.chromeMuted)}>{book.author}</p>}
                            </div>
                            <ToolbarButton label="Índice" active={panel === 'outline'} onClick={openOutline}>
                                <ListTree className="w-5 h-5" />
                            </ToolbarButton>
                            <ToolbarButton label="Apariencia" active={panel === 'settings'} onClick={() => setPanel(p => p === 'settings' ? null : 'settings')}>
                                <Type className="w-5 h-5" />
                            </ToolbarButton>
                            {canFullscreen && (
                                <ToolbarButton label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'} onClick={toggleFullscreen}>
                                    {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                                </ToolbarButton>
                            )}
                            {book.status === 'reading' && (
                                <ToolbarButton label="Terminé el libro" onClick={() => setFinishing(true)}>
                                    <CheckCircle2 className="w-5 h-5" />
                                </ToolbarButton>
                            )}
                        </div>
                    </motion.header>
                )}
            </AnimatePresence>

            {/* Barra inferior */}
            <AnimatePresence>
                {uiVisible && numPages > 0 && (
                    <motion.footer
                        initial={{ y: 80, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 80, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className={cn('absolute bottom-0 inset-x-0 border-t backdrop-blur-md z-20', theme.chrome)}
                        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
                    >
                        <div className="flex items-center gap-2 px-3 pt-3">
                            <button onClick={() => prev()} disabled={displayed[0] <= 1} className="p-2 rounded-full hover:bg-black/5 disabled:opacity-30" aria-label="Página anterior">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <input
                                type="range"
                                min={1}
                                max={numPages}
                                value={sliderValue ?? displayed[0] ?? 1}
                                onChange={e => setSliderValue(Number(e.target.value))}
                                onPointerUp={() => { if (sliderValue != null) { goTo(sliderValue); setSliderValue(null) } }}
                                onKeyUp={() => { if (sliderValue != null) { goTo(sliderValue); setSliderValue(null) } }}
                                className="flex-1 h-1.5 cursor-pointer"
                                style={{ accentColor: theme.accent }}
                                aria-label="Ir a página"
                            />
                            <button onClick={() => next()} disabled={displayed[displayed.length - 1] >= numPages} className="p-2 rounded-full hover:bg-black/5 disabled:opacity-30" aria-label="Página siguiente">
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex items-center justify-center pb-2.5 pt-0.5 text-xs tabular-nums">
                            {gotoOpen ? (
                                <form
                                    onSubmit={e => {
                                        e.preventDefault()
                                        const v = parseInt(gotoValue, 10)
                                        if (!isNaN(v)) goTo(v)
                                        setGotoOpen(false)
                                    }}
                                    className="flex items-center gap-1.5"
                                >
                                    <span className={theme.chromeMuted}>Ir a la pág</span>
                                    <input
                                        autoFocus
                                        inputMode="numeric"
                                        value={gotoValue}
                                        onChange={e => setGotoValue(e.target.value.replace(/\D/g, ''))}
                                        onBlur={() => setGotoOpen(false)}
                                        className={cn('w-14 px-2 py-0.5 rounded-md bg-black/5 border text-center outline-none', theme.divider)}
                                    />
                                    <span className={theme.chromeMuted}>de {numPages}</span>
                                </form>
                            ) : (
                                <button onClick={() => { setGotoValue(String(displayed[0])); setGotoOpen(true) }} className="px-2 py-0.5 rounded-md hover:bg-black/5">
                                    {sliderValue != null
                                        ? <>Ir a la pág <b>{sliderValue}</b> de {numPages}</>
                                        : <>Pág <b>{pageLabel}</b> de {numPages} · <span className={theme.chromeMuted}>{pct}%</span></>}
                                </button>
                            )}
                        </div>
                    </motion.footer>
                )}
            </AnimatePresence>

            {/* Panel de apariencia */}
            <AnimatePresence>
                {panel === 'settings' && prefs && (
                    <motion.div
                        initial={{ y: 30, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 30, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className={cn('absolute z-30 inset-x-2 sm:inset-x-auto sm:right-4 sm:w-80 bottom-28 rounded-2xl border shadow-2xl p-4 space-y-4', theme.chrome)}
                    >
                        <div className="grid grid-cols-3 gap-2">
                            {(Object.keys(THEMES) as ThemeId[]).map(id => {
                                const t = THEMES[id]
                                const active = prefs.theme === id
                                return (
                                    <button
                                        key={id}
                                        onClick={() => updatePrefs({ theme: id })}
                                        className={cn('rounded-xl py-3 text-sm font-semibold border-2 transition-all', active ? 'scale-[1.03]' : 'border-transparent opacity-80')}
                                        style={{ background: t.swatch, color: t.swatchText, borderColor: active ? THEMES[prefs.theme].accent : 'rgba(0,0,0,0.12)' }}
                                    >
                                        {t.label}
                                    </button>
                                )
                            })}
                        </div>

                        <label className="flex items-center gap-3">
                            <SunDim className="w-4 h-4 shrink-0 opacity-70" />
                            <input
                                type="range"
                                min={0}
                                max={0.7}
                                step={0.05}
                                value={0.7 - prefs.dim}
                                onChange={e => updatePrefs({ dim: Math.round((0.7 - Number(e.target.value)) * 100) / 100 })}
                                className="flex-1"
                                style={{ accentColor: theme.accent }}
                                aria-label="Brillo"
                            />
                            <span className={cn('text-xs w-9 text-right tabular-nums', theme.chromeMuted)}>{Math.round((1 - prefs.dim) * 100)}%</span>
                        </label>

                        <div className="grid grid-cols-2 gap-2 text-xs font-medium">
                            <Toggle divider={theme.divider} active={prefs.fit === 'page'} onClick={() => updatePrefs({ fit: 'page', zoom: 1 })} accent={theme.accent}>
                                <RectangleVertical className="w-4 h-4" /> Página entera
                            </Toggle>
                            <Toggle divider={theme.divider} active={prefs.fit === 'width'} onClick={() => updatePrefs({ fit: 'width', zoom: 1 })} accent={theme.accent}>
                                <MoveHorizontal className="w-4 h-4" /> Ajustar al ancho
                            </Toggle>
                            <Toggle divider={theme.divider} active={prefs.crop} onClick={() => updatePrefs({ crop: !prefs.crop })} accent={theme.accent}>
                                <CropIcon className="w-4 h-4" /> Recortar márgenes
                            </Toggle>
                            {size.w >= 900 && size.w > size.h * 1.1 ? (
                                <Toggle divider={theme.divider} active={prefs.spread} onClick={() => updatePrefs({ spread: !prefs.spread })} accent={theme.accent}>
                                    <Columns2 className="w-4 h-4" /> Doble página
                                </Toggle>
                            ) : <div />}
                        </div>

                        <div className="flex items-center justify-between">
                            <span className={cn('text-xs', theme.chromeMuted)}>Zoom</span>
                            <div className="flex items-center gap-1">
                                <button onClick={() => zoomTo(zoom - 0.25)} disabled={zoom <= ZOOM_MIN} className="p-2 rounded-lg hover:bg-black/5 disabled:opacity-30" aria-label="Alejar">
                                    <ZoomOut className="w-4 h-4" />
                                </button>
                                <button onClick={() => zoomTo(1)} className="text-xs font-semibold w-14 tabular-nums">{Math.round(zoom * 100)}%</button>
                                <button onClick={() => zoomTo(zoom + 0.25)} disabled={zoom >= ZOOM_MAX} className="p-2 rounded-lg hover:bg-black/5 disabled:opacity-30" aria-label="Acercar">
                                    <ZoomIn className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Índice */}
            <AnimatePresence>
                {panel === 'outline' && (
                    <motion.aside
                        initial={{ x: -320, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -320, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className={cn('absolute z-30 top-0 bottom-0 left-0 w-80 max-w-[86vw] border-r shadow-2xl flex flex-col', theme.chrome)}
                        style={{ paddingTop: 'env(safe-area-inset-top)' }}
                    >
                        <div className={cn('flex items-center justify-between px-4 h-14 border-b shrink-0', theme.divider)}>
                            <span className="font-semibold">Índice</span>
                            <button onClick={() => setPanel(null)} className="p-2 rounded-full hover:bg-black/5" aria-label="Cerrar índice">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto py-2">
                            {outline === null ? (
                                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin opacity-60" /></div>
                            ) : outline.length === 0 ? (
                                <p className={cn('text-sm px-4 py-6', theme.chromeMuted)}>
                                    Este PDF no trae índice. Usá la barra de abajo o tocá el número de página para saltar.
                                </p>
                            ) : (
                                outline.map((entry, i) => (
                                    <button
                                        key={i}
                                        onClick={() => jumpToOutline(entry)}
                                        className={cn('w-full text-left py-2 pr-4 text-sm hover:bg-black/5 leading-snug', entry.depth === 0 ? 'font-semibold' : theme.chromeMuted)}
                                        style={{ paddingLeft: 16 + entry.depth * 16 }}
                                    >
                                        {entry.title}
                                    </button>
                                ))
                            )}
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>

            {/* Avance desde otro dispositivo */}
            <AnimatePresence>
                {remotePage != null && (
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        className={cn('absolute z-40 top-16 left-1/2 -translate-x-1/2 w-[min(92vw,380px)] rounded-2xl border shadow-2xl p-3 flex items-center gap-3', theme.chrome)}
                    >
                        <p className="text-sm flex-1">En otro dispositivo llegaste a la <b>pág {remotePage}</b>.</p>
                        <button
                            onClick={() => { goTo(remotePage); setRemotePage(null) }}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shrink-0"
                            style={{ background: theme.accent }}
                        >
                            Ir ahí
                        </button>
                        <button onClick={() => setRemotePage(null)} className="p-1 opacity-60 hover:opacity-100" aria-label="Quedarme acá">
                            <X className="w-4 h-4" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Final del libro */}
            <AnimatePresence>
                {showFinishPrompt && (
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 20, opacity: 0 }}
                        className={cn('absolute z-30 left-1/2 -translate-x-1/2 w-[min(92vw,400px)] rounded-2xl border shadow-2xl p-4', theme.chrome, uiVisible ? 'bottom-28' : 'bottom-8')}
                    >
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="w-6 h-6 shrink-0" style={{ color: theme.accent }} />
                            <div className="flex-1">
                                <p className="font-semibold text-sm">¡Llegaste al final!</p>
                                <p className={cn('text-xs mt-0.5', theme.chromeMuted)}>
                                    ¿Lo terminaste? Se archiva en tus leídos y queda registrado en Entretenimiento.
                                </p>
                                <button
                                    onClick={() => setFinishing(true)}
                                    className="mt-3 px-4 py-2 rounded-xl text-xs font-bold text-white"
                                    style={{ background: theme.accent }}
                                >
                                    Marcar como leído
                                </button>
                            </div>
                            <button onClick={() => setFinishDismissed(true)} className="p-1 opacity-60 hover:opacity-100" aria-label="Todavía no">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {finishing && (
                <RatingModal
                    title={book.title}
                    onClose={() => setFinishing(false)}
                    onSubmit={handleFinish}
                />
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────

function PageSlot({ slot, theme }: { slot: Frame['slots'][number]; theme: ReaderTheme }) {
    const hostRef = useRef<HTMLDivElement>(null)

    useLayoutEffect(() => {
        const host = hostRef.current
        if (!host) return
        const { canvas } = slot
        canvas.style.width = '100%'
        canvas.style.height = '100%'
        canvas.style.display = 'block'
        if (canvas.parentElement !== host) host.replaceChildren(canvas)
    }, [slot])

    return (
        <div
            className="relative isolate overflow-hidden shrink-0"
            style={{ width: slot.cssW, height: slot.cssH, background: theme.paper || theme.bg }}
        >
            <div ref={hostRef} className="absolute inset-0" style={{ filter: theme.filter }} />
            {theme.paper && (
                <div className="absolute inset-0 pointer-events-none" style={{ background: theme.paper, mixBlendMode: 'multiply' }} />
            )}
            {theme.ink && (
                <div className="absolute inset-0 pointer-events-none" style={{ background: theme.ink, mixBlendMode: 'screen' }} />
            )}
        </div>
    )
}

function ToolbarButton({ label, active, onClick, children }: {
    label: string
    active?: boolean
    onClick: () => void
    children: React.ReactNode
}) {
    return (
        <button
            onClick={onClick}
            title={label}
            aria-label={label}
            className={cn('p-2.5 rounded-full transition-colors hover:bg-black/5', active && 'bg-black/10')}
        >
            {children}
        </button>
    )
}

function Toggle({ active, onClick, accent, divider, children }: {
    active: boolean
    divider: string
    onClick: () => void
    accent: string
    children: React.ReactNode
}) {
    return (
        <button
            onClick={onClick}
            className={cn('flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-colors', active ? 'text-white' : cn(divider, 'hover:bg-black/5'))}
            style={active ? { background: accent, borderColor: accent } : undefined}
        >
            {children}
        </button>
    )
}
