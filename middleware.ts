import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  // Check if Supabase environment variables are set
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('[v0] Supabase environment variables not configured. Skipping auth middleware.');
    // Allow request to proceed - auth will be handled on client side
    return NextResponse.next()
  }

  const response = await updateSession(request)

  // Get user from cookies for additional checks
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll() {},
        },
      },
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Protect role-based routes
    if (!user && (
      request.nextUrl.pathname.startsWith('/owner') ||
      request.nextUrl.pathname.startsWith('/issuer') ||
      request.nextUrl.pathname.startsWith('/verifier') ||
      request.nextUrl.pathname.startsWith('/protected') ||
      request.nextUrl.pathname.startsWith('/dashboard')
    )) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      return NextResponse.redirect(url)
    }

    // Redirect authenticated users away from auth pages
    if (user && request.nextUrl.pathname.startsWith('/auth/login')) {
      const url = request.nextUrl.clone()
      url.pathname = '/roles'
      return NextResponse.redirect(url)
    }
  } catch (error) {
    console.error('[v0] Middleware auth error:', error)
    // Continue with current response if auth check fails
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
