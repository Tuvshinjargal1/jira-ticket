import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";
import { requestOrigin } from "@/lib/microsoft-auth";

export async function POST(req: Request) {
  const response = NextResponse.redirect(`${requestOrigin(req)}/login`, { status: 303 });
  clearSession(response);
  return response;
}
