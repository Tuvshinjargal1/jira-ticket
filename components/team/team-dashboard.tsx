"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  Clock,
  Flame,
  Gift,
  Pencil,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Trophy,
} from "lucide-react";
import {
  ACHIEVEMENTS,
  GIFT_BADGES,
  GIFT_BADGE_IDS,
  PALETTES,
  XP_RULES,
  addDays,
  ubDay,
  weekStart,
  type Gift as GiftT,
  type GiftBadgeId,
} from "@/lib/team-catalog";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Character, type Mood } from "@/components/team/character";
import { ActivityHeatmap, MiniAvatar, TeamPulseChart, WeeklyBars } from "@/components/team/charts";
import { CharacterDialog, GiftDialog } from "@/components/team/dialogs";
import { AchievementToken, GiftMedal } from "@/components/team/medal";
import { seriesColor, type TeamMember, type TeamPayload } from "@/components/team/types";

// ── Helpers ─────────────────────────────────────────────────────────────────

function moodOf(m: TeamMember): Mood {
  if (m.stats.overdue >= 3) return "tired";
  if (m.stats.completed7 > 0 || m.stats.streak >= 2) return "happy";
  return "normal";
}

function pct(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

function relTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "саяхан";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин өмнө`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} цагийн өмнө`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} өдрийн өмнө`;
  return new Date(iso).toLocaleDateString("mn-MN", { month: "short", day: "numeric" });
}

function weekLabel(today: string): string {
  const start = weekStart(today);
  const end = addDays(start, 6);
  const fmt = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  return `Энэ долоо хоног · ${fmt(start)} – ${fmt(end)}`;
}

function tint(m: TeamMember, amount: number): string {
  return `color-mix(in oklab, ${PALETTES[m.profile.palette].body} ${amount}%, transparent)`;
}

function topGifts(m: TeamMember): [GiftBadgeId, number][] {
  return GIFT_BADGE_IDS.map((id) => [id, m.giftCounts[id] ?? 0] as [GiftBadgeId, number])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
}

// ── Building blocks ─────────────────────────────────────────────────────────

function Kpi({
  label,
  value,
  icon,
  foot,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  foot?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-background/70 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="flex size-6 items-center justify-center rounded-md bg-muted text-foreground [&_svg]:size-3.5">
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
      {foot && <div className="mt-1 text-xs text-muted-foreground">{foot}</div>}
    </div>
  );
}

function XpBar({ member }: { member: TeamMember }) {
  const pal = PALETTES[member.profile.palette];
  const { into, need } = member.level;
  return (
    <div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={need}
        aria-valuenow={into}
        aria-label="Дараагийн level хүртэл"
      >
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${Math.max(4, (into / need) * 100)}%`, background: `linear-gradient(90deg, ${pal.body}, ${pal.shade})` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground tabular-nums">
        <span>{member.xp} XP</span>
        <span>
          Lv {member.level.level + 1} хүртэл {need - into}
        </span>
      </div>
    </div>
  );
}

