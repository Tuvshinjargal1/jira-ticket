import { NextResponse } from "next/server";
import { setTaskDueDate } from "@/lib/planner-board";
import { assertApiSession } from "@/lib/session";

type Context = { params: Promise<{ taskId: string }> };

export async function PATCH(req: Request, context: Context) {
  const denied = await assertApiSession();
  if (denied) return denied;

  try {
    const { taskId } = await context.params;
    const body = (await req.json()) as { dueDate?: string | null };
    const dueDate = body.dueDate ?? null;
    if (dueDate !== null && typeof dueDate !== "string") {
      return NextResponse.json({ error: "Огноо буруу" }, { status: 400 });
    }
    await setTaskDueDate(taskId, dueDate);
    return NextResponse.json({ dueDate });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("буруу") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
