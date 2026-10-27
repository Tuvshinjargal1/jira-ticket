import { NextResponse } from "next/server";
import { fetchAllParticipantTickets } from "@/lib/jira";
import { assertApiSession } from "@/lib/session";

export async function GET() {
  const denied = await assertApiSession();
  if (denied) return denied;

  try {
    const data = await fetchAllParticipantTickets();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
