import { NextResponse } from "next/server";
import { attachSession, sealSession, sessionCookieOptions } from "@/lib/session";
import { loginWithCode, requestOrigin, safeEqual } from "@/lib/microsoft-auth";

function fail(origin: string, code: string) {
  const response = NextResponse.redirect(`${origin}/login?error=${code}`);
  const expired = { ...sessionCookieOptions(0), maxAge: 0 };
  response.cookies.set("oauth_state", "", expired);
  response.cookies.set("oauth_verifier", "", expired);
  return response;
}

export async function GET(req: Request) {
  const origin = requestOrigin(req);
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = req.headers.get("cookie") ?? "";

  const stateCookie = readCookie(cookie, "oauth_state");
  const verifier = readCookie(cookie, "oauth_verifier");

  if (url.searchParams.get("error") || !code || !state || !stateCookie || !verifier) {
    return fail(origin, "state");
  }
  if (!safeEqual(state, stateCookie)) {
    return fail(origin, "state");
  }

  try {
    const user = await loginWithCode(origin, code, verifier);
    const response = NextResponse.redirect(`${origin}/`);
    attachSession(response, await sealSession(user));
    const expired = { ...sessionCookieOptions(0), maxAge: 0 };
    response.cookies.set("oauth_state", "", expired);
    response.cookies.set("oauth_verifier", "", expired);
    return response;
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "token";
    if (reason === "domain" || reason === "redirect" || reason === "state") {
      return fail(origin, reason);
    }
    return fail(origin, "token");
  }
}

function readCookie(header: string, name: string): string | null {
  const parts = header.split(";").map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(name.length + 1));
}
