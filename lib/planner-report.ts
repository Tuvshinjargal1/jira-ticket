/**
 * Microsoft Planner тайлан үүсгэх модуль
 * Graph API-аас таск уншиж, Teams-д илгээх өдрийн digest форматтай мессеж болгоно.
 */
import { getMsToken, graphGet } from "@/lib/graph";

const GP_GROUP_NAME = process.env.MS_GROUP_NAME ?? "GP Team";
const ENV_PLAN_ID = process.env.MS_PLAN_ID ?? "";

// ── Types ────────────────────────────────────────────────────────────────────

interface PlanInfo {
  id: string;
  title: string;
}

interface PlannerTask {
  id: string;
  title: string;
  percentComplete: number;
  dueDateTime: string | null;
  createdDateTime?: string | null;
  startDateTime?: string | null;
  completedDateTime?: string | null;
  assignments: Record<string, unknown>;
  planId: string;
  bucketId: string;
}

export interface ActiveTask extends PlannerTask {
  planTitle: string;
}

export interface TaskStats {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  overdue: number;
  activeTasks: ActiveTask[];
}

export interface ReportMember {
  email: string;
  displayName: string;
}

export interface MemberReport {
  displayName: string;
  email: string;
  stats: TaskStats;
  message: string;
}

// ── Graph helpers ─────────────────────────────────────────────────────────────

async function findGroupId(token: string): Promise<string> {
  const data = (await graphGet(
    token,
    `/groups?$filter=displayName eq '${GP_GROUP_NAME}'&$select=id,displayName`
  )) as { value: { id: string }[] };

  if (!data.value?.length) {
    throw new Error(`"${GP_GROUP_NAME}" group олдсонгүй`);
  }
  return data.value[0].id;
}

async function getAllPlans(token: string): Promise<PlanInfo[]> {
  if (ENV_PLAN_ID) {
    const plan = (await graphGet(token, `/planner/plans/${ENV_PLAN_ID}`)) as PlanInfo;
    return [{ id: plan.id, title: plan.title }];
  }

  const groupId = await findGroupId(token);
  const data = (await graphGet(token, `/groups/${groupId}/planner/plans`)) as {
    value: PlanInfo[];
  };
  return (data.value ?? []).map((p) => ({ id: p.id, title: p.title }));
}

async function getTasksForPlan(token: string, planId: string): Promise<PlannerTask[]> {
  const data = (await graphGet(token, `/planner/plans/${planId}/tasks`)) as {
    value: PlannerTask[];
  };
  return data.value ?? [];
}

