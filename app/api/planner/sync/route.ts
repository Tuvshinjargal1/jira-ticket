import { NextRequest, NextResponse } from "next/server";
import { getMsToken, graphGet, graphPost, graphPatch, toPlannerPriority } from "@/lib/graph";
import { extractPlainText, PARTICIPANTS } from "@/lib/jira";
import type { TicketWithParticipants, SyncResult } from "@/types";

const JIRA_BASE_URL = process.env.JIRA_BASE_URL!;
const GP_GROUP_NAME = process.env.MS_GROUP_NAME ?? "GP Team";
const GP_PLAN_NAME = process.env.MS_PLAN_NAME ?? "GP Team";
// Хэрэв MS_PLAN_ID тохируулсан бол group/plan хайлтыг алгасана.
// Plan ID-г Planner URL-аас олно: /plan/<PLAN_ID>/view/board
const ENV_PLAN_ID = process.env.MS_PLAN_ID ?? "";

// ── Microsoft Graph helpers ──────────────────────────────────────────────────

async function findGroupId(token: string): Promise<string> {
  const data = (await graphGet(
    token,
    `/groups?$filter=displayName eq '${GP_GROUP_NAME}'&$select=id,displayName`
  )) as { value: { id: string }[] };

  if (!data.value?.length) {
    throw new Error(`"${GP_GROUP_NAME}" нэртэй Microsoft 365 group олдсонгүй`);
  }
  return data.value[0].id;
}

async function findPlanId(token: string, groupId: string): Promise<string> {
  const data = (await graphGet(token, `/groups/${groupId}/planner/plans`)) as {
    value: { id: string; title: string }[];
  };

  const plan = data.value?.find((p) => p.title === GP_PLAN_NAME);
  if (!plan) {
    const available = (data.value ?? []).map((p) => `"${p.title}"`).join(", ");
    throw new Error(
      `"${GP_PLAN_NAME}" нэртэй Planner plan олдсонгүй.` +
        (available ? ` Байгаа планууд: ${available}` : " План байхгүй байна.")
    );
  }
  return plan.id;
}

async function resolvePlanId(token: string): Promise<string> {
  if (ENV_PLAN_ID) return ENV_PLAN_ID;
  const groupId = await findGroupId(token);
  return findPlanId(token, groupId);
}

async function findOrCreateBucket(
  token: string,
  planId: string,
  bucketName: string,
  bucketCache: Map<string, string>
): Promise<string> {
  if (bucketCache.has(bucketName)) return bucketCache.get(bucketName)!;

  const data = (await graphGet(token, `/planner/plans/${planId}/buckets`)) as {
    value: { id: string; name: string }[];
  };

  const existing = (data.value ?? []).find((b) => b.name === bucketName);
  if (existing) {
    bucketCache.set(bucketName, existing.id);
    return existing.id;
  }

  // Bucket байхгүй бол шинээр үүсгэнэ
  const created = (await graphPost(token, "/planner/buckets", {
    name: bucketName,
    planId,
    orderHint: " !",
  })) as { id: string };

  bucketCache.set(bucketName, created.id);
  return created.id;
}

