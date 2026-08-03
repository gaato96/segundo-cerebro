import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type')
    const next = searchParams.get('next') ?? '/'

    // Handle PKCE flow (magic link, OAuth)
    if (code) {
        const response = NextResponse.redirect(`${origin}${next}`)

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return request.cookies.getAll() },
                    setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            response.cookies.set(name, value, options)
                        )
                    }
                }
            }
        )

        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            return response
        }
    }

    // Handle token_hash flow (password recovery, email confirm)
    if (token_hash && type) {
        const response = NextResponse.redirect(
            type === 'recovery'
                ? `${origin}/auth/reset-password`
                : `${origin}${next}`
        )

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return request.cookies.getAll() },
                    setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            response.cookies.set(name, value, options)
                        )
                    }
                }
            }
        )

        const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as any })
        if (!error) {
            return response
        }
    }

    // If all fails, redirect to login with error
    return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
