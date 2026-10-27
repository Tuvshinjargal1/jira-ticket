import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { openSession, SESSION_COOKIE } from "@/lib/session";

const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/microsoft",
  "/api/auth/callback",
  "/api/auth/logout",
]);

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const session = await openSession(req.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.has(path);

  if (!session && !isPublic) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 });
    }
    const login = new URL("/login", req.url);
    return NextResponse.redirect(login);
  }

  if (session && path === "/login") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico)$).*)"],
};
