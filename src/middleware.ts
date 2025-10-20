import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Database } from '@/types/database.types';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // In dev mode, disable auth middleware to avoid Supabase requirement
  // if (
  //   process.env.NODE_ENV === 'development' ||
  //   process.env.NODE_ENV === 'production'
  // ) {
  //   // Add security headers but skip auth
  //   return NextResponse.next({
  //     headers: {
  //       'X-Frame-Options': 'DENY',
  //       'X-Content-Type-Options': 'nosniff',
  //       'Referrer-Policy': 'origin-when-cross-origin',
  //       'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  //     },
  //   });
  // }

  // Create a Supabase client configured to use cookies
  const supabase = createMiddlewareClient<Database>({ req, res });

  // Refresh session if expired
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (session) {
    // This is a great place to decode the JWT and check for your custom claims
    console.log('User Access Token:', session.access_token);
  }

  // Routes that require admin/owner role
  // Note: We're not enforcing authentication at middleware level
  // The AuthProvider in MainLayout handles showing login form for unauthenticated users
  const adminOnlyRoutes = ['/customer', '/documents', '/settings', '/chat', '/chat-v2', '/servers'];

  const isAdminRoute = adminOnlyRoutes.some(route =>
    req.nextUrl.pathname.startsWith(route)
  );

  // Public API routes that don't require auth
  const publicApiRoutes = ['/api/auth', '/api/health', '/api/trpc/auth'];
  const isPublicApiRoute = publicApiRoutes.some(route =>
    req.nextUrl.pathname.startsWith(route)
  );

  // Allow public API routes
  if (isPublicApiRoute) {
    return res;
  }

  // Allow unauthenticated users to proceed - the layout will show LoginForm
  // The AuthProvider in the layout handles redirecting unauthenticated users to the login form
  // So we don't need to redirect here - just check roles for authenticated users

  // if ((isProtectedRoute || isAdminRoute) && !session) {
  //   // Don't redirect - let the layout handle showing the login form
  //   // The MainLayout component will show <LoginForm /> if !isAuthenticated
  // }

  // Check role for admin-only routes
  if (isAdminRoute && session) {
    // Get employee role from database
    const { data: employee } = await supabase
      .from('employees')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    const isAdminOrOwner = employee?.role === 'admin' || employee?.role === 'owner';

    if (!isAdminOrOwner) {
      // Redirect to home page with error parameter
      const redirectUrl = new URL('/', req.url);
      redirectUrl.searchParams.set('error', 'unauthorized');
      redirectUrl.searchParams.set('required', 'admin');
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Add security headers
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', req.nextUrl.pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
