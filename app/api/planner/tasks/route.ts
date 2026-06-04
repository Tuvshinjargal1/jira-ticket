import { NextResponse } from "next/server";
import { getMsToken, graphGet } from "@/lib/graph";

const GP_GROUP_NAME = process.env.MS_GROUP_NAME ?? "GP Team";
const GP_PLAN_NAME = process.env.MS_PLAN_NAME ?? "GP Team";
const ENV_PLAN_ID = process.env.MS_PLAN_ID ?? "";

async function resolvePlanId(token: string): Promise<string> {
  if (ENV_PLAN_ID) return ENV_PLAN_ID;

  const groups = (await graphGet(
    token,
    `/groups?$filter=displayName eq '${GP_GROUP_NAME}'&$select=id`
  )) as { value: { id: string }[] };

  if (!groups.value?.length) {
    throw new Error(`"${GP_GROUP_NAME}" group олдсонгүй`);
  }
  const groupId = groups.value[0].id;

  const plans = (await graphGet(token, `/groups/${groupId}/planner/plans`)) as {
    value: { id: string; title: string }[];
  };
  const plan = plans.value?.find((p) => p.title === GP_PLAN_NAME);
  if (!plan) throw new Error(`"${GP_PLAN_NAME}" plan олдсонгүй`);
  return plan.id;
}

/** percentComplete → хүний уншихад тохиромжтой статус */
function toStatusLabel(percentComplete: number): string {
  if (percentComplete >= 100) return "Completed";
  if (percentComplete > 0) return "In Progress";
  return "Not Started";
}

/** Planner-д байгаа бүх [JIRA-KEY] task-ийн key болон статусыг буцаана */
export async function GET() {
  try {
    const token = await getMsToken();
    const planId = await resolvePlanId(token);

    const data = (await graphGet(
      token,
      `/planner/plans/${planId}/tasks?$select=title,percentComplete`
    )) as { value: { title: string; percentComplete: number }[] };

    const keyPattern = /^\[([A-Z]+-\d+)\]/;
    const tasks = (data.value ?? [])
      .map((t) => {
        const match = keyPattern.exec(t.title);
        if (!match) return null;
        return { key: match[1], status: toStatusLabel(t.percentComplete ?? 0) };
      })
      .filter((t): t is { key: string; status: string } => t !== null);

    return NextResponse.json({ tasks });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
