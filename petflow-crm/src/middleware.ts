import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { token } = req.nextauth;
    const role = (token?.role as string) ?? "";
    const pathname = req.nextUrl.pathname;

    // Routes only accessible by SpaAdmin and SuperAdmin
    const adminOnlyRoutes = ["/staff"];

    const isAdminOnly = adminOnlyRoutes.some(route => pathname.startsWith(route));
    const isStaff = role === "Staff";

    if (isAdminOnly && isStaff) {
      // Redirect to unauthorized page
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token?.id,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    // Protect all routes, bypass API auth/health, login, register (invite), webhook, payment pages, and static assets
    "/((?!api/health|api/auth|login|register|unauthorized|payment|_next/static|_next/image|favicon.ico|images|api/webhook).*)",
  ],
};
