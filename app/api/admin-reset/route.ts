import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// TEMPORARY ADMIN ENDPOINT - DELETE AFTER USE
// Usage: POST /api/admin-reset with body { secret: "TU_SECRET", userId: "UUID", password: "nueva_password" }

export async function POST(request: NextRequest) {
    const body = await request.json()
    const { secret, userId, password } = body

    // Simple secret check to prevent unauthorized use
    if (secret !== process.env.ADMIN_RESET_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, user: data.user?.email })
}
