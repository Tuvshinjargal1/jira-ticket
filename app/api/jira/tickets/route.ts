import { NextResponse } from "next/server";
import { fetchAllParticipantTickets } from "@/lib/jira";

export async function GET() {
  try {
    const data = await fetchAllParticipantTickets();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
