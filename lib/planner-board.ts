import { getJiraAuthHeader } from "@/lib/jira";
import { getMsToken, graphGet, graphPatch } from "@/lib/graph";

const ENV_PLAN_ID = process.env.MS_PLAN_ID ?? "";
const JIRA_BASE_URL = process.env.JIRA_BASE_URL!;

const PERSON_ORDER = ["Tuvshinjargal", "Nandintsetseg", "Khuslen", "Khulan"];
const BOARD_CACHE_MS = 3 * 60 * 1000;

type BoardData = {
  planUrl: string;
  people: { name: string; tasks: BoardTask[] }[];
};

const boardCache = new Map<"open" | "completed", { at: number; board: BoardData }>();

export function invalidateBoardCache() {
  boardCache.clear();
}

export type BoardTask = {
  id: string;
  title: string;
  key: string | null;
  bucket: string;
  status: "Not Started" | "In Progress" | "Completed";
  percentComplete: number;
  dueDate: string | null;
  dueSource: "jira" | "planner" | null;
};

export type ChecklistItem = {
  id: string;
  title: string;
  isChecked: boolean;
};

type PlannerTask = {
  id: string;
  title: string;
  percentComplete?: number;
  dueDateTime?: string | null;
  bucketId?: string;
};

type ChecklistRaw = {
  title?: string;
  isChecked?: boolean;
  orderHint?: string;
};

function statusOf(percent: number): BoardTask["status"] {
  if (percent >= 100) return "Completed";
  if (percent > 0) return "In Progress";
  return "Not Started";
}

function plannerDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

function jiraKey(title: string): string | null {
  const match = /^\[([A-Z][A-Z0-9]+-\d+)\]/.exec(title);
  return match?.[1] ?? null;
}

function personRank(name: string): number {
  const index = PERSON_ORDER.indexOf(name);
  return index === -1 ? PERSON_ORDER.length : index;
}

async function resolvePlanId(token: string): Promise<string> {
  if (ENV_PLAN_ID) return ENV_PLAN_ID;
  throw new Error("MS_PLAN_ID тохируулаагүй байна");
}

async function listTasks(token: string, planId: string): Promise<PlannerTask[]> {
  const items: PlannerTask[] = [];
  let path: string | null = `/planner/plans/${planId}/tasks`;
  while (path) {
    const data = (await graphGet(token, path)) as {
      value?: PlannerTask[];
      "@odata.nextLink"?: string;
    };
    items.push(...(data.value ?? []));
    const next = data["@odata.nextLink"];
    path = next ? next.replace("https://graph.microsoft.com/v1.0", "") : null;
  }
  return items;
}

async function jiraDueDates(keys: string[]): Promise<Map<string, string | null>> {
  const due = new Map<string, string | null>();
  if (!keys.length || !JIRA_BASE_URL) return due;

  for (let i = 0; i < keys.length; i += 40) {
    const chunk = keys.slice(i, i + 40);
    const url = new URL(`${JIRA_BASE_URL}/rest/api/3/search/jql`);
    url.searchParams.set("jql", `key in (${chunk.join(",")})`);
    url.searchParams.set("fields", "duedate");
    url.searchParams.set("maxResults", "50");

    let pageToken: string | null = null;
    do {
      if (pageToken) url.searchParams.set("nextPageToken", pageToken);
      const response = await fetch(url.toString(), {
        headers: { Authorization: getJiraAuthHeader(), Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) break;
      const data = (await response.json()) as {
        issues?: { key: string; fields?: { duedate?: string | null } }[];
        nextPageToken?: string;
      };
      for (const issue of data.issues ?? []) {
        due.set(issue.key, issue.fields?.duedate ?? null);
      }
      pageToken = data.nextPageToken ?? null;
    } while (pageToken);
  }

  return due;
}

export async function loadBoard(
  scope: "open" | "completed" = "open",
  options?: { fresh?: boolean }
): Promise<BoardData> {
  const cached = boardCache.get(scope);
  if (!options?.fresh && cached && Date.now() - cached.at < BOARD_CACHE_MS) {
    return cached.board;
  }

  const token = await getMsToken();
  const planId = await resolvePlanId(token);
  const [tasks, bucketData] = await Promise.all([
    listTasks(token, planId),
    graphGet(token, `/planner/plans/${planId}/buckets`) as Promise<{
      value?: { id: string; name: string }[];
    }>,
  ]);

  const visible = tasks.filter((task) => {
    const done = (task.percentComplete ?? 0) >= 100;
    return scope === "completed" ? done : !done;
  });

  const bucketName = new Map((bucketData.value ?? []).map((bucket) => [bucket.id, bucket.name]));
  const keys = visible.map((task) => jiraKey(task.title)).filter((key): key is string => !!key);
  let dues = new Map<string, string | null>();
  try {
    dues = await jiraDueDates(keys);
  } catch {
    dues = new Map();
  }

  const grouped = new Map<string, BoardTask[]>();
  for (const name of bucketData.value ?? []) {
    if (!grouped.has(name.name)) grouped.set(name.name, []);
  }

  for (const task of visible) {
    const bucket = bucketName.get(task.bucketId ?? "") ?? "Хувиарилаагүй";
    const key = jiraKey(task.title);
    const jiraDue = key ? dues.get(key) ?? null : null;
    const plannerDue = plannerDay(task.dueDateTime);
    const dueDate = plannerDue || jiraDue;
    const item: BoardTask = {
      id: task.id,
      title: task.title,
      key,
      bucket,
      status: statusOf(task.percentComplete ?? 0),
      percentComplete: task.percentComplete ?? 0,
      dueDate,
      dueSource: plannerDue ? "planner" : jiraDue ? "jira" : null,
    };
    const list = grouped.get(bucket) ?? [];
    list.push(item);
    grouped.set(bucket, list);
  }

  const people = Array.from(grouped.entries())
    .map(([name, personTasks]) => ({
      name,
      tasks: personTasks.sort((a, b) => {
        if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
          return a.dueDate < b.dueDate ? -1 : 1;
        }
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return a.title.localeCompare(b.title);
      }),
    }))
    .sort((a, b) => personRank(a.name) - personRank(b.name) || a.name.localeCompare(b.name));

  const board = {
    planUrl: `https://planner.cloud.microsoft/webui/plan/${planId}/view/board`,
    people,
  };
  boardCache.set(scope, { at: Date.now(), board });
  return board;
}

export function assertPlannerTaskId(taskId: string) {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(taskId)) {
    throw new Error("taskId буруу");
  }
}

