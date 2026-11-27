"use client";

import { useRef, useState, type ReactNode } from "react";
import { addDays, weekStart } from "@/lib/team-catalog";
import { cn } from "@/lib/utils";
import { Character } from "@/components/team/character";
import { seriesColor, type TeamMember } from "@/components/team/types";

const WEEKDAYS = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"];

function shortDate(day: string): string {
  const [, m, d] = day.split("-");
  return `${Number(m)}/${Number(d)}`;
}

/** 8 долоо хоногийн эхлэлүүд (хуучнаас шинэ рүү) */
export function weekStarts(today: string): string[] {
  const current = weekStart(today);
  return Array.from({ length: 8 }, (_, i) => addDays(current, -(7 - i) * 7));
}

// ── Hover tooltip ───────────────────────────────────────────────────────────

type TipState = { x: number; y: number; content: ReactNode } | null;

function useTip() {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TipState>(null);

  const bind = (content: ReactNode) => ({
    onMouseEnter: (e: React.MouseEvent<Element>) => show(e.currentTarget, content),
    onFocus: (e: React.FocusEvent<Element>) => show(e.currentTarget, content),
    onMouseLeave: () => setTip(null),
    onBlur: () => setTip(null),
  });

  function show(target: Element, content: ReactNode) {
    const box = ref.current?.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    if (!box) return;
    setTip({ x: r.left - box.left + r.width / 2, y: r.top - box.top, content });
  }

  const layer = tip ? (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-lg border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap text-popover-foreground shadow-lg"
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.content}
    </div>
  ) : null;

  return { ref, bind, layer };
}

// ── Багийн pulse — stacked bar ──────────────────────────────────────────────

