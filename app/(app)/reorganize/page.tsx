import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ReorganizeClient } from './page.client'

export const dynamic = 'force-dynamic'

export default async function ReorganizePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    return <ReorganizeClient initialProfile={profile} />
}
