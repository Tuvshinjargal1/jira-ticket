"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Loader2, Plus, RefreshCw, Trash2, X } from "lucide-react";
import type { BoardTask, ChecklistItem } from "@/lib/planner-board";
import { cn } from "@/lib/utils";
import { DueDatePicker } from "@/components/due-date-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type Person = { name: string; tasks: BoardTask[] };

type Board = { planUrl: string; people: Person[] };

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

function formatDay(dueDate: string): string {
  const [year, month, day] = dueDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("mn-MN", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}

function dueLabel(dueDate: string | null, today: string): string {
  const days = daysUntil(dueDate, today);
  if (days === null || !dueDate) return "Огноогүй";
  const when = formatDay(dueDate);
  if (days < 0) return `${when} · ${-days} хоног хэтэрсэн`;
  if (days === 0) return `${when} · Өнөөдөр`;
  if (days === 1) return `${when} · Маргааш`;
  return `${when} · ${days} хоног үлдсэн`;
}

function compareTasks(a: BoardTask, b: BoardTask): number {
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
  if (a.dueDate) return -1;
  if (b.dueDate) return 1;
  return a.title.localeCompare(b.title);
}

function dueTone(dueDate: string | null, today: string): string {
  const days = daysUntil(dueDate, today);
  if (days === null) return "bg-muted text-muted-foreground";
  if (days < 0) return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300";
  if (days <= 2) return "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300";
  if (days <= 7) return "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300";
  return "bg-muted text-muted-foreground";
}

const COLUMN_STORAGE_KEY = "planner-schedule-columns";

function readHiddenColumns(): string[] {
  try {
    const raw = localStorage.getItem(COLUMN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((name) => typeof name === "string") : [];
  } catch {
    return [];
  }
}

function displayTitle(task: BoardTask): string {
  if (!task.key) return task.title;
  const prefix = `[${task.key}]`;
  return task.title.startsWith(prefix) ? task.title.slice(prefix.length).trim() : task.title;
}

export function PlannerSchedule() {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [columnsReady, setColumnsReady] = useState(false);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, ChecklistItem[]>>({});
  const [checkError, setCheckError] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savingDue, setSavingDue] = useState<string | null>(null);
  const today = todayInUlaanbaatar();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/planner/schedule");
      const data = (await response.json()) as Board & { error?: string };
      if (!response.ok) throw new Error(data.error || "Хуваарь татаж чадсангүй");
      setBoard({ planUrl: data.planUrl, people: data.people });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setHiddenColumns(readHiddenColumns());
    setColumnsReady(true);
  }, []);

  useEffect(() => {
    if (!columnsReady) return;
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(hiddenColumns));
  }, [hiddenColumns, columnsReady]);

  const visiblePeople = useMemo(() => {
    if (!board) return [];
    return board.people.map((person) => ({
      ...person,
      tasks: person.tasks
        .filter((task) => showDone || task.percentComplete < 100)
        .sort(compareTasks),
    }));
  }, [board, showDone]);

  const shownPeople = useMemo(
    () => visiblePeople.filter((person) => !hiddenColumns.includes(person.name)),
    [visiblePeople, hiddenColumns]
  );

  function hideColumn(name: string) {
    setHiddenColumns((prev) => (prev.includes(name) ? prev : [...prev, name]));
  }

  function showColumn(name: string) {
    setHiddenColumns((prev) => prev.filter((item) => item !== name));
  }

  const summary = useMemo(() => {
    const tasks = shownPeople.flatMap((person) => person.tasks);
    return {
      open: tasks.length,
      overdue: tasks.filter((task) => (daysUntil(task.dueDate, today) ?? 0) < 0 && task.dueDate).length,
      week: tasks.filter((task) => {
        const days = daysUntil(task.dueDate, today);
        return days !== null && days >= 0 && days <= 7;
      }).length,
      undated: tasks.filter((task) => !task.dueDate).length,
    };
  }, [shownPeople, today]);

  async function loadChecks(taskId: string) {
    setCheckError((prev) => ({ ...prev, [taskId]: "" }));
    try {
      const response = await fetch(`/api/planner/tasks/${taskId}/checklist`);
      const data = (await response.json()) as { items?: ChecklistItem[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Дэд ажил татаж чадсангүй");
      setChecks((prev) => ({ ...prev, [taskId]: data.items ?? [] }));
    } catch (err: unknown) {
      setCheckError((prev) => ({
        ...prev,
        [taskId]: err instanceof Error ? err.message : String(err),
      }));
    }
  }

  function toggleTask(taskId: string) {
    setOpenTask((current) => {
      const next = current === taskId ? null : taskId;
      if (next && !checks[next]) loadChecks(next);
      return next;
    });
  }

  async function addSubtask(taskId: string) {
    const title = (drafts[taskId] ?? "").trim();
    if (!title) return;
    setSaving(taskId);
    setCheckError((prev) => ({ ...prev, [taskId]: "" }));
    try {
      const response = await fetch(`/api/planner/tasks/${taskId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = (await response.json()) as { items?: ChecklistItem[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Дэд ажил нэмэгдсэнгүй");
      setChecks((prev) => ({ ...prev, [taskId]: data.items ?? [] }));
      setDrafts((prev) => ({ ...prev, [taskId]: "" }));
    } catch (err: unknown) {
      setCheckError((prev) => ({
        ...prev,
        [taskId]: err instanceof Error ? err.message : String(err),
      }));
    } finally {
      setSaving(null);
    }
  }

  function applyDueDate(taskId: string, dueDate: string | null) {
    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        people: prev.people.map((person) => ({
          ...person,
          tasks: person.tasks.map((task) =>
            task.id === taskId
              ? { ...task, dueDate, dueSource: dueDate ? "planner" : null }
              : task
          ),
        })),
      };
    });
  }

  async function saveDueDate(taskId: string, value: string, previous: string | null) {
    const dueDate = value || null;
    applyDueDate(taskId, dueDate);
    setSavingDue(taskId);
    setCheckError((prev) => ({ ...prev, [taskId]: "" }));
    try {
      const response = await fetch(`/api/planner/tasks/${taskId}/due`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Огноо хадгалагдсангүй");
    } catch (err: unknown) {
      applyDueDate(taskId, previous);
      setCheckError((prev) => ({
        ...prev,
        [taskId]: err instanceof Error ? err.message : String(err),
      }));
    } finally {
      setSavingDue(null);
    }
  }

  async function removeSubtask(taskId: string, item: ChecklistItem) {
    const previous = checks[taskId] ?? [];
    setChecks((prev) => ({
      ...prev,
      [taskId]: previous.filter((row) => row.id !== item.id),
    }));
    try {
      const response = await fetch(`/api/planner/tasks/${taskId}/checklist`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });
      const data = (await response.json()) as { items?: ChecklistItem[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Дэд ажил устгагдсангүй");
      setChecks((prev) => ({ ...prev, [taskId]: data.items ?? [] }));
    } catch (err: unknown) {
      setChecks((prev) => ({ ...prev, [taskId]: previous }));
      setCheckError((prev) => ({
        ...prev,
        [taskId]: err instanceof Error ? err.message : String(err),
      }));
    }
  }

  async function toggleSubtask(taskId: string, item: ChecklistItem) {
    const previous = checks[taskId] ?? [];
    setChecks((prev) => ({
      ...prev,
      [taskId]: previous.map((row) =>
        row.id === item.id ? { ...row, isChecked: !row.isChecked } : row
      ),
    }));
    try {
      const response = await fetch(`/api/planner/tasks/${taskId}/checklist`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, isChecked: !item.isChecked }),
      });
      const data = (await response.json()) as { items?: ChecklistItem[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Дэд ажил шинэчлэгдсэнгүй");
      setChecks((prev) => ({ ...prev, [taskId]: data.items ?? [] }));
    } catch (err: unknown) {
      setChecks((prev) => ({ ...prev, [taskId]: previous }));
      setCheckError((prev) => ({
        ...prev,
        [taskId]: err instanceof Error ? err.message : String(err),
      }));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={cn(loading && "animate-spin")} />
          Шинэчлэх
        </Button>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={showDone} onCheckedChange={(value) => setShowDone(value === true)} />
          Дууссаныг харуулах
        </label>
        {board && (
          <a
            href={board.planUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Planner дээр нээх
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Хүссэн хүнийхээ баганыг нэмж, хасна. Хэний баганад багтахыг Planner дээр шийднэ. Дэд ажлыг
        энд бичвэл шууд харагдана.
      </p>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {loading && !board && (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Хуваарь татаж байна…
        </div>
      )}

      {board && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Багана</span>
            <Button
              type="button"
              size="sm"
              variant={hiddenColumns.length === 0 ? "default" : "outline"}
              onClick={() => setHiddenColumns([])}
            >
              Бүгд
            </Button>
            {visiblePeople.map((person) => {
              const shown = !hiddenColumns.includes(person.name);
              return (
                <Button
                  key={person.name}
                  type="button"
                  size="sm"
                  variant={shown ? "default" : "outline"}
                  onClick={() => (shown ? hideColumn(person.name) : showColumn(person.name))}
                >
                  {shown ? <X /> : <Plus />}
                  {person.name}
                  <span className="text-xs opacity-70">{person.tasks.length}</span>
                </Button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <Stat label="Үлдсэн ажил" value={summary.open} />
            <Stat label="Хэтэрсэн" value={summary.overdue} />
            <Stat label="7 хоногт" value={summary.week} />
            <Stat label="Огноогүй" value={summary.undated} />
          </div>

          {shownPeople.length === 0 && (
            <p className="rounded-xl bg-card px-4 py-8 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
              Багана сонгоогүй байна. Дээрх нэр дээр дарж нэмнэ.
            </p>
          )}

          <div
            className={cn(
              "grid items-start gap-3",
              shownPeople.length === 1
                ? "grid-cols-1 md:grid-cols-2"
                : "grid-cols-1 md:grid-cols-2 xl:[grid-template-columns:repeat(auto-fit,minmax(18rem,1fr))]"
            )}
          >
            {shownPeople.map((person) => {
              const overdue = person.tasks.filter(
                (task) => task.dueDate && (daysUntil(task.dueDate, today) ?? 0) < 0
              ).length;
              return (
                <section
                  key={person.name}
                  className="flex min-h-64 min-w-0 max-h-[70vh] flex-col rounded-xl bg-muted/60 ring-1 ring-foreground/10 md:max-h-[calc(100vh-16rem)]"
                >
                  <header className="flex items-start gap-2 border-b px-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{person.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {person.tasks.length} ажил
                        {overdue > 0 ? ` · ${overdue} хэтэрсэн` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={`${person.name} баганыг хасах`}
                      className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                      onClick={() => hideColumn(person.name)}
                    >
                      <X className="size-4" />
                    </button>
                  </header>
                  <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                    {person.tasks.length === 0 && (
                      <p className="px-1 py-3 text-sm text-muted-foreground">Үлдсэн ажил алга.</p>
                    )}
                    {person.tasks.map((task) => {
                      const expanded = openTask === task.id;
                      const items = checks[task.id];
                      return (
                        <div key={task.id} className="rounded-lg bg-card px-3 py-2.5 ring-1 ring-foreground/10">
                          <button
                            type="button"
                            className="flex w-full items-start gap-2 text-left"
                            onClick={() => toggleTask(task.id)}
                          >
                            {expanded ? (
                              <ChevronDown className="mt-0.5 size-4 shrink-0" />
                            ) : (
                              <ChevronRight className="mt-0.5 size-4 shrink-0" />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm">{displayTitle(task)}</span>
                              <span className="mt-1 flex flex-wrap items-center gap-2">
                                {task.key && (
                                  <a
                                    href={`https://zerotech.atlassian.net/browse/${task.key}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(event) => event.stopPropagation()}
                                    className="font-mono text-xs text-primary hover:underline"
                                  >
                                    {task.key}
                                  </a>
                                )}
                                <span className="text-xs text-muted-foreground">{task.status}</span>
                              </span>
                            </span>
                          </button>
                          <div className="pl-6">
                            <DueDatePicker
                              value={task.dueDate}
                              today={today}
                              label={dueLabel(task.dueDate, today)}
                              tone={dueTone(task.dueDate, today)}
                              disabled={savingDue === task.id}
                              onChange={(value) => saveDueDate(task.id, value, task.dueDate)}
                            />
                          </div>
                          {!expanded && checkError[task.id] && (
                            <p className="mt-1 pl-6 text-xs text-destructive">{checkError[task.id]}</p>
                          )}

                          {expanded && (
                            <div className="mt-3 space-y-2 border-t pt-3">
                              {!items && !checkError[task.id] && (
                                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Loader2 className="size-3 animate-spin" />
                                  Дэд ажил татаж байна…
                                </p>
                              )}
                              {items?.length === 0 && (
                                <p className="text-xs text-muted-foreground">Дэд ажил алга.</p>
                              )}
                              {items?.map((item) => (
                                <div key={item.id} className="flex items-start gap-2 text-sm">
                                  <Checkbox
                                    checked={item.isChecked}
                                    onCheckedChange={() => toggleSubtask(task.id, item)}
                                    className="mt-0.5"
                                  />
                                  <span className={cn("min-w-0 flex-1", item.isChecked && "text-muted-foreground line-through")}>
                                    {item.title}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label="Дэд ажил устгах"
                                    className="rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                                    onClick={() => removeSubtask(task.id, item)}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                              ))}
                              <form
                                className="flex gap-2"
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  addSubtask(task.id);
                                }}
                              >
                                <input
                                  value={drafts[task.id] ?? ""}
                                  onChange={(event) =>
                                    setDrafts((prev) => ({ ...prev, [task.id]: event.target.value }))
                                  }
                                  placeholder="Дэд ажил бичих…"
                                  maxLength={100}
                                  className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                />
                                <Button type="submit" size="sm" disabled={saving === task.id}>
                                  {saving === task.id ? <Loader2 className="animate-spin" /> : <Plus />}
                                  Нэмэх
                                </Button>
                              </form>
                              {checkError[task.id] && (
                                <p className="text-xs text-destructive">{checkError[task.id]}</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
