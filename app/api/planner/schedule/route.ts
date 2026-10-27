import { NextResponse } from "next/server";
import { loadBoard } from "@/lib/planner-board";
import { assertApiSession } from "@/lib/session";

export async function GET() {
  const denied = await assertApiSession();
  if (denied) return denied;

  try {
    const board = await loadBoard();
    return NextResponse.json(board);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