function readChecklist(raw: Record<string, ChecklistRaw> | null | undefined): ChecklistItem[] {
  return Object.entries(raw ?? {})
    .filter(([, item]) => item && typeof item.title === "string")
    .map(([id, item]) => ({
      id,
      title: item.title ?? "",
      isChecked: !!item.isChecked,
      orderHint: item.orderHint ?? "",
    }))
    .sort((a, b) => a.orderHint.localeCompare(b.orderHint) || a.title.localeCompare(b.title))
    .map(({ id, title, isChecked }) => ({ id, title, isChecked }));
}

async function taskDetails(token: string, taskId: string) {
  return (await graphGet(token, `/planner/tasks/${taskId}/details`)) as {
    "@odata.etag": string;
    checklist?: Record<string, ChecklistRaw>;
  };
}

export async function loadChecklist(taskId: string): Promise<ChecklistItem[]> {
  assertPlannerTaskId(taskId);
  const token = await getMsToken();
  const details = await taskDetails(token, taskId);
  return readChecklist(details.checklist);
}

export async function addChecklistItem(taskId: string, title: string): Promise<ChecklistItem[]> {
  assertPlannerTaskId(taskId);
  const text = title.trim();
  if (!text) throw new Error("task-ийн нэр хоосон байна");
  if (text.length > 100) throw new Error("task 100 тэмдэгтээс богино байна");

  const token = await getMsToken();
  const details = await taskDetails(token, taskId);
  const itemId = crypto.randomUUID();
  await graphPatch(
    token,
    `/planner/tasks/${taskId}/details`,
    {
      checklist: {
        [itemId]: {
          "@odata.type": "#microsoft.graph.plannerChecklistItem",
          title: text,
          isChecked: false,
          orderHint: " !",
        },
      },
    },
    details["@odata.etag"]
  );
  return loadChecklist(taskId);
}

function assertChecklistItemId(itemId: string) {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(itemId)) throw new Error("task-ийн id буруу");
}

export async function renameChecklistItem(
  taskId: string,
  itemId: string,
  title: string
): Promise<ChecklistItem[]> {
  assertPlannerTaskId(taskId);
  assertChecklistItemId(itemId);
  const text = title.trim();
  if (!text) throw new Error("task-ийн нэр хоосон байна");
  if (text.length > 100) throw new Error("task 100 тэмдэгтээс богино байна");

  const token = await getMsToken();
  const details = await taskDetails(token, taskId);
  await graphPatch(
    token,
    `/planner/tasks/${taskId}/details`,
    {
      checklist: {
        [itemId]: {
          "@odata.type": "#microsoft.graph.plannerChecklistItem",
          title: text,
        },
      },
    },
    details["@odata.etag"]
  );
  return loadChecklist(taskId);
}

function assertDueDay(dueDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw new Error("Огноо буруу");
  const parsed = new Date(`${dueDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || plannerDay(parsed.toISOString()) !== dueDate) {
    throw new Error("Огноо буруу");
  }
}

export async function setChecklistChecked(
  taskId: string,
  itemId: string,
  isChecked: boolean
): Promise<ChecklistItem[]> {
  assertPlannerTaskId(taskId);
  assertChecklistItemId(itemId);

  const token = await getMsToken();
  const details = await taskDetails(token, taskId);
  await graphPatch(
    token,
    `/planner/tasks/${taskId}/details`,
    {
      checklist: {
        [itemId]: {
          "@odata.type": "#microsoft.graph.plannerChecklistItem",
          isChecked,
        },
      },
    },
    details["@odata.etag"]
  );
  return loadChecklist(taskId);
}

export async function setTaskDueDate(taskId: string, dueDate: string | null): Promise<void> {
  assertPlannerTaskId(taskId);
  if (dueDate !== null) assertDueDay(dueDate);

  invalidateBoardCache();
  const token = await getMsToken();
  const task = (await graphGet(token, `/planner/tasks/${taskId}`)) as { "@odata.etag": string };
  await graphPatch(
    token,
    `/planner/tasks/${taskId}`,
    { dueDateTime: dueDate ? `${dueDate}T00:00:00Z` : null },
    task["@odata.etag"]
  );
}

export async function deleteChecklistItem(taskId: string, itemId: string): Promise<ChecklistItem[]> {
  assertPlannerTaskId(taskId);
  assertChecklistItemId(itemId);

  const token = await getMsToken();
  const details = await taskDetails(token, taskId);
  await graphPatch(
    token,
    `/planner/tasks/${taskId}/details`,
    { checklist: { [itemId]: null } },
    details["@odata.etag"]
  );
  return loadChecklist(taskId);
}
