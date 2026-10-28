"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"];

function monthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("mn-MN", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
  });
}

function shiftMonth(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${nextMonth}`;
}

function monthCells(yearMonth: string): (string | null)[] {
  const [year, month] = yearMonth.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= count; day += 1) {
    cells.push(`${yearMonth}-${String(day).padStart(2, "0")}`);
  }
  return cells;
}

export function DueDatePicker({
  value,
  today,
  label,
  tone,
  disabled,
  onChange,
  className,
}: {
  value: string | null;
  today: string;
  label: string;
  tone: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState((value ?? today).slice(0, 7));
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  function openCalendar() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const width = 248;
      const height = 292;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      const below = window.innerHeight - rect.bottom;
      const top = below < height && rect.top > height ? rect.top - height - 6 : rect.bottom + 6;
      setPosition({ top, left });
    }
    setMonth((value ?? today).slice(0, 7));
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-label="Дуусах өдөр"
        aria-expanded={open}
        onClick={openCalendar}
        className={cn(
          "mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
          tone,
          disabled && "opacity-60",
          className
        )}
      >
        <Calendar className="size-3.5" />
        {label}
      </button>
      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-labelledby={titleId}
          style={{ top: position.top, left: position.left }}
          className="fixed z-50 w-[248px] rounded-xl bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Өмнөх сар"
              className="rounded-md p-1 hover:bg-muted"
              onClick={() => setMonth((current) => shiftMonth(current, -1))}
            >
              <ChevronLeft className="size-4" />
            </button>
            <div id={titleId} className="text-sm font-medium capitalize">
              {monthLabel(month)}
            </div>
            <button
              type="button"
              aria-label="Дараагийн сар"
              className="rounded-md p-1 hover:bg-muted"
              onClick={() => setMonth((current) => shiftMonth(current, 1))}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-1">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthCells(month).map((day, index) =>
              day ? (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    onChange(day);
                    setOpen(false);
                  }}
                  className={cn(
                    "h-8 rounded-md text-xs hover:bg-muted",
                    day === today && "ring-1 ring-primary",
                    day === value && "bg-primary text-primary-foreground hover:bg-primary"
                  )}
                >
                  {Number(day.slice(-2))}
                </button>
              ) : (
                <span key={`empty-${index}`} />
              )
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs text-primary hover:bg-muted"
              onClick={() => {
                onChange(today);
                setOpen(false);
              }}
            >
              Өнөөдөр
            </button>
            {value && (
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                Арилгах
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
