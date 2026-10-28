import { NextResponse } from "next/server";
import { loadBoard } from "@/lib/planner-board";
import { assertApiSession } from "@/lib/session";

export async function GET(req: Request) {
  const denied = await assertApiSession();
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const completed = url.searchParams.get("completed") === "1";
    const fresh = url.searchParams.get("fresh") === "1";
    const board = await loadBoard(completed ? "completed" : "open", { fresh });
    return NextResponse.json(board, {
      headers: {
        "Cache-Control": fresh ? "no-store" : "private, max-age=180",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