async function findMsUserId(token: string, email: string): Promise<string | null> {
  try {
    // OData filter-т email-г шууд ашиглана (encodeURIComponent хийвэл @ → %40 болж таарахгүй)
    const filter = encodeURIComponent(`mail eq '${email}' or userPrincipalName eq '${email}'`);
    const data = (await graphGet(
      token,
      `/users?$filter=${filter}&$select=id,displayName`
    )) as { value: { id: string }[] };

    return data.value?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function taskAlreadyExists(
  token: string,
  planId: string,
  jiraKey: string
): Promise<boolean> {
  const data = (await graphGet(token, `/planner/plans/${planId}/tasks`)) as {
    value: { title: string }[];
  };
  return (data.value ?? []).some((t) => t.title.startsWith(`[${jiraKey}]`));
}

// ── Main POST handler ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tickets: TicketWithParticipants[] = body.tickets ?? [];

    if (!tickets.length) {
      return NextResponse.json(
        { error: "Синхрончлох ticket сонгоогүй байна" },
        { status: 400 }
      );
    }

    // 1. MS token авах
    const token = await getMsToken();

    // 2. Group → Plan ID олох
    const planId = await resolvePlanId(token);

    // Bucket cache — нэг л удаа API дуудна
    const bucketCache = new Map<string, string>();

    const results: SyncResult[] = [];

    // 3. Тус бүр ticket боловсруулах
    for (const ticket of tickets) {
      const key = ticket.key;
      const fields = ticket.fields;

      try {
        // Давхардал шалгах
        const exists = await taskAlreadyExists(token, planId, key);
        if (exists) {
          results.push({ key, summary: fields.summary, status: "skipped" });
          continue;
        }

        // Request participant → Microsoft user хайж assign хийх
        const assignments: Record<string, unknown> = {};
        const participantNames: string[] = ticket.participants ?? [];
        const participantLabel = participantNames.join(", ") || null;

        // Эхний participant-ийн нэрийг bucket болгоно
        const bucketName = participantNames[0] ?? "Unassigned";
        const bucketId = await findOrCreateBucket(token, planId, bucketName, bucketCache);

        for (const pName of participantNames) {
          const pInfo = PARTICIPANTS.find((p) => p.displayName === pName);
          if (!pInfo) continue;
          const msUserId = await findMsUserId(token, pInfo.email);
          if (msUserId) {
            assignments[msUserId] = {
              "@odata.type": "#microsoft.graph.plannerAssignment",
              orderHint: " !",
            };
          }
        }

        // Description боловсруулах
        const rawDesc = fields.description;
        const descText =
          rawDesc && typeof rawDesc === "object"
            ? extractPlainText(rawDesc)
            : String(rawDesc ?? "");

        const jiraUrl = `${JIRA_BASE_URL}/browse/${key}`;
        const noteText = `Jira холбоос: ${jiraUrl}\n\n${descText}`.trim();

        // Task үүсгэх
        const titleSuffix = participantLabel ? ` --> ${participantLabel}` : "";
        const taskPayload: Record<string, unknown> = {
          planId,
          bucketId,
          title: `[${key}] ${fields.summary}${titleSuffix}`,
          priority: toPlannerPriority(fields.priority?.name ?? "Medium"),
          assignments,
        };

        if (fields.duedate) {
          taskPayload.dueDateTime = new Date(
            `${fields.duedate}T00:00:00Z`
          ).toISOString();
        }

        const task = (await graphPost(token, "/planner/tasks", taskPayload)) as {
          id: string;
        };

        // Task details (description) шинэчлэх — ETag шаарддаг
        if (noteText) {
          try {
            const details = (await graphGet(
              token,
              `/planner/tasks/${task.id}/details`
            )) as { "@odata.etag": string };

            await graphPatch(
              token,
              `/planner/tasks/${task.id}/details`,
              { description: noteText.substring(0, 1024) },
              details["@odata.etag"]
            );
          } catch (detailErr) {
            // Description нэмж чадаагүй ч task үүссэн тул үргэлжлүүлнэ
            console.warn(`[${key}] description PATCH: ${detailErr}`);
          }
        }

        const taskUrl = `https://planner.cloud.microsoft/webui/plan/${planId}/view/board`;

        results.push({
          key,
          summary: fields.summary,
          status: "created",
          taskId: task.id,
          taskUrl,
          assigneeName: participantLabel ?? undefined,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ key, summary: fields.summary, status: "error", error: message });
      }
    }

    // 4. Хураангуй тооцох
    const created = results.filter((r) => r.status === "created").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const errors = results.filter((r) => r.status === "error").length;

    return NextResponse.json({ results, created, skipped, errors });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
