import { NextResponse } from "next/server";
import { getJiraAuthHeader } from "@/lib/jira";
import { getMsToken, graphGet, graphPatch } from "@/lib/graph";

const JIRA_BASE_URL = process.env.JIRA_BASE_URL!;
const GP_GROUP_NAME = process.env.MS_GROUP_NAME ?? "GP Team";
const GP_PLAN_NAME = process.env.MS_PLAN_NAME ?? "GP Team";
const ENV_PLAN_ID = process.env.MS_PLAN_ID ?? "";

const KEY_PATTERN = /^\[([A-Z]+-\d+)\]/;
const JIRA_CHUNK = 50;

type PlannerTask = { id: string; title: string; percentComplete: number };
type CompleteResult = {
  key: string;
  taskId: string;
  status: "completed" | "open" | "error";
  jiraStatus?: string;
  error?: string;
};

async function resolvePlanId(token: string): Promise<string> {
  if (ENV_PLAN_ID) return ENV_PLAN_ID;

  const groups = (await graphGet(
    token,
    `/groups?$filter=displayName eq '${GP_GROUP_NAME}'&$select=id`
  )) as { value: { id: string }[] };

  if (!groups.value?.length) {
    throw new Error(`"${GP_GROUP_NAME}" group олдсонгүй`);
  }

  const plans = (await graphGet(
    token,
    `/groups/${groups.value[0].id}/planner/plans`
  )) as { value: { id: string; title: string }[] };

  const plan = plans.value?.find((p) => p.title === GP_PLAN_NAME);
  if (!plan) throw new Error(`"${GP_PLAN_NAME}" plan олдсонгүй`);
  return plan.id;
}

/** Jira-аас key-үүдийн статусыг татна (хаагдсан эсэх) */
async function fetchJiraStatuses(
  keys: string[]
): Promise<Map<string, { name: string; done: boolean }>> {
  const result = new Map<string, { name: string; done: boolean }>();
  if (!keys.length) return result;

  for (let i = 0; i < keys.length; i += JIRA_CHUNK) {
    const chunk = keys.slice(i, i + JIRA_CHUNK);
    const jql = `key in (${chunk.join(",")})`;
    const url = new URL(`${JIRA_BASE_URL}/rest/api/3/search/jql`);
    url.searchParams.set("jql", jql);
    url.searchParams.set("fields", "status");
    url.searchParams.set("maxResults", String(chunk.length));

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: getJiraAuthHeader(),
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Jira status шалгахад алдаа: ${res.status} — ${body}`);
    }

    const data = (await res.json()) as {
      issues?: {
        key: string;
        fields: {
          status?: {
            name?: string;
            statusCategory?: { key?: string; name?: string };
          };
        };
      }[];
    };

    for (const issue of data.issues ?? []) {
      const name = issue.fields.status?.name ?? "";
      const cat = (
        issue.fields.status?.statusCategory?.key ?? ""
      ).toLowerCase();
      const nameLower = name.toLowerCase();
      const done =
        cat === "done" ||
        nameLower === "resolved" ||
        nameLower === "closed" ||
        nameLower === "done";
      result.set(issue.key, { name, done });
    }
  }

  return result;
}

async function markPlannerCompleted(
  token: string,
  taskId: string
): Promise<void> {
  const taskData = (await graphGet(
    token,
    `/planner/tasks/${taskId}`
  )) as Record<string, unknown>;
  const etag = taskData["@odata.etag"] as string;
  await graphPatch(token, `/planner/tasks/${taskId}`, { percentComplete: 100 }, etag);
}

/**
 * Planner дээрх дуусаагүй [JIRA-KEY] task-уудыг Jira-тай тулгаж,
 * хаагдсан бол Complete болгоно.
 */
export async function POST() {
  try {
    const token = await getMsToken();
    const planId = await resolvePlanId(token);

    const data = (await graphGet(
      token,
      `/planner/plans/${planId}/tasks?$select=id,title,percentComplete`
    )) as { value: PlannerTask[] };

    const incomplete = (data.value ?? [])
      .map((t) => {
        const match = KEY_PATTERN.exec(t.title);
        if (!match) return null;
        if ((t.percentComplete ?? 0) >= 100) return null;
        return { key: match[1], taskId: t.id };
      })
      .filter((t): t is { key: string; taskId: string } => t !== null);

    if (!incomplete.length) {
      return NextResponse.json({
        results: [],
        completed: 0,
        open: 0,
        errors: 0,
        checked: 0,
      });
    }

    const jiraStatuses = await fetchJiraStatuses(incomplete.map((t) => t.key));
    const results: CompleteResult[] = [];

    for (const task of incomplete) {
      const jira = jiraStatuses.get(task.key);
      if (!jira) {
        results.push({
          key: task.key,
          taskId: task.taskId,
          status: "error",
          error: "Jira-аас олдсонгүй",
        });
        continue;
      }

      if (!jira.done) {
        results.push({
          key: task.key,
          taskId: task.taskId,
          status: "open",
          jiraStatus: jira.name,
        });
        continue;
      }

      try {
        await markPlannerCompleted(token, task.taskId);
        results.push({
          key: task.key,
          taskId: task.taskId,
          status: "completed",
          jiraStatus: jira.name,
        });
      } catch (e: unknown) {
        results.push({
          key: task.key,
          taskId: task.taskId,
          status: "error",
          jiraStatus: jira.name,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return NextResponse.json({
      results,
      completed: results.filter((r) => r.status === "completed").length,
      open: results.filter((r) => r.status === "open").length,
      errors: results.filter((r) => r.status === "error").length,
      checked: incomplete.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
