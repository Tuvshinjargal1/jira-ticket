import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE = "session";
const MAX_AGE_SEC = 7 * 24 * 60 * 60;

export type SessionUser = {
  email: string;
  name: string;
};

type SessionPayload = SessionUser & { exp: number };

function secretKey(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET тохируулаагүй байна");
  }
  return secret;
}

function bytesToB64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function b64urlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const source = Buffer.from(value, "base64url");
  const copy = new Uint8Array(source.byteLength);
  copy.set(source);
  return copy;
}

async function hmacKey(usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKey()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage]
  );
}

export function sessionCookieOptions(maxAge = MAX_AGE_SEC) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function sealSession(user: SessionUser): Promise<string> {
  const payload: SessionPayload = {
    email: user.email,
    name: user.name,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SEC,
  };
  const body = bytesToB64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey("sign");
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${body}.${bytesToB64url(new Uint8Array(sig))}`;
}

export async function openSession(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  try {
    const key = await hmacKey("verify");
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlToBytes(sig),
      new TextEncoder().encode(body)
    );
    if (!ok) return null;

    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(body))) as SessionPayload;
    if (!payload.email || !payload.name || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.email.toLowerCase().endsWith("@zerotech.mn")) return null;
    return { email: payload.email, name: payload.name };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return openSession(token);
}

export function attachSession(response: NextResponse, token: string) {
  response.cookies.set(COOKIE, token, sessionCookieOptions());
}

export function clearSession(response: NextResponse) {
  response.cookies.set(COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
}

/** API route хамгаалалт. Нэвтрээгүй бол 401, нэвтэрсэн бол null. */
export async function assertApiSession(): Promise<NextResponse | null> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 });
  }
  return null;
}

export const SESSION_COOKIE = COOKIE;
