/**
 * Microsoft Planner тайлан үүсгэх модуль
 * Graph API-аас таск уншиж, Teams-д илгээх форматтай мессеж болгоно.
 */
import { getMsToken, graphGet } from "@/lib/graph";

const GP_GROUP_NAME = process.env.MS_GROUP_NAME ?? "GP Team";
const ENV_PLAN_ID   = process.env.MS_PLAN_ID   ?? "";

// ── Types ────────────────────────────────────────────────────────────────────

interface PlanInfo {
  id: string;
  title: string;
}

interface PlannerTask {
  id: string;
  title: string;
  percentComplete: number;           // 0 = эхлээгүй, 1-99 = явагдаж байгаа, 100 = дууссан
  dueDateTime: string | null;
  assignments: Record<string, unknown>; // { userId: assignmentObj }
  planId: string;
  bucketId: string;
}

export interface ActiveTask extends PlannerTask {
  planTitle: string;
}

export interface TaskStats {
  total:      number;
  completed:  number;
  inProgress: number;
  notStarted: number;
  overdue:    number;
  activeTasks: ActiveTask[];         // дуусаагүй таскуудын жагсаалт
}

export interface ReportMember {
  email: string;
  displayName: string;
}

export interface MemberReport {
  displayName: string;
  email: string;
  stats: TaskStats;
  message: string;                   // Teams-д бэлэн мессеж
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
  if (task.percentComplete > 0)    return "inProgress";
  return "notStarted";
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
  let total = 0, completed = 0, inProgress = 0, notStarted = 0, overdue = 0;
  const activeTasks: ActiveTask[] = [];

  for (const plan of plans) {
    const tasks = allTasks.get(plan.id) ?? [];
    const mine  = tasks.filter((t) => userId in (t.assignments ?? {}));

    for (const task of mine) {
      total++;
      const st = taskStatus(task);
      if (st === "completed")  completed++;
      else if (st === "inProgress") inProgress++;
      else                          notStarted++;

      if (isOverdue(task)) overdue++;

      if (st !== "completed") {
        activeTasks.push({ ...task, planTitle: plan.title });
      }
    }
  }

  // Эрэмбэ: хугацаа хэтэрсэн эхэнд, дараа нь дуусах огноогоор
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

/**
 * Нэгж хүний таскийн тойм — screenshot-н форматтай тохирно.
 */
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
      const due         = formatDueDate(task.dueDateTime);
      const overdueFlag = isOverdue(task) ? " 🔴 ХУГАЦАА ХЭТЭРСЭН" : "";
      const statusMn    = taskStatus(task) === "inProgress" ? "Явагдаж байгаа" : "Эхлээгүй";

      lines.push(`${i + 1}. **${task.title}**${due}${overdueFlag}`);
      lines.push(`   • Статус: ${statusMn}`);
      lines.push(`   • План: ${task.planTitle}`);
    });
  }

  lines.push(``);
  lines.push(
    `Бусад ${stats.completed} таск дууссан байна. ` +
    `Дэлгэрэнгүй мэдээлэл авахыг хүсэж байна уу? Жишээлбэл:`
  );
  lines.push(`• Энэ 7 хоног дотор дуусах таск`);
  lines.push(`• Энэ сарын таск`);
  lines.push(`• Тодорхой план-ын таск`);

  return lines.join("\n");
}

/**
 * Бүх багийн нэгдсэн тойм — удирдлагад илгээх тайлан.
 */
export function formatTeamReport(reports: MemberReport[]): string {
  const now     = new Date();
  const dateStr = now.toLocaleDateString("mn-MN", {
    year: "numeric", month: "long", day: "numeric",
  });

  const lines: string[] = [];
  lines.push(`📊 **Багийн таскийн тайлан — ${dateStr}**`);
  lines.push(``);

  // Хүн тус бүрийн хураангуй
  const maxTotal = Math.max(...reports.map((r) => r.stats.total), 1);

  for (const r of reports) {
    const s   = r.stats;
    const bar = "█".repeat(Math.round((s.total / maxTotal) * 8)) || "░";
    lines.push(`👤 **${r.displayName}**`);
    lines.push(`   ${bar} Нийт: ${s.total} | ✅ ${s.completed} | 🔄 ${s.inProgress} | ⏳ ${s.notStarted} | 🔴 ${s.overdue}`);

    if (s.overdue > 0) {
      const first = s.activeTasks.find(isOverdue);
      if (first) lines.push(`   ⚠️ Хугацаа хэтэрсэн: **${first.title}**`);
    }
  }

  // Хамгийн ачаалалтай → ачаалал бага гэж эрэмбэлнэ
  lines.push(``);
  lines.push(`📈 **Таскийн ачаалал (их → бага):**`);
  [...reports]
    .sort((a, b) => b.stats.total - a.stats.total)
    .forEach((r, i) => {
      lines.push(`${i + 1}. ${r.displayName} — ${r.stats.total} таск`);
    });

  // Хугацаа хэтэрсэн хүмүүс
  const overdue = reports.filter((r) => r.stats.overdue > 0);
  if (overdue.length > 0) {
    lines.push(``);
    lines.push(`🚨 **Хугацаа хэтэрсэн таск бүхий хүмүүс:**`);
    overdue.forEach((r) => {
      lines.push(`• ${r.displayName}: ${r.stats.overdue} таск`);
    });
  }

  return lines.join("\n");
}

/**
 * Өглөөний мэндчилгээ — хийх ажлын жагсаалт.
 */
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

  // Хугацаа хэтэрсэн таскуудыг тусгайлан тэмдэглэнэ
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

/**
 * Оройн шалгалт — таскуудаа дуусгасан эсэхийг лавлана.
 */
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

export type ReportType = "daily" | "morning" | "evening" | "team";

export async function generateReports(
  members: ReportMember[],
  reportType: ReportType = "daily"
): Promise<MemberReport[]> {
  const token = await getMsToken();

  // 1. Бүх планыг авна
  const plans = await getAllPlans(token);

  // 2. Бүх планы таскуудыг зэрэгцээ авна
  const allTasks = new Map<string, PlannerTask[]>();
  await Promise.all(
    plans.map(async (plan) => {
      const tasks = await getTasksForPlan(token, plan.id);
      allTasks.set(plan.id, tasks);
    })
  );

  // 3. Хүн тус бүрийн тайлан үүсгэнэ
  const reports = await Promise.all(
    members.map(async (member) => {
      const userId = await findUserId(token, member.email);

      if (!userId) {
        const stats: TaskStats = {
          total: 0, completed: 0, inProgress: 0,
          notStarted: 0, overdue: 0, activeTasks: [],
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
        case "morning": message = formatMorningMessage(member.displayName, stats); break;
        case "evening": message = formatEveningMessage(member.displayName, stats); break;
        default:        message = formatUserReport(member.displayName, stats);
      }

      return { displayName: member.displayName, email: member.email, stats, message };
    })
  );

  return reports;
}
