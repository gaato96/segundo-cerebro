/** Enlaces [[Título]] de las notas. Sirve en cliente y servidor. */

export const WIKILINK_RE = /\[\[([^[\]\n]{1,160})\]\]/g

export function extractLinks(content: string): string[] {
    const out = new Set<string>()
    for (const m of content.matchAll(WIKILINK_RE)) out.add(m[1].trim())
    return Array.from(out)
}

/** Convierte [[X]] en un link markdown que el visor sabe resolver. */
export function wikilinksToMarkdown(content: string): string {
    return content.replace(WIKILINK_RE, (_, t) => `[${String(t).trim()}](wikilink:${encodeURIComponent(String(t).trim())})`)
}
