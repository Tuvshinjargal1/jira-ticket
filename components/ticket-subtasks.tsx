"use client";

import { useState, type FormEvent } from "react";
import { ChevronDown, ChevronRight, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import type { ChecklistItem } from "@/lib/planner-board";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const inputClass =
  "h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function TicketSubtasks({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ChecklistItem[] | null>(null);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const response = await fetch(`/api/planner/tasks/${taskId}/checklist`);
      const data = (await response.json()) as { items?: ChecklistItem[]; error?: string };
      if (!response.ok) throw new Error(data.error || "task татаж чадсангүй");
      setItems(data.items ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && !items) load();
  }

  async function addItem(event: FormEvent) {
    event.preventDefault();
    const title = draft.trim();
    if (!title || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/planner/tasks/${taskId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = (await response.json()) as { items?: ChecklistItem[]; error?: string };
      if (!response.ok) throw new Error(data.error || "task нэмэгдсэнгүй");
      setItems(data.items ?? []);
      setDraft("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveTitle(item: ChecklistItem) {
    const title = editText.trim();
    if (!title || title === item.title) {
      setEditingId(null);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/planner/tasks/${taskId}/checklist`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, title }),
      });
      const data = (await response.json()) as { items?: ChecklistItem[]; error?: string };
      if (!response.ok) throw new Error(data.error || "task засагдсангүй");
      setItems(data.items ?? []);
      setEditingId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleItem(item: ChecklistItem) {
    const previous = items ?? [];
    setItems(previous.map((row) => (row.id === item.id ? { ...row, isChecked: !row.isChecked } : row)));
    setError("");
    try {
      const response = await fetch(`/api/planner/tasks/${taskId}/checklist`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, isChecked: !item.isChecked }),
      });
      const data = (await response.json()) as { items?: ChecklistItem[]; error?: string };
      if (!response.ok) throw new Error(data.error || "task шинэчлэгдсэнгүй");
      setItems(data.items ?? []);
    } catch (err: unknown) {
      setItems(previous);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function removeItem(item: ChecklistItem) {
    const previous = items ?? [];
    setItems(previous.filter((row) => row.id !== item.id));
    setError("");
    try {
      const response = await fetch(`/api/planner/tasks/${taskId}/checklist`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });
      const data = (await response.json()) as { items?: ChecklistItem[]; error?: string };
      if (!response.ok) throw new Error(data.error || "task устгагдсангүй");
      setItems(data.items ?? []);
      if (editingId === item.id) setEditingId(null);
    } catch (err: unknown) {
      setItems(previous);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="contents">
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={toggleOpen}
        aria-expanded={open}
        className="order-1 text-[11px] text-muted-foreground"
      >
        {open ? <ChevronDown /> : <ChevronRight />}
        task
        {items ? <span className="tabular-nums">{items.length}</span> : null}
      </Button>

      {open && (
        <div className="order-2 mt-1.5 w-full basis-full space-y-2 rounded-md border bg-muted/40 p-2">
          {!items && !error && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              task татаж байна…
            </p>
          )}
          {items?.length === 0 && <p className="text-xs text-muted-foreground">task алга.</p>}
          {items?.map((item) =>
            editingId === item.id ? (
              <form
                key={item.id}
                className="flex gap-1.5"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveTitle(item);
                }}
              >
                <input
                  autoFocus
                  value={editText}
                  maxLength={100}
                  onChange={(event) => setEditText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setEditingId(null);
                  }}
                  className={inputClass}
                />
                <Button type="submit" size="xs" disabled={busy}>
                  Хадгалах
                </Button>
              </form>
            ) : (
              <div key={item.id} className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={item.isChecked}
                  onCheckedChange={() => toggleItem(item)}
                  className="mt-0.5"
                  aria-label={`${item.title} тэмдэглэх`}
                />
                <span className={cn("min-w-0 flex-1 text-xs", item.isChecked && "text-muted-foreground line-through")}>
                  {item.title}
                </span>
                <button
                  type="button"
                  aria-label="task засах"
                  className="rounded-md p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                  onClick={() => {
                    setEditingId(item.id);
                    setEditText(item.title);
                  }}
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="task устгах"
                  className="rounded-md p-0.5 text-muted-foreground hover:bg-background hover:text-destructive"
                  onClick={() => removeItem(item)}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )
          )}
          <form className="flex gap-1.5" onSubmit={addItem}>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="task бичих…"
              maxLength={100}
              className={inputClass}
            />
            <Button type="submit" size="xs" disabled={busy || !draft.trim()}>
              {busy ? <Loader2 className="animate-spin" /> : <Plus />}
              Нэмэх
            </Button>
          </form>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}
