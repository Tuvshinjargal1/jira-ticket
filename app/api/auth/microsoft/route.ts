import { NextResponse } from "next/server";
import { sessionCookieOptions } from "@/lib/session";
import {
  authorizeUrl,
  codeChallenge,
  randomUrlToken,
  requestOrigin,
} from "@/lib/microsoft-auth";

export async function GET(req: Request) {
  const state = randomUrlToken();
  const verifier = randomUrlToken(48);
  const challenge = await codeChallenge(verifier);
  const origin = requestOrigin(req);

  const response = NextResponse.redirect(authorizeUrl(origin, state, challenge));
  const opts = sessionCookieOptions(10 * 60);
  response.cookies.set("oauth_state", state, opts);
  response.cookies.set("oauth_verifier", verifier, opts);
  return response;
}
