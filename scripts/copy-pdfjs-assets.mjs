/**
 * Copia el worker de pdf.js y sus recursos (cmaps, fuentes estándar, wasm para
 * imágenes JPX/JBIG2 de los PDFs escaneados) a public/pdfjs/<versión>/.
 *
 * Corre en cada `npm install` (postinstall), así que en Vercel siempre queda la
 * misma versión que la librería instalada. La carpeta está en .gitignore.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkgDir = join(root, 'node_modules', 'pdfjs-dist')

if (!existsSync(pkgDir)) {
    console.warn('[pdfjs] pdfjs-dist no está instalado, no copio nada.')
    process.exit(0)
}

const { version } = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
const outBase = join(root, 'public', 'pdfjs')
const out = join(outBase, version)

// Las versiones viejas no sirven para nada: el cliente pide la ruta de la versión instalada.
rmSync(outBase, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

// Copia a mano: fs.cpSync de Node 24 falla en Windows con rutas que tienen "ñ".
function copyDir(src, dest) {
    mkdirSync(dest, { recursive: true })
    for (const entry of readdirSync(src, { withFileTypes: true })) {
        const from = join(src, entry.name)
        const to = join(dest, entry.name)
        if (entry.isDirectory()) copyDir(from, to)
        else copyFileSync(from, to)
    }
}

copyFileSync(join(pkgDir, 'build', 'pdf.worker.min.mjs'), join(out, 'pdf.worker.min.mjs'))
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
    const src = join(pkgDir, dir)
    if (existsSync(src)) copyDir(src, join(out, dir))
}

console.log(`[pdfjs] assets ${version} copiados a public/pdfjs/${version}`)