async function findUserId(token: string, email: string): Promise<string | null> {
  try {
    const filter = encodeURIComponent(
      `mail eq '${email}' or userPrincipalName eq '${email}'`
    );
    const data = (await graphGet(
      token,
      `/users?$filter=${filter}&$select=id`
    )) as { value: { id: string }[] };

    return data.value?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

// ── Task helpers ──────────────────────────────────────────────────────────────

function isOverdue(task: PlannerTask): boolean {
  if (!task.dueDateTime || task.percentComplete === 100) return false;
  return new Date(task.dueDateTime) < new Date();
}

function taskStatus(task: PlannerTask): "completed" | "inProgress" | "notStarted" {
  if (task.percentComplete === 100) return "completed";
  if (task.percentComplete > 0) return "inProgress";
  return "notStarted";
}

function daysBetween(fromIso: string | null | undefined, to = new Date()): number {
  if (!fromIso) return 0;
  const ms = to.getTime() - new Date(fromIso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function taskAgeDays(task: PlannerTask): number {
  return daysBetween(task.startDateTime || task.createdDateTime);
}

function extractKey(title: string): string | null {
  const m = /^\[([A-Z]+-\d+)\]/.exec(title);
  return m?.[1] ?? null;
}

function shortTitle(title: string): string {
  return title.replace(/^\[[A-Z]+-\d+\]\s*/, "").trim() || title;
}

function startOfYesterday(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 1);
  return d;
}

function startOfToday(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

function completedSince(task: PlannerTask, since: Date): boolean {
  if (task.percentComplete < 100) return false;
  if (task.completedDateTime) {
    return new Date(task.completedDateTime) >= since;
  }
  // completedDateTime байхгүй бол сүүлийн 7 хоногт "дууссан" гэж тоолохгүй — зөвхөн явцын статистикт
  return false;
}

function formatDueDate(dueDateTime: string | null): string {
  if (!dueDateTime) return "";
  const d = new Date(dueDateTime);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return ` (${mm}/${dd})`;
}

// ── Stats collector ───────────────────────────────────────────────────────────

async function fetchUserTaskStats(
  userId: string,
  plans: PlanInfo[],
  allTasks: Map<string, PlannerTask[]>
): Promise<TaskStats> {
  let total = 0,
    completed = 0,
    inProgress = 0,
    notStarted = 0,
    overdue = 0;
  const activeTasks: ActiveTask[] = [];

  for (const plan of plans) {
    const tasks = allTasks.get(plan.id) ?? [];
    const mine = tasks.filter((t) => userId in (t.assignments ?? {}));

    for (const task of mine) {
      total++;
      const st = taskStatus(task);
      if (st === "completed") completed++;
      else if (st === "inProgress") inProgress++;
      else notStarted++;

      if (isOverdue(task)) overdue++;

      if (st !== "completed") {
        activeTasks.push({ ...task, planTitle: plan.title });
      }
    }
  }

  activeTasks.sort((a, b) => {
    const aOd = isOverdue(a) ? 0 : 1;
    const bOd = isOverdue(b) ? 0 : 1;
    if (aOd !== bOd) return aOd - bOd;
    if (a.dueDateTime && b.dueDateTime) {
      return new Date(a.dueDateTime).getTime() - new Date(b.dueDateTime).getTime();
    }
    return 0;
  });

  return { total, completed, inProgress, notStarted, overdue, activeTasks };
}

// ── Message formatters ────────────────────────────────────────────────────────

export function formatUserReport(displayName: string, stats: TaskStats): string {
  const lines: string[] = [];

  lines.push(`**${displayName}-ийн таск-уудын тойм:**`);
  lines.push(`🗂️ **Нийт статус:**`);
  lines.push(`• Нийт таск: ${stats.total}`);
  lines.push(`• Дууссан: ${stats.completed} ✓`);
  lines.push(`• Явагдаж байгаа: ${stats.inProgress} 🔄`);
  lines.push(`• Эхлээгүй: ${stats.notStarted} ⏳`);
  lines.push(`• Хугацаа хэтэрсэн: ${stats.overdue} 🔴`);

  if (stats.activeTasks.length > 0) {
    lines.push(``);
    lines.push(`**Идэвхтэй таск (явагдаж байгаа, эхлээгүй):**`);

    stats.activeTasks.forEach((task, i) => {
      const due = formatDueDate(task.dueDateTime);
      const overdueFlag = isOverdue(task) ? " 🔴 ХУГАЦАА ХЭТЭРСЭН" : "";
      const statusMn = taskStatus(task) === "inProgress" ? "Явагдаж байгаа" : "Эхлээгүй";

      lines.push(`${i + 1}. **${task.title}**${due}${overdueFlag}`);
      lines.push(`   • Статус: ${statusMn}`);
      lines.push(`   • План: ${task.planTitle}`);
    });
  }

  return lines.join("\n");
}

/**
 * Өдрийн нэг удаагийн digest — standup формат.
 */
export function formatDailyDigest(opts: {
  reports: MemberReport[];
  allTasks: PlannerTask[];
  userIdToName: Map<string, string>;
}): string {
  const { reports, allTasks, userIdToName } = opts;
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  }).toUpperCase();

  let done = 0,
    inFlight = 0,
    notStarted = 0;
  for (const t of allTasks) {
    const st = taskStatus(t);
    if (st === "completed") done++;
    else if (st === "inProgress") inFlight++;
    else notStarted++;
  }
  const total = done + inFlight + notStarted;

  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const shipped7d = allTasks.filter((t) => completedSince(t, weekAgo)).length;

  const yStart = startOfYesterday(now);
  const tStart = startOfToday(now);
  const yesterdayWins = allTasks
    .filter((t) => {
      if (t.percentComplete < 100 || !t.completedDateTime) return false;
      const c = new Date(t.completedDateTime);
      return c >= yStart && c < tStart;
    })
    .sort(
      (a, b) =>
        new Date(b.completedDateTime!).getTime() -
        new Date(a.completedDateTime!).getTime()
    );

  const focus = allTasks
    .filter((t) => taskStatus(t) === "inProgress")
    .map((t) => ({
      task: t,
      age: taskAgeDays(t),
      assignees: Object.keys(t.assignments ?? {})
        .map((id) => userIdToName.get(id))
        .filter(Boolean) as string[],
    }))
    .sort((a, b) => b.age - a.age)
    .slice(0, 8);

  const crew = reports.filter((r) => r.stats.total > 0 || r.stats.activeTasks.length > 0);

  const lines: string[] = [];
  lines.push(`**GP Daily · ${dateStr}**`);
  lines.push(
    `${done}/${total} done · ${inFlight} in flight · ${notStarted} not started`
  );
  lines.push(
    `${shipped7d} completed · ${crew.length} crew — last 7 days`
  );
  lines.push(``);

  lines.push(`**🎯 Today's focus**`);
  if (!focus.length) {
    lines.push(`Явагдаж байгаа таск байхгүй.`);
  } else {
    for (const f of focus) {
      const key = extractKey(f.task.title);
      const label = key ?? f.task.title;
      const title = shortTitle(f.task.title);
      const who = f.assignees[0] ?? "—";
      const snail = f.age >= 7 ? "🐌 " : "";
      lines.push(
        `${snail}**${label}** ${title} — in progress ${f.age}d · ${who}`
      );
    }
  }
  lines.push(``);

  lines.push(`**👥 Who's on what today**`);
  const sorted = [...reports].sort(
    (a, b) => b.stats.inProgress - a.stats.inProgress || b.stats.activeTasks.length - a.stats.activeTasks.length
  );
  for (const r of sorted) {
    const active = r.stats.activeTasks;
    if (!active.length) {
      lines.push(`${r.displayName} — —`);
      continue;
    }
    const bits = active.slice(0, 6).map((t) => {
      const key = extractKey(t.title) ?? t.title.slice(0, 24);
      const age = taskAgeDays(t);
      const st = taskStatus(t);
      return st === "inProgress" && age > 0 ? `${key} (${age}d)` : key;
    });
    const warn =
      r.stats.inProgress >= 4 ? ` — ⚠ ${r.stats.inProgress} in flight` : "";
    lines.push(`${r.displayName} — ${bits.join(" · ")}${warn}`);
  }
  lines.push(``);

  lines.push(`**🎉 Yesterday's wins**`);
  if (!yesterdayWins.length) {
    lines.push(`Өчигдөр Complete болсон таск байхгүй.`);
  } else {
    for (const t of yesterdayWins.slice(0, 12)) {
      const key = extractKey(t.title);
      const title = shortTitle(t.title);
      const who =
        Object.keys(t.assignments ?? {})
          .map((id) => userIdToName.get(id))
          .find(Boolean) ?? "—";
      lines.push(`✅ ${key ? `**${key}** ` : ""}${title} — ${who}`);
    }
  }

  return lines.join("\n");
}

/** @deprecated — formatDailyDigest ашиглана */
export function formatTeamReport(reports: MemberReport[]): string {
  return formatDailyDigest({
    reports,
    allTasks: reports.flatMap((r) =>
      r.stats.activeTasks.map((t) => t as PlannerTask)
    ),
    userIdToName: new Map(reports.map((r) => [r.email, r.displayName])),
  });
}

export function formatMorningMessage(displayName: string, stats: TaskStats): string {
  const lines: string[] = [];
  const greeting = new Date().getHours() < 10 ? "Өглөөний мэнд" : "Өдрийн мэнд";

  lines.push(`☀️ **${greeting}, ${displayName}!**`);
  lines.push(``);

  if (stats.activeTasks.length === 0) {
    lines.push(`🎉 Өнөөдөр идэвхтэй таск байхгүй байна. Сайн ажиллаарай!`);
    return lines.join("\n");
  }

  lines.push(`**Өнөөдрийн таскийн жагсаалт (${stats.activeTasks.length}):**`);

  const overdueList = stats.activeTasks.filter(isOverdue);
  if (overdueList.length > 0) {
    lines.push(``);
    lines.push(`🔴 **Хугацаа хэтэрсэн (анхаарах):**`);
    overdueList.forEach((t) => {
      lines.push(`• **${t.title}**${formatDueDate(t.dueDateTime)}`);
    });
  }

  const active = stats.activeTasks.filter((t) => !isOverdue(t));
  if (active.length > 0) {
    lines.push(``);
    lines.push(`📋 **Хийх ажлууд:**`);
    active.forEach((t, i) => {
      const due = formatDueDate(t.dueDateTime);
      lines.push(`${i + 1}. ${t.title}${due}`);
    });
  }

  lines.push(``);
  lines.push(`Сайн ажиллаарай! 💪`);

  return lines.join("\n");
}

export function formatEveningMessage(displayName: string, stats: TaskStats): string {
  const lines: string[] = [];

  lines.push(`🌙 **Орой болж байна, ${displayName}!**`);
  lines.push(``);

  if (stats.activeTasks.length === 0) {
    lines.push(`🎉 Бүх таскаа дуусгасан байна. Баярлалаа!`);
    return lines.join("\n");
  }

  lines.push(`**Дуусаагүй таск байна (${stats.activeTasks.length}):**`);
  stats.activeTasks.forEach((t, i) => {
    const statusMn = taskStatus(t) === "inProgress" ? "явагдаж байгаа" : "эхлээгүй";
    lines.push(`${i + 1}. **${t.title}** — ${statusMn}`);
  });

  lines.push(``);
  lines.push(
    `Дуусгасан таскаа **Done** болгоно уу! ` +
      `Эсвэл маргаашид шилжүүлэх бол огноог шинэчлээрэй.`
  );

  return lines.join("\n");
}

// ── Main export ───────────────────────────────────────────────────────────────

export type ReportType = "daily" | "morning" | "evening" | "team" | "digest";

export async function generateReports(
  members: ReportMember[],
  reportType: ReportType = "daily"
): Promise<MemberReport[]> {
  const token = await getMsToken();
  const plans = await getAllPlans(token);

  const allTasks = new Map<string, PlannerTask[]>();
  await Promise.all(
    plans.map(async (plan) => {
      const tasks = await getTasksForPlan(token, plan.id);
      allTasks.set(plan.id, tasks);
    })
  );

  const reports = await Promise.all(
    members.map(async (member) => {
      const userId = await findUserId(token, member.email);

      if (!userId) {
        const stats: TaskStats = {
          total: 0,
          completed: 0,
          inProgress: 0,
          notStarted: 0,
          overdue: 0,
          activeTasks: [],
        };
        return {
          displayName: member.displayName,
          email: member.email,
          stats,
          message: `⚠️ ${member.displayName}: Microsoft хэрэглэгч олдсонгүй (${member.email})`,
        };
      }

      const stats = await fetchUserTaskStats(userId, plans, allTasks);

      let message: string;
      switch (reportType) {
        case "morning":
          message = formatMorningMessage(member.displayName, stats);
          break;
        case "evening":
          message = formatEveningMessage(member.displayName, stats);
          break;
        default:
          message = formatUserReport(member.displayName, stats);
      }

      return { displayName: member.displayName, email: member.email, stats, message };
    })
  );

  return reports;
}

/** Өдрийн нэг удаагийн багийн digest үүсгэнэ */
export async function generateDailyDigest(
  members: ReportMember[]
): Promise<{ message: string; reports: MemberReport[] }> {
  const token = await getMsToken();
  const plans = await getAllPlans(token);

  const allTasksMap = new Map<string, PlannerTask[]>();
  await Promise.all(
    plans.map(async (plan) => {
      const tasks = await getTasksForPlan(token, plan.id);
      allTasksMap.set(plan.id, tasks);
    })
  );

  const flatTasks = [...allTasksMap.values()].flat();
  const userIdToName = new Map<string, string>();

  const reports = await Promise.all(
    members.map(async (member) => {
      const userId = await findUserId(token, member.email);
      if (userId) userIdToName.set(userId, member.displayName);

      if (!userId) {
        const stats: TaskStats = {
          total: 0,
          completed: 0,
          inProgress: 0,
          notStarted: 0,
          overdue: 0,
          activeTasks: [],
        };
        return {
          displayName: member.displayName,
          email: member.email,
          stats,
          message: "",
        };
      }

      const stats = await fetchUserTaskStats(userId, plans, allTasksMap);
      return {
        displayName: member.displayName,
        email: member.email,
        stats,
        message: "",
      };
    })
  );

  const message = formatDailyDigest({
    reports,
    allTasks: flatTasks,
    userIdToName,
  });

  return { message, reports };
}
