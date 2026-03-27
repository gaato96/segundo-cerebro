import { Loader2 } from 'lucide-react'

export default function Loading() {
    return (
        <div className="flex-1 h-full w-full flex flex-col items-center justify-center gap-4 p-8 animate-fade-in text-muted-foreground">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-sm font-medium animate-pulse">Cargando...</p>
        </div>
    )
}
