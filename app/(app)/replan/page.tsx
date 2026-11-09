import { getReplanState } from '@/lib/actions/quarterly'
import { ReplanClient } from './page.client'

export const dynamic = 'force-dynamic'
// La generación del plan con IA puede pasar el minuto. Con Fluid compute
// (activado en Vercel) el plan Hobby permite hasta 300 s.
export const maxDuration = 300

export default async function ReplanPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
    const { q } = await searchParams
    // ?q=2027-1 permite abrir otro trimestre (por ejemplo, armar el siguiente antes de tiempo)
    const match = q?.match(/^(\d{4})-([1-4])$/)
    const state = await getReplanState(match ? Number(match[1]) : undefined, match ? Number(match[2]) : undefined)

    return <ReplanClient {...state} />
}