function MemberCard({
  member,
  isMe,
  selected,
  onSelect,
  onGift,
  onEdit,
}: {
  member: TeamMember;
  isMe: boolean;
  selected: boolean;
  onSelect: () => void;
  onGift: () => void;
  onEdit: () => void;
}) {
  const s = member.stats;
  const gifts = topGifts(member);
  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
        selected && "ring-2 ring-foreground/70 ring-offset-2 ring-offset-background"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`${member.name}-ийн дэлгэрэнгүй`}
        className="relative flex h-36 items-end justify-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
        style={{ background: `radial-gradient(120% 90% at 50% 100%, ${tint(member, 30)}, ${tint(member, 6)} 70%)` }}
      >
        <span className="absolute top-3 left-3 rounded-full bg-background/80 px-2 py-0.5 text-[11px] font-semibold backdrop-blur tabular-nums">
          Lv {member.level.level}
        </span>
        <span className="absolute top-3 right-3 flex gap-1">
          {isMe && (
            <span className="rounded-full bg-foreground px-2 py-0.5 text-[11px] font-semibold text-background">Та</span>
          )}
          {s.streak > 0 && (
            <span
              className="flex items-center gap-0.5 rounded-full bg-background/80 px-2 py-0.5 text-[11px] font-semibold backdrop-blur tabular-nums"
              title={`${s.streak} ажлын өдөр дараалан`}
            >
              <Flame className="size-3 text-orange-500" /> {s.streak}
            </span>
          )}
        </span>
        <Character
          profile={member.profile}
          level={member.level.level}
          mood={moodOf(member)}
          size={118}
          label={`${member.name}-ийн character`}
          className="-mb-2 transition-transform duration-300 group-hover:scale-105"
        />
      </button>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="truncate text-base font-semibold">{member.name}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {member.tier}
            {member.profile.title && <> · <span className="italic">{member.profile.title}</span></>}
          </p>
        </div>
        <XpBar member={member} />

        <dl className="grid grid-cols-3 divide-x rounded-xl bg-muted/50 py-2 text-center">
          <div>
            <dt className="text-[10px] text-muted-foreground">7 хоногт</dt>
            <dd className="text-lg font-semibold tabular-nums">{s.completed7}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">Нээлттэй</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {s.open}
              {s.overdue > 0 && (
                <span className="ml-0.5 align-top text-[10px] font-medium text-rose-600 dark:text-rose-400" title="Хугацаа хэтэрсэн">
                  !{s.overdue}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground" title="Хугацаандаа дуусгасан, 90 хоног">Цагтаа</dt>
            <dd className="text-lg font-semibold tabular-nums">{pct(s.onTimeRate)}</dd>
          </div>
        </dl>

        <div className="flex min-h-8 items-center gap-1.5">
          {gifts.length ? (
            <>
              {gifts.slice(0, 4).map(([id, n]) => (
                <span key={id} title={`${GIFT_BADGES[id].name} × ${n}`}>
                  <GiftMedal badge={id} size={30} count={n} />
                </span>
              ))}
              {gifts.length > 4 && <span className="text-xs text-muted-foreground">+{gifts.length - 4}</span>}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Badge хүлээж байна…</span>
          )}
        </div>

        <div className="mt-auto">
          {isMe ? (
            <Button variant="outline" className="w-full" onClick={onEdit}>
              <Pencil /> Character засах
            </Button>
          ) : (
            <Button variant="outline" className="w-full" onClick={onGift}>
              <Gift className="text-rose-500" /> Badge бэлэглэх
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function StatLine({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm" title={hint}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function MemberDetail({
  member,
  index,
  data,
}: {
  member: TeamMember;
  index: number;
  data: TeamPayload;
}) {
  const s = member.stats;
  const received = data.gifts.filter((g) => g.to === member.id).slice(0, 4);
  const byId = new Map(data.members.map((m) => [m.id, m]));
  const unlocked = new Set(member.achievements);

  return (
    <section className="overflow-hidden rounded-3xl border bg-card" aria-labelledby="member-detail-title">
      <div className="grid lg:grid-cols-[300px_1fr]">
        <div
          className="flex flex-col gap-4 border-b p-6 lg:border-r lg:border-b-0"
          style={{ background: `linear-gradient(180deg, ${tint(member, 14)}, transparent 60%)` }}
        >
          <div className="flex flex-col items-center text-center">
            <Character profile={member.profile} level={member.level.level} mood={moodOf(member)} size={150} />
            <h2 id="member-detail-title" className="mt-2 text-xl font-semibold">
              {member.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              Lv {member.level.level} · {member.tier}
            </p>
            {member.profile.title && <p className="mt-0.5 text-xs italic text-muted-foreground">&ldquo;{member.profile.title}&rdquo;</p>}
          </div>
          <XpBar member={member} />
          <div className="divide-y">
            <StatLine label="Нийт дууссан" value={s.completedTotal} />
            <StatLine label="Сүүлийн 30 хоногт" value={s.completed30} />
            <StatLine label="Ажиллаж байгаа" value={s.inProgress} />
            <StatLine
              label="3 хоногт дуусах"
              value={s.dueSoon}
              hint="Хугацаа нь ойрын 3 хоногт дуусах нээлттэй task"
            />
            <StatLine
              label="Хугацаа хэтэрсэн"
              value={
                s.overdue > 0 ? (
                  <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                    <TriangleAlert className="size-3.5" /> {s.overdue}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="size-3.5" /> 0
                  </span>
                )
              }
            />
            <StatLine
              label="Дундаж шийдэх хугацаа"
              value={s.medianCycleDays === null ? "—" : `${s.medianCycleDays} хоног`}
              hint="Task үүссэнээс дуусах хүртэлх median, сүүлийн 90 хоног"
            />
            <StatLine
              label="Хугацаандаа дуусгасан"
              value={s.onTimeSamples ? `${s.onTimeCount}/${s.onTimeSamples}` : "—"}
              hint="Due date-тэй task-уудаас, сүүлийн 90 хоног"
            />
            <StatLine
              label="Шилдэг өдөр"
              value={s.bestDay ? `${s.bestDay.count} task · ${s.bestDay.day.slice(5).replace("-", "/")}` : "—"}
            />
          </div>
        </div>

        <div className="space-y-7 p-6">
          <div className="grid gap-6 md:grid-cols-[auto_1fr]">
            <div>
              <h3 className="mb-3 text-sm font-semibold">12 долоо хоногийн идэвх</h3>
              <ActivityHeatmap daily={s.daily} today={data.today} />
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold">Долоо хоног бүр дуусгасан task</h3>
              <WeeklyBars weekly={s.weekly} today={data.today} color={seriesColor(index)} />
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">Achievement</h3>
              <span className="text-xs text-muted-foreground tabular-nums">
                {unlocked.size}/{ACHIEVEMENTS.length} нээсэн
              </span>
            </div>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {ACHIEVEMENTS.map((a) => {
                const on = unlocked.has(a.id);
                return (
                  <li
                    key={a.id}
                    className={cn("flex items-center gap-2.5 rounded-xl border p-2.5", !on && "border-dashed")}
                  >
                    <AchievementToken id={a.id} unlocked={on} size={34} />
                    <div className="min-w-0">
                      <div className={cn("text-xs leading-tight font-semibold", !on && "text-muted-foreground")}>{a.name}</div>
                      <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{a.hint}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold">Сүүлд хүлээн авсан badge</h3>
            {received.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {received.map((g) => {
                  const from = byId.get(g.from);
                  return (
                    <li key={g.id} className="flex gap-3 rounded-xl bg-muted/50 p-3">
                      <GiftMedal badge={g.badge} size={36} />
                      <div className="min-w-0 text-sm">
                        <div className="font-medium">{GIFT_BADGES[g.badge].name}</div>
                        {g.message && <p className="line-clamp-2 text-xs text-muted-foreground">&ldquo;{g.message}&rdquo;</p>}
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {from?.name ?? g.fromName} · {relTime(g.at)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                Одоохондоо badge алга. Анхных нь болоорой!
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

type Metric = "xp" | "week" | "streak" | "ontime";

const METRICS: { id: Metric; label: string; value: (m: TeamMember) => number | null; format: (m: TeamMember) => string }[] = [
  { id: "xp", label: "XP", value: (m) => m.xp, format: (m) => `${m.xp} XP` },
  { id: "week", label: "7 хоног", value: (m) => m.stats.completed7, format: (m) => `${m.stats.completed7} task` },
  { id: "streak", label: "Streak", value: (m) => m.stats.streak, format: (m) => `${m.stats.streak} өдөр` },
  { id: "ontime", label: "Хугацаандаа", value: (m) => m.stats.onTimeRate, format: (m) => pct(m.stats.onTimeRate) },
];

const RANK_STYLE = [
  "bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950",
  "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900",
  "bg-gradient-to-br from-orange-300 to-orange-600 text-orange-950",
];

function Leaderboard({ members, meId }: { members: TeamMember[]; meId: string | null }) {
  const [metric, setMetric] = useState<Metric>("xp");
  const def = METRICS.find((x) => x.id === metric)!;
  const indexOf = new Map(members.map((m, i) => [m.id, i]));
  const rows = [...members].sort((a, b) => (def.value(b) ?? -1) - (def.value(a) ?? -1));
  const max = Math.max(...rows.map((m) => def.value(m) ?? 0), metric === "ontime" ? 1 : 1);

  return (
    <section className="rounded-3xl border bg-card p-5" aria-labelledby="lb-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="lb-title" className="flex items-center gap-2 font-semibold">
          <Trophy className="size-4 text-amber-500" /> Тэргүүлэгчид
        </h2>
        <div className="flex rounded-lg bg-muted p-0.5" role="tablist">
          {METRICS.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={metric === x.id}
              onClick={() => setMetric(x.id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                metric === x.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>
      <ol className="space-y-2.5">
        {rows.map((m, rank) => {
          const v = def.value(m);
          return (
            <li key={m.id} className={cn("flex items-center gap-3 rounded-xl p-2", m.id === meId && "bg-muted/60")}>
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                  v ? RANK_STYLE[rank] ?? "bg-muted text-muted-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {rank + 1}
              </span>
              <MiniAvatar member={m} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">{m.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{def.format(m)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${((v ?? 0) / max) * 100}%`, background: seriesColor(indexOf.get(m.id) ?? 0) }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        XP = дууссан task × {XP_RULES.perCompleted} + хугацаандаа × {XP_RULES.perOnTime} + хүлээн авсан badge ×{" "}
        {XP_RULES.perGift} + streak өдөр × {XP_RULES.perStreakDay}
      </p>
    </section>
  );
}

function KudosFeed({
  gifts,
  members,
  onGift,
  canGift,
}: {
  gifts: GiftT[];
  members: TeamMember[];
  onGift: () => void;
  canGift: boolean;
}) {
  const byId = new Map(members.map((m) => [m.id, m]));
  return (
    <section className="flex flex-col rounded-3xl border bg-card p-5" aria-labelledby="feed-title">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="feed-title" className="flex items-center gap-2 font-semibold">
          <Gift className="size-4 text-rose-500" /> Kudos feed
        </h2>
        <Button size="sm" onClick={onGift} disabled={!canGift}>
          <Gift /> Бэлэглэх
        </Button>
      </div>
      {gifts.length ? (
        <ol className="relative -mr-2 max-h-105 space-y-1 overflow-y-auto pr-2">
          {gifts.map((g) => {
            const to = byId.get(g.to);
            const from = byId.get(g.from);
            return (
              <li key={g.id} className="flex gap-3 rounded-xl p-2 transition-colors hover:bg-muted/50">
                <GiftMedal badge={g.badge} size={38} />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="leading-snug">
                    <span className="font-medium">{from?.name ?? g.fromName}</span>
                    <span className="text-muted-foreground"> → </span>
                    <span className="font-medium">{to?.name ?? g.to}</span>
                    <span className="text-muted-foreground"> · {GIFT_BADGES[g.badge].name}</span>
                  </p>
                  {g.message && (
                    <p className="mt-1 rounded-lg rounded-tl-sm bg-muted/70 px-2.5 py-1.5 text-xs">{g.message}</p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">{relTime(g.at)}</p>
                </div>
                {to && <MiniAvatar member={to} size={30} />}
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
          <div className="flex -space-x-3">
            {GIFT_BADGE_IDS.slice(0, 3).map((id) => (
              <GiftMedal key={id} badge={id} size={44} />
            ))}
          </div>
          <p className="text-sm font-medium">Kudos хараахан алга</p>
          <p className="max-w-60 text-xs text-muted-foreground">
            Хамт олондоо талархлаа илэрхийлж, анхны badge-ийг бэлэглээрэй.
          </p>
        </div>
      )}
    </section>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-64 rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-105 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────

async function fetchTeam(fresh: boolean): Promise<TeamPayload> {
  const res = await fetch(`/api/team${fresh ? "?fresh=1" : ""}`);
  const json = (await res.json()) as TeamPayload & { error?: string };
  if (!res.ok) throw new Error(json.error || "Мэдээлэл татаж чадсангүй");
  return json;
}

export function TeamDashboard() {
  const [data, setData] = useState<TeamPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [giftTo, setGiftTo] = useState<string | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const apply = useCallback((promise: Promise<TeamPayload>) => {
    promise
      .then((json) => {
        setData(json);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const load = (fresh = false) => {
    setLoading(true);
    apply(fetchTeam(fresh));
  };

  useEffect(() => {
    apply(fetchTeam(false));
  }, [apply]);

  const members = useMemo(() => data?.members ?? [], [data]);
  const me = data?.me ?? null;
  const myMember = members.find((m) => m.id === me?.memberId) ?? null;
  const selected = members.find((m) => m.id === selectedId) ?? myMember ?? members[0] ?? null;
  const selectedIndex = selected ? members.indexOf(selected) : 0;

  const team = useMemo(() => {
    const sum = (f: (m: TeamMember) => number) => members.reduce((a, m) => a + f(m), 0);
    const samples = sum((m) => m.stats.onTimeSamples);
    const thisWeek = data ? weekStart(data.today) : "";
    return {
      done7: sum((m) => m.stats.completed7),
      prev7: sum((m) => m.stats.completedPrev7),
      open: sum((m) => m.stats.open),
      overdue: sum((m) => m.stats.overdue),
      onTime: samples ? sum((m) => m.stats.onTimeCount) / samples : null,
      giftsWeek: (data?.gifts ?? []).filter((g) => weekStart(ubDay(new Date(g.at))) === thisWeek).length,
      giftsTotal: sum((m) => m.giftsReceived),
    };
  }, [members, data]);

  const openGift = (to: string | null) => {
    setGiftTo(to);
    setGiftOpen(true);
  };

  if (!data) {
    return error ? (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>GP Arena ачаалж чадсангүй</AlertTitle>
        <AlertDescription>
          {error}
          <Button size="sm" variant="outline" className="mt-2 w-fit" onClick={() => load(true)}>
            Дахин оролдох
          </Button>
        </AlertDescription>
      </Alert>
    ) : (
      <LoadingState />
    );
  }

  const delta = team.done7 - team.prev7;
  const canGift = !!me && me.giftsLeft > 0 && members.some((m) => m.id !== me.memberId);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border bg-card">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-40"
          style={{
            background:
              "radial-gradient(40% 60% at 0% 0%, color-mix(in oklab, var(--series-1) 18%, transparent), transparent), radial-gradient(35% 55% at 100% 0%, color-mix(in oklab, var(--series-5) 16%, transparent), transparent)",
          }}
        />
        <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                  {weekLabel(data.today)}
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                  {myMember ? `Сайн уу, ${myMember.name}!` : "Сайн уу!"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">Багийн хэмнэл, амжилт, талархал нэг дор.</p>
              </div>
              <div className="flex items-center gap-2">
                {me && (
                  <span
                    className="flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1.5 text-xs font-medium tabular-nums"
                    title="Энэ долоо хоногт бэлэглэх badge-ийн эрх"
                  >
                    <Gift className="size-3.5 text-rose-500" />
                    {me.giftsLeft}/{me.quota}
                  </span>
                )}
                <Button variant="outline" size="icon" onClick={() => load(true)} disabled={loading} aria-label="Шинэчлэх">
                  <RefreshCw className={cn(loading && "animate-spin")} />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Kpi
                label="7 хоногт дууссан"
                value={team.done7}
                icon={<CalendarCheck />}
                foot={
                  <span className="inline-flex items-center gap-1">
                    {delta >= 0 ? (
                      <TrendingUp className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <TrendingDown className="size-3.5 text-rose-600 dark:text-rose-400" />
                    )}
                    {delta >= 0 ? "+" : ""}
                    {delta} өмнөх 7 хоногоос
                  </span>
                }
              />
              <Kpi
                label="Нээлттэй task"
                value={team.open}
                icon={<Sparkles />}
                foot={
                  team.overdue > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <TriangleAlert className="size-3.5 text-rose-600 dark:text-rose-400" />
                      {team.overdue} нь хугацаа хэтэрсэн
                    </span>
                  ) : (
                    "Хугацаа хэтэрсэн task алга"
                  )
                }
              />
              <Kpi label="Хугацаандаа" value={pct(team.onTime)} icon={<Clock />} foot="Сүүлийн 90 хоног" />
              <Kpi label="Kudos энэ 7 хоногт" value={team.giftsWeek} icon={<Gift />} foot={`Нийт ${team.giftsTotal} badge`} />
            </div>
          </div>

          <div className="rounded-2xl border bg-background/70 p-4 backdrop-blur-sm">
            <h3 className="text-sm font-semibold">Багийн pulse</h3>
            <p className="mb-3 text-xs text-muted-foreground">Долоо хоног бүр дуусгасан task, гишүүнээр</p>
            <TeamPulseChart members={members} today={data.today} />
          </div>
        </div>
      </section>

      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Шинэчлэхэд алдаа гарлаа</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Roster */}
      <section aria-label="Багийн гишүүд" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {members.map((m) => (
          <MemberCard
            key={m.id}
            member={m}
            isMe={m.id === me?.memberId}
            selected={selected?.id === m.id}
            onSelect={() => setSelectedId(m.id)}
            onGift={() => openGift(m.id)}
            onEdit={() => setEditOpen(true)}
          />
        ))}
      </section>

      {selected && <MemberDetail member={selected} index={selectedIndex} data={data} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <Leaderboard members={members} meId={me?.memberId ?? null} />
        <KudosFeed gifts={data.gifts} members={members} onGift={() => openGift(null)} canGift={canGift} />
      </div>

      {me && (
        <GiftDialog
          open={giftOpen}
          onOpenChange={setGiftOpen}
          members={members}
          initialTo={giftTo}
          me={me}
          onDone={setData}
        />
      )}
      <CharacterDialog open={editOpen} onOpenChange={setEditOpen} member={myMember} onDone={setData} />
    </div>
  );
}
