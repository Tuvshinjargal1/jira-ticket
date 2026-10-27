import { timingSafeEqual } from "node:crypto";

const ALLOWED_DOMAIN = "zerotech.mn";
export const PRODUCTION_ORIGIN = "https://jira-ticket.vercel.app";

function allowedOrigins(): Set<string> {
  const origins = new Set([
    PRODUCTION_ORIGIN,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);
  const extra = process.env.APP_URL?.replace(/\/$/, "");
  if (extra) origins.add(extra);
  return origins;
}

type IdClaims = {
  aud?: string | string[];
  iss?: string;
  exp?: number;
  email?: string;
  preferred_username?: string;
  upn?: string;
  name?: string;
};

type Jwk = { kid?: string; kty?: string; n?: string; e?: string };

function tenantId() {
  const id = process.env.MS_TENANT_ID;
  if (!id) throw new Error("MS_TENANT_ID тохируулаагүй байна");
  return id;
}

function clientId() {
  const id = process.env.MS_CLIENT_ID;
  if (!id) throw new Error("MS_CLIENT_ID тохируулаагүй байна");
  return id;
}

function clientSecret() {
  const secret = process.env.MS_CLIENT_SECRET;
  if (!secret) throw new Error("MS_CLIENT_SECRET тохируулаагүй байна");
  return secret;
}

export function redirectUri(origin: string) {
  return `${origin}/api/auth/callback`;
}

export function randomUrlToken(bytes = 32): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString("base64url");
}

export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return Buffer.from(digest).toString("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function authorizeUrl(origin: string, state: string, challenge: string): string {
  const url = new URL(`https://login.microsoftonline.com/${tenantId()}/oauth2/v2.0/authorize`);
  url.searchParams.set("client_id", clientId());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri(origin));
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("domain_hint", ALLOWED_DOMAIN);
  return url.toString();
}

export function requestOrigin(req: Request): string {
  return originFromHeaders(req.headers);
}

export function originFromHeaders(headerList: Headers): string {
  const proto = (headerList.get("x-forwarded-proto") ?? "http").split(",")[0].trim();
  const host = (headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000")
    .split(",")[0]
    .trim();
  const origin = `${proto}://${host}`;
  if (allowedOrigins().has(origin)) return origin;
  return process.env.APP_URL?.replace(/\/$/, "") || PRODUCTION_ORIGIN;
}

function b64urlToJson<T>(part: string): T {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as T;
}

async function verifyIdToken(idToken: string): Promise<IdClaims> {
  const [headerPart, payloadPart, sigPart] = idToken.split(".");
  if (!headerPart || !payloadPart || !sigPart) {
    throw new Error("id_token буруу");
  }

  const header = b64urlToJson<{ alg?: string; kid?: string }>(headerPart);
  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("id_token алгоритм буруу");
  }

  const jwksRes = await fetch(
    `https://login.microsoftonline.com/${tenantId()}/discovery/v2.0/keys`,
    { cache: "no-store" }
  );
  if (!jwksRes.ok) throw new Error("Microsoft түлхүүр татаж чадсангүй");
  const jwks = (await jwksRes.json()) as { keys: Jwk[] };
  const jwk = jwks.keys.find((key) => key.kid === header.kid && key.n && key.e);
  if (!jwk?.n || !jwk.e) throw new Error("id_token түлхүүр олдсонгүй");

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const signature = Buffer.from(sigPart, "base64url");
  const signatureBytes = new Uint8Array(signature.byteLength);
  signatureBytes.set(signature);
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    signatureBytes,
    new TextEncoder().encode(`${headerPart}.${payloadPart}`)
  );
  if (!ok) throw new Error("id_token гарын үсэг буруу");

  const claims = b64urlToJson<IdClaims>(payloadPart);
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== "number" || claims.exp < now - 60) {
    throw new Error("id_token хугацаа дууссан");
  }

  const aud = claims.aud;
  const audienceOk = aud === clientId() || (Array.isArray(aud) && aud.includes(clientId()));
  if (!audienceOk) throw new Error("id_token aud буруу");

  const iss = `https://login.microsoftonline.com/${tenantId()}/v2.0`;
  if (claims.iss !== iss) throw new Error("id_token iss буруу");
  return claims;
}

function workIdentity(claims: IdClaims): { email: string; name: string } | null {
  const candidates = [claims.email, claims.preferred_username, claims.upn].filter(
    (value): value is string => typeof value === "string"
  );
  const email = candidates
    .map((value) => value.trim().toLowerCase())
    .find((value) => value.endsWith(`@${ALLOWED_DOMAIN}`));
  if (!email) return null;
  const name = (claims.name || email.split("@")[0]).trim();
  return { email, name };
}

export async function loginWithCode(origin: string, code: string, verifier: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId(),
    client_secret: clientSecret(),
    code,
    redirect_uri: redirectUri(origin),
    code_verifier: verifier,
    scope: "openid profile email",
  });

  const res = await fetch(`https://login.microsoftonline.com/${tenantId()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  const data = (await res.json()) as {
    id_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.id_token) {
    const description = data.error_description ?? "";
    if (description.includes("AADSTS50011")) {
      throw new Error("redirect");
    }
    throw new Error("token");
  }

  const claims = await verifyIdToken(data.id_token);
  const user = workIdentity(claims);
  if (!user) throw new Error("domain");
  return user;
}
