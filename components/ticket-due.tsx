"use client";

import { DueDatePicker } from "@/components/due-date-picker";

function todayInUlaanbaatar(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function daysUntil(dueDate: string | null, today: string): number | null {
  if (!dueDate) return null;
  const due = Date.parse(`${dueDate}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  return Math.round((due - now) / 86_400_000);
}

function dueLabel(dueDate: string | null, today: string): string {
  const days = daysUntil(dueDate, today);
  if (days === null || !dueDate) return "Огноогүй";
  const [year, month, day] = dueDate.split("-").map(Number);
  const when = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("mn-MN", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
  if (days < 0) return `${when} · ${-days} хоног хэтэрсэн`;
  if (days === 0) return `${when} · Өнөөдөр`;
  if (days === 1) return `${when} · Маргааш`;
  return `${when} · ${days} хоног үлдсэн`;
}

function dueTone(dueDate: string | null, today: string): string {
  const days = daysUntil(dueDate, today);
  if (days === null) return "bg-muted text-muted-foreground";
  if (days < 0) return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300";
  if (days <= 2) return "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300";
  if (days <= 7) return "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300";
  return "bg-muted text-muted-foreground";
}

export function TicketDueDate({
  value,
  disabled,
  onChange,
}: {
  value: string | null;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const today = todayInUlaanbaatar();
  return (
    <div onClick={(event) => event.stopPropagation()}>
      <DueDatePicker
        value={value}
        today={today}
        label={dueLabel(value, today)}
        tone={dueTone(value, today)}
        disabled={disabled}
        className="mt-1"
        onChange={onChange}
      />
    </div>
  );
}