export function TeamPulseChart({ members, today }: { members: TeamMember[]; today: string }) {
  const { ref, bind, layer } = useTip();
  const weeks = weekStarts(today);
  const totals = weeks.map((_, i) => members.reduce((sum, m) => sum + m.stats.weekly[i], 0));
  const max = Math.max(1, ...totals);
  const peak = totals.indexOf(Math.max(...totals));

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Тайлбар">
        {members.map((m, i) => (
          <li key={m.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-[3px]" style={{ background: seriesColor(i) }} />
            {m.name}
          </li>
        ))}
      </ul>
      <div ref={ref} className="relative">
        {layer}
        <div className="relative flex h-36 items-end gap-2 border-b border-border sm:gap-3">
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border/70" />
          <span className="pointer-events-none absolute -top-2 right-0 bg-card pl-1 text-[10px] text-muted-foreground tabular-nums">
            {max}
          </span>
          {weeks.map((week, i) => {
            const label = i === 7 ? "Энэ 7 хоног" : `${shortDate(week)}-ээс`;
            return (
              <button
                type="button"
                key={week}
                aria-label={`${label}: ${totals[i]} task`}
                className="group relative flex h-full flex-1 flex-col justify-end rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                {...bind(
                  <div className="space-y-1">
                    <div className="font-medium">
                      {label} · {totals[i]} task
                    </div>
                    {members.map((m, mi) => (
                      <div key={m.id} className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="size-2 rounded-[2px]" style={{ background: seriesColor(mi) }} />
                        <span className="flex-1">{m.name}</span>
                        <span className="text-foreground tabular-nums">{m.stats.weekly[i]}</span>
                      </div>
                    ))}
                  </div>
                )}
              >
                {(i === 7 || i === peak) && totals[i] > 0 && (
                  <span className="mb-1 text-center text-[11px] font-medium text-foreground tabular-nums">
                    {totals[i]}
                  </span>
                )}
                <div
                  className="flex flex-col-reverse gap-[2px] overflow-hidden rounded-t-[4px] transition-opacity group-hover:opacity-85"
                  style={{ height: `${(totals[i] / max) * 100}%` }}
                >
                  {members.map((m, mi) =>
                    m.stats.weekly[i] > 0 ? (
                      <div key={m.id} style={{ flexGrow: m.stats.weekly[i], background: seriesColor(mi) }} />
                    ) : null
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-1.5 flex gap-2 sm:gap-3">
          {weeks.map((week, i) => (
            <span key={week} className={cn("flex-1 text-center text-[10px] text-muted-foreground tabular-nums", i === 7 && "font-medium text-foreground")}>
              {i === 7 ? "Одоо" : shortDate(week)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Heatmap ─────────────────────────────────────────────────────────────────

function heatLevel(n: number): number {
  if (n <= 0) return 0;
  if (n === 1) return 2;
  if (n === 2) return 3;
  if (n <= 4) return 4;
  return 5;
}

export function ActivityHeatmap({ daily, today }: { daily: number[]; today: string }) {
  const { ref, bind, layer } = useTip();
  const first = addDays(today, -(daily.length - 1));
  const gridStart = weekStart(first);
  const columns = Math.ceil(((Date.parse(today) - Date.parse(gridStart)) / 86_400_000 + 1) / 7);

  const cells: { day: string; count: number | null }[][] = Array.from({ length: columns }, (_, c) =>
    Array.from({ length: 7 }, (_, r) => {
      const day = addDays(gridStart, c * 7 + r);
      const idx = Math.round((Date.parse(day) - Date.parse(first)) / 86_400_000);
      return { day, count: idx >= 0 && idx < daily.length ? daily[idx] : null };
    })
  );

  return (
    <div ref={ref} className="relative">
      {layer}
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        <div className="mr-1 grid grid-rows-7 gap-[3px] text-[9px] leading-none text-muted-foreground">
          {WEEKDAYS.map((d, i) => (
            <span key={d} className="flex h-3 items-center">
              {i % 2 === 0 ? d : ""}
            </span>
          ))}
        </div>
        {cells.map((col, c) => (
          <div key={c} className="grid grid-rows-7 gap-[3px]">
            {col.map(({ day, count }) =>
              count === null ? (
                <span key={day} className="size-3" />
              ) : (
                <span
                  key={day}
                  tabIndex={0}
                  aria-label={`${day}: ${count} task`}
                  className={cn(
                    "size-3 rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    day === today && "ring-1 ring-foreground/40"
                  )}
                  style={{ background: `var(--seq-${heatLevel(count)})` }}
                  {...bind(
                    <span>
                      <span className="font-medium tabular-nums">{count}</span> task ·{" "}
                      <span className="text-muted-foreground">{day}</span>
                    </span>
                  )}
                />
              )
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        Бага
        {[0, 2, 3, 4, 5].map((l) => (
          <span key={l} className="size-2.5 rounded-[2px]" style={{ background: `var(--seq-${l})` }} />
        ))}
        Их
      </div>
    </div>
  );
}

// ── Гишүүний 8 долоо хоног ──────────────────────────────────────────────────

export function WeeklyBars({ weekly, today, color }: { weekly: number[]; today: string; color: string }) {
  const { ref, bind, layer } = useTip();
  const weeks = weekStarts(today);
  const max = Math.max(1, ...weekly);
  const peak = weekly.indexOf(Math.max(...weekly));

  return (
    <div ref={ref} className="relative">
      {layer}
      <div className="flex h-28 items-end gap-2 border-b border-border">
        {weekly.map((value, i) => (
          <button
            type="button"
            key={weeks[i]}
            aria-label={`${shortDate(weeks[i])}: ${value} task`}
            className="group flex h-full flex-1 flex-col justify-end rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            {...bind(
              <span>
                {i === 7 ? "Энэ 7 хоног" : `${shortDate(weeks[i])}-ээс`} ·{" "}
                <span className="font-medium tabular-nums">{value}</span> task
              </span>
            )}
          >
            {(i === 7 || i === peak) && value > 0 && (
              <span className="mb-1 text-center text-[11px] font-medium tabular-nums">{value}</span>
            )}
            <div
              className="min-h-[2px] rounded-t-[4px] transition-opacity group-hover:opacity-80"
              style={{ height: `${(value / max) * 100}%`, background: value ? color : "var(--border)" }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        {weeks.map((w, i) => (
          <span key={w} className="flex-1 text-center text-[10px] text-muted-foreground tabular-nums">
            {i === 7 ? "Одоо" : shortDate(w)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Жижиг avatar — жагсаалт, feed-д */
export function MiniAvatar({ member, size = 28 }: { member: TeamMember; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted"
      style={{ width: size, height: size }}
    >
      <Character profile={member.profile} size={size * 1.15} animated={false} className="translate-y-[8%]" />
    </span>
  );
}
