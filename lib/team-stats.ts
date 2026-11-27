import { getMsToken, graphGet } from "@/lib/graph";
import { listTasks, personRank, resolvePlanId, type PlannerTask } from "@/lib/planner-board";
import { addDays, ubDay, weekStart, type MemberStats } from "@/lib/team-catalog";

const CACHE_MS = 3 * 60 * 1000;
const UNASSIGNED = "Хувиарилаагүй";

export type TeamMemberRaw = {
  id: string;
  name: string;
  stats: MemberStats;
};

let cache: { at: number; members: TeamMemberRaw[] } | null = null;

export function memberIdOf(name: string): string {
  return name.trim().toLowerCase();
}

function isWeekday(day: string): boolean {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
  return dow !== 0 && dow !== 6;
}

function diffDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(value * 10) / 10;
}

function computeStreak(byDay: Map<string, number>, today: string): number {
  let day = today;
  // Өнөөдөр хараахан дуусгаагүй бол streak тасрахгүй — өчигдрөөс тоолно
  if (!byDay.get(today)) day = addDays(today, -1);
  let streak = 0;
  for (let guard = 0; guard < 400; guard++) {
    if (!isWeekday(day)) {
      if (byDay.get(day)) streak++; // амралтын өдөр ажилласан бол урамшуулна
      day = addDays(day, -1);
      continue;
    }
    if (!byDay.get(day)) break;
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

export function computeStats(tasks: PlannerTask[], today = ubDay()): MemberStats {
  const byDay = new Map<string, number>();
  const cycles: number[] = [];
  const thisWeek = weekStart(today);
  const daily = new Array<number>(84).fill(0);
  const weekly = new Array<number>(8).fill(0);

  const s: MemberStats = {
    open: 0,
    inProgress: 0,
    overdue: 0,
    dueSoon: 0,
    completedTotal: 0,
    completed7: 0,
    completedPrev7: 0,
    completed30: 0,
    onTimeRate: null,
    onTimeCount: 0,
    onTimeSamples: 0,
    medianCycleDays: null,
    streak: 0,
    bestDay: null,
    daily,
    weekly,
  };

  for (const task of tasks) {
    const percent = task.percentComplete ?? 0;
    const due = task.dueDateTime ? ubDay(new Date(task.dueDateTime)) : null;

    if (percent < 100) {
      s.open++;
      if (percent > 0) s.inProgress++;
      if (due && due < today) s.overdue++;
      else if (due && diffDays(today, due) <= 3) s.dueSoon++;
      continue;
    }

    s.completedTotal++;
    if (!task.completedDateTime) continue;
    const doneAt = new Date(task.completedDateTime);
    const doneDay = ubDay(doneAt);
    const ago = diffDays(doneDay, today);

    byDay.set(doneDay, (byDay.get(doneDay) ?? 0) + 1);
    if (ago >= 0 && ago < 7) s.completed7++;
    else if (ago >= 7 && ago < 14) s.completedPrev7++;
    if (ago >= 0 && ago < 30) s.completed30++;
    if (ago >= 0 && ago < 84) daily[83 - ago]++;

    const weeksAgo = Math.round(diffDays(weekStart(doneDay), thisWeek) / 7);
    if (weeksAgo >= 0 && weeksAgo < 8) weekly[7 - weeksAgo]++;

    if (ago < 90) {
      if (due) {
        s.onTimeSamples++;
        if (doneDay <= due) s.onTimeCount++;
      }
      if (task.createdDateTime) {
        const days = (doneAt.getTime() - new Date(task.createdDateTime).getTime()) / 86_400_000;
        if (days >= 0) cycles.push(days);
      }
    }
  }

  s.onTimeRate = s.onTimeSamples ? s.onTimeCount / s.onTimeSamples : null;
  s.medianCycleDays = median(cycles);
  s.streak = computeStreak(byDay, today);
  for (const [day, count] of byDay) {
    if (!s.bestDay || count > s.bestDay.count) s.bestDay = { day, count };
  }
  return s;
}

/** Planner-ийн bucket бүрийг багийн гишүүн гэж үзээд статистик гаргана */
export async function loadTeamStats(options?: { fresh?: boolean }): Promise<TeamMemberRaw[]> {
  if (!options?.fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.members;

  const token = await getMsToken();
  const planId = await resolvePlanId(token);
  const [tasks, bucketData] = await Promise.all([
    listTasks(token, planId),
    graphGet(token, `/planner/plans/${planId}/buckets`) as Promise<{
      value?: { id: string; name: string }[];
    }>,
  ]);

  const bucketName = new Map((bucketData.value ?? []).map((b) => [b.id, b.name.trim()]));
  const grouped = new Map<string, PlannerTask[]>();
  for (const name of bucketName.values()) grouped.set(name, []);
  for (const task of tasks) {
    const name = bucketName.get(task.bucketId ?? "");
    if (!name) continue;
    grouped.get(name)!.push(task);
  }

  const today = ubDay();
  const members = [...grouped.entries()]
    .filter(([name]) => name && name !== UNASSIGNED)
    .map(([name, list]) => ({ id: memberIdOf(name), name, stats: computeStats(list, today) }))
    .sort((a, b) => personRank(a.name) - personRank(b.name) || a.name.localeCompare(b.name));

  cache = { at: Date.now(), members };
  return members;
}
