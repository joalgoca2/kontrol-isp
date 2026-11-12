import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "./auth";
import { hasRouteAccess } from "@/lib/permissions";

const isDev = process.env.NODE_ENV !== "production";
const scriptSrc =
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval' " : ""}` +
  `https://static.cloudflareinsights.com ` +
  `https://unpkg.com ` +
  `https://checkout.epayco.co ` +
  `https://*.epayco.co ` +
  `https://maps.googleapis.com;`;

const styleSrc =
  `style-src 'self' 'unsafe-inline' ` +
  `https://unpkg.com ` +
  `https://fonts.googleapis.com;`;

const imgSrc =
  `img-src 'self' blob: data: ` +
  `https://*.tile.openstreetmap.org ` +
  `https://maps.gstatic.com ` +
  `https://*.epayco.co ` +
  `https://*.epayco.io ` +
  `https://maps.googleapis.com;`;

const connectSrc =
  `connect-src 'self' ws: wss: ` +
  `https://cloudflareinsights.com ` +
  `https://unpkg.com ` +
  `https://*.tile.openstreetmap.org ` +
  `https://nominatim.openstreetmap.org ` +
  `https://*.epayco.co ` +
  `https://*.epayco.io ` +
  `https://maps.googleapis.com;`;

const fontSrc = `font-src 'self' data: https://fonts.gstatic.com;`;

const frameSrc =
  `frame-src 'self' https://*.epayco.co https://*.epayco.io ` +
  `https://checkout.epayco.co;`;

const cspHeader =
  `default-src 'self'; ${scriptSrc} ${styleSrc} ${imgSrc} ${connectSrc} ` +
  `${fontSrc} ${frameSrc} object-src 'none'; base-uri 'self'; form-action 'self'; ` +
  `frame-ancestors 'none'; upgrade-insecure-requests;`;

function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-XSS-Protection", "1; mode=block");
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Content-Security-Policy", cspHeader);
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  return res;
}

export async function proxyMiddleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Completely bypass NextAuth internal endpoints (/api/auth/*)
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Get session using auth() helper safely
  let session = null;
  try {
    session = await auth();
  } catch {
    session = null;
  }

  const isLoggedIn = Boolean(session?.user);
  const userRoles = (session?.user as { roles?: string[] })?.roles ?? [];

  const isDashboardPage = pathname.startsWith("/dashboard");
  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/register");

  // 2. Protection for API Admin routes
  if (pathname.startsWith("/api/admin")) {
    if (!isLoggedIn) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }
    if (!hasRouteAccess("/dashboard/admin", userRoles)) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Forbidden" }, { status: 403 })
      );
    }
  }

  // 3. Unauthenticated Dashboard Access -> Redirect to /login
  if (isDashboardPage && !isLoggedIn) {
    return applySecurityHeaders(
      NextResponse.redirect(new URL("/login", req.nextUrl))
    );
  }

  // 4. Centralized Route Access Control Check via hasRouteAccess()
  if (isDashboardPage && isLoggedIn) {
    if (!hasRouteAccess(pathname, userRoles)) {
      return applySecurityHeaders(
        NextResponse.redirect(new URL("/dashboard", req.nextUrl))
      );
    }
  }

  // 5. Already Logged In Access to Auth Pages (/login, /register)
  if (isAuthPage && isLoggedIn) {
    return applySecurityHeaders(
      NextResponse.redirect(new URL("/dashboard", req.nextUrl))
    );
  }

  return applySecurityHeaders(NextResponse.next());
}

export default proxyMiddleware;

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|icons/|.*\\.png|.*\\.svg).*)",
  ],
};
