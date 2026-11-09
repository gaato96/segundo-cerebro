import { getReplanState } from '@/lib/actions/quarterly'
import { ReplanClient } from './page.client'

export const dynamic = 'force-dynamic'
// La generación del plan con IA puede tardar más que el límite por defecto.
export const maxDuration = 60

export default async function ReplanPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
    const { q } = await searchParams
    // ?q=2027-1 permite abrir otro trimestre (por ejemplo, armar el siguiente antes de tiempo)
    const match = q?.match(/^(\d{4})-([1-4])$/)
    const state = await getReplanState(match ? Number(match[1]) : undefined, match ? Number(match[2]) : undefined)

    return <ReplanClient {...state} />
}
