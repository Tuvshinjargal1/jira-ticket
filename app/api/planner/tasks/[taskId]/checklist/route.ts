import { NextResponse } from "next/server";
import {
  addChecklistItem,
  deleteChecklistItem,
  loadChecklist,
  setChecklistChecked,
} from "@/lib/planner-board";
import { assertApiSession } from "@/lib/session";

type Context = { params: Promise<{ taskId: string }> };

export async function GET(_req: Request, context: Context) {
  const denied = await assertApiSession();
  if (denied) return denied;

  try {
    const { taskId } = await context.params;
    const items = await loadChecklist(taskId);
    return NextResponse.json({ items });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request, context: Context) {
  const denied = await assertApiSession();
  if (denied) return denied;

  try {
    const { taskId } = await context.params;
    const body = (await req.json()) as { title?: string };
    const items = await addChecklistItem(taskId, body.title ?? "");
    return NextResponse.json({ items });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("хоосон") || message.includes("тэмдэгт") || message.includes("буруу") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: Request, context: Context) {
  const denied = await assertApiSession();
  if (denied) return denied;

  try {
    const { taskId } = await context.params;
    const body = (await req.json()) as { itemId?: string; isChecked?: boolean };
    if (!body.itemId || typeof body.isChecked !== "boolean") {
      return NextResponse.json({ error: "itemId болон isChecked шаардлагатай" }, { status: 400 });
    }
    const items = await setChecklistChecked(taskId, body.itemId, body.isChecked);
    return NextResponse.json({ items });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: Context) {
  const denied = await assertApiSession();
  if (denied) return denied;

  try {
    const { taskId } = await context.params;
    const body = (await req.json()) as { itemId?: string };
    if (!body.itemId) {
      return NextResponse.json({ error: "itemId шаардлагатай" }, { status: 400 });
    }
    const items = await deleteChecklistItem(taskId, body.itemId);
    return NextResponse.json({ items });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("буруу") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
