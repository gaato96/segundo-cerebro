/** Esqueleto con la forma de las pantallas: aparece al instante al tocar el menú. */
export default function Loading() {
    return (
        <div className="mx-auto w-full max-w-[1280px] px-4 md:px-8 py-6 md:py-8 animate-pulse" aria-label="Cargando">
            <div className="pb-6 mb-6 border-b border-hairline space-y-2.5">
                <div className="h-3 w-24 rounded bg-raised" />
                <div className="h-8 w-56 rounded-lg bg-raised" />
                <div className="h-3.5 w-80 max-w-full rounded bg-raised" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-3">
                    {[72, 56, 56, 56, 56].map((h, i) => <div key={i} className="rounded-2xl bg-card border border-hairline" style={{ height: h }} />)}
                </div>
                <div className="lg:col-span-4 space-y-4">
                    <div className="h-44 rounded-2xl bg-card border border-hairline" />
                    <div className="h-28 rounded-2xl bg-card border border-hairline" />
                </div>
            </div>
        </div>
    )
}
