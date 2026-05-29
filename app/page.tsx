"use client";

import { useState, useCallback } from "react";
import {
  Sun, Moon, ClipboardList, BarChart3,
  MessageSquare, Eye, Send,
  CheckCircle2, SkipForward, XCircle,
  Users, CheckCheck,
} from "lucide-react";
import type {
  JiraTicket,
  TicketWithParticipants,
  PersonGroup,
  SyncResult,
} from "@/types";
import type { ReportType } from "@/lib/planner-report";

// ── Helpers ───────────────────────────────────────────────────────────────────
const PRIORITY_COLORS: Record<string, string> = {
  Highest: "bg-red-100 text-red-700",
  Urgent: "bg-red-100 text-red-700",
  High: "bg-orange-100 text-orange-700",
  Important: "bg-orange-100 text-orange-700",
  Medium: "bg-yellow-100 text-yellow-700",
  Low: "bg-blue-100 text-blue-700",
  Lowest: "bg-slate-100 text-slate-600",
};

const STATUS_COLORS: Record<string, string> = {
  "In Progress": "bg-blue-100 text-blue-700",
  Open: "bg-green-100 text-green-700",
  "To Do": "bg-slate-100 text-slate-600",
};

function Badge({
  label,
  colorMap,
}: {
  label: string;
  colorMap: Record<string, string>;
}) {
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
        colorMap[label] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {label}
    </span>
  );
}

// ── Single ticket row ─────────────────────────────────────────────────────────
function TicketRow({
  ticket,
  showParticipants,
  isChecked,
  onToggle,
}: {
  ticket: JiraTicket & { participants?: string[] };
  showParticipants: boolean;
  isChecked: boolean;
  onToggle: (key: string) => void;
}) {
  const f = ticket.fields;
  const created = new Date(f.created).toLocaleDateString("mn-MN");
  const participants = ticket.participants ?? [];

  return (
    <tr
      onClick={() => onToggle(ticket.key)}
      className={`border-b border-slate-100 last:border-0 cursor-pointer transition-colors ${
        isChecked ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-slate-50"
      }`}
    >
      <td className="py-3 px-3">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => onToggle(ticket.key)}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
        />
      </td>
      <td className="py-3 px-3">
        <a
          href={`https://zerotech.atlassian.net/browse/${ticket.key}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-xs text-blue-600 hover:underline"
        >
          {ticket.key}
        </a>
      </td>
      <td className="py-3 px-3 max-w-xs">
        <div className="flex flex-col gap-1">
          <span className="text-slate-800 text-sm line-clamp-2">{f.summary}</span>
          {showParticipants && participants.length > 1 && (
            <span className="inline-flex items-center gap-1 text-xs text-violet-600 font-medium">
              <Users className="w-3 h-3" />
              {participants.join(", ")}
            </span>
          )}
        </div>
      </td>
      <td className="py-3 px-3 text-xs text-slate-600 whitespace-nowrap">
        {f.assignee?.displayName ?? <span className="text-slate-400">—</span>}
      </td>
      <td className="py-3 px-3">
        <Badge label={f.status?.name ?? "—"} colorMap={STATUS_COLORS} />
      </td>
      <td className="py-3 px-3">
        <Badge label={f.priority?.name ?? "—"} colorMap={PRIORITY_COLORS} />
      </td>
      <td className="py-3 px-3 text-xs text-slate-500 whitespace-nowrap">
        {created}
      </td>
    </tr>
  );
}

// ── Ticket table ──────────────────────────────────────────────────────────────
function TicketTable({
  tickets,
  showParticipants,
  selected,
  onToggleOne,
  onToggleAll,
}: {
  tickets: (JiraTicket & { participants?: string[] })[];
  showParticipants: boolean;
  selected: Set<string>;
  onToggleOne: (key: string) => void;
  onToggleAll: (keys: string[]) => void;
}) {
  const keys = tickets.map((t) => t.key);
  const allChecked = keys.length > 0 && keys.every((k) => selected.has(k));
  const someChecked = keys.some((k) => selected.has(k)) && !allChecked;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <span className="text-sm text-slate-500">{tickets.length} ticket</span>
        <button
          onClick={() => onToggleAll(keys)}
          className="text-xs text-blue-600 hover:underline"
        >
          {allChecked ? "Бүгдийг болиулах" : "Бүгдийг сонгох"}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="w-10 py-2 px-3">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = someChecked;
                  }}
                  onChange={() => onToggleAll(keys)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                />
              </th>
              <th className="py-2 px-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                Key
              </th>
              <th className="py-2 px-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                Гарчиг
              </th>
              <th className="py-2 px-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                Assignee
              </th>
              <th className="py-2 px-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                Статус
              </th>
              <th className="py-2 px-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                Эрэмбэ
              </th>
              <th className="py-2 px-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                Огноо
              </th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <TicketRow
                key={ticket.key}
                ticket={ticket}
                showParticipants={showParticipants}
                isChecked={selected.has(ticket.key)}
                onToggle={onToggleOne}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Result row ────────────────────────────────────────────────────────────────
function ResultRow({ r }: { r: SyncResult }) {
  const icon =
    r.status === "created" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> :
    r.status === "skipped" ? <SkipForward className="w-4 h-4 text-slate-400" /> :
    <XCircle className="w-4 h-4 text-red-500" />;
  const label =
    r.status === "created"
      ? "Үүслээ"
      : r.status === "skipped"
      ? "Давхардал (алгасав)"
      : "Алдаа";

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-2 px-3 font-mono text-xs text-slate-500">{r.key}</td>
      <td className="py-2 px-3 text-sm text-slate-700 max-w-xs truncate">
        {r.summary}
      </td>
      <td className="py-2 px-3 text-sm">
        <span className="inline-flex items-center gap-1.5">{icon} {label}</span>
      </td>
      <td className="py-2 px-3 text-sm">
        {r.status === "created" && r.taskUrl ? (
          <a
            href={r.taskUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline text-xs"
          >
            Planner харах →
          </a>
        ) : r.status === "error" ? (
          <span className="text-red-500 text-xs">{r.error}</span>
        ) : null}
      </td>
    </tr>
  );
}

// ── Teams Report Panel ────────────────────────────────────────────────────────

const REPORT_BUTTONS: {
  type: ReportType;
  label: string;
  icon: React.ReactNode;
  color: string;
  hoverColor: string;
}[] = [
  { type: "morning", label: "Өглөөний тайлан",      icon: <Sun className="w-4 h-4" />,           color: "bg-amber-500",   hoverColor: "hover:bg-amber-600" },
  { type: "evening", label: "Оройн тайлан",          icon: <Moon className="w-4 h-4" />,          color: "bg-indigo-500",  hoverColor: "hover:bg-indigo-600" },
  { type: "daily",   label: "Өдрийн тойм",           icon: <ClipboardList className="w-4 h-4" />, color: "bg-slate-500",   hoverColor: "hover:bg-slate-600" },
  { type: "team",    label: "Багийн нэгдсэн тайлан", icon: <BarChart3 className="w-4 h-4" />,     color: "bg-emerald-600", hoverColor: "hover:bg-emerald-700" },
];

interface TeamsReportResult {
  type: ReportType;
  sent: boolean;
  preview: string;   // мессежийн текст
}

function TeamsPanel() {
  const [loadingType, setLoadingType] = useState<string | null>(null);
  const [result, setResult] = useState<TeamsReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePreview = async (type: ReportType) => {
    setLoadingType(`preview-${type}`);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/teams/report?type=${type}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Алдаа гарлаа");

      // team → data.message, бусад → data.reports[0].message эсвэл нэгтгэнэ
      let preview: string;
      if (type === "team") {
        preview = data.message ?? "";
      } else {
        preview = (data.reports ?? [])
          .map((r: { displayName: string; message: string }) => `**${r.displayName}**\n${r.message}`)
          .join("\n\n---\n\n");
      }
      setResult({ type, sent: false, preview });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingType(null);
    }
  };

  const handleSend = async (type: ReportType) => {
    setLoadingType(`send-${type}`);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/teams/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, send: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Алдаа гарлаа");

      let preview: string;
      if (type === "team") {
        preview = data.message ?? "";
      } else {
        preview = (data.reports ?? [])
          .map((r: { displayName: string; message: string }) => `**${r.displayName}**\n${r.message}`)
          .join("\n\n---\n\n");
      }
      setResult({ type, sent: true, preview });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
          <MessageSquare className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Teams тайлан</h2>
          <p className="text-xs text-slate-400">
            Planner-аас таск уншиж Teams-д мессеж илгээнэ
          </p>
        </div>
      </div>

      {/* Button grid */}
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {REPORT_BUTTONS.map((btn) => {
            const isLoadingPreview = loadingType === `preview-${btn.type}`;
            const isLoadingSend    = loadingType === `send-${btn.type}`;
            const busy             = isLoadingPreview || isLoadingSend;

            return (
              <div
                key={btn.type}
                className="border border-slate-100 rounded-lg p-4 space-y-3 hover:border-slate-200 transition-colors"
              >
                <div className="flex items-center gap-2 text-slate-600">
                  {btn.icon}
                  <span className="text-sm font-medium text-slate-700">{btn.label}</span>
                </div>
                <div className="flex gap-2">
                  {/* Preview */}
                  <button
                    onClick={() => handlePreview(btn.type)}
                    disabled={!!loadingType}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoadingPreview ? (
                      <span className="animate-spin inline-block w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full" />
                    ) : (
                      <><Eye className="w-3 h-3" /> Preview</>
                    )}
                  </button>
                  {/* Send */}
                  <button
                    onClick={() => handleSend(btn.type)}
                    disabled={!!loadingType}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white ${btn.color} ${btn.hoverColor} disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
                  >
                    {isLoadingSend ? (
                      <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <><Send className="w-3 h-3" /> Teams-д илгээх</>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-700">
            <strong>Алдаа:</strong> {error}
          </div>
        )}

        {/* Result preview */}
        {result && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {result.sent ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <CheckCheck className="w-3.5 h-3.5" /> Teams-д амжилттай илгээлээ
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                  <Eye className="w-3.5 h-3.5" /> Preview — илгээгээгүй
                </span>
              )}
            </div>
            <pre className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed max-h-80 overflow-y-auto">
              {result.preview}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
type TabId = "all" | string;

export default function Home() {
  const [allTickets, setAllTickets] = useState<TicketWithParticipants[]>([]);
  const [byPerson, setByPerson] = useState<PersonGroup[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [results, setResults] = useState<SyncResult[] | null>(null);
  const [summary, setSummary] = useState<{
    created: number;
    skipped: number;
    errors: number;
  } | null>(null);

  const hasData = allTickets.length > 0;

  // ── Fetch ──
  const loadTickets = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    setResults(null);
    setSummary(null);
    setSelected(new Set());
    setActiveTab("all");

    try {
      const res = await fetch("/api/jira/tickets");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ticket татахад алдаа гарлаа");
      setAllTickets(data.allTickets ?? []);
      setByPerson(data.byPerson ?? []);
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Selection ──
  const toggleOne = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleGroup = (keys: string[]) => {
    const allOn = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOn) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  };

  // ── Sync ──
  const syncToPlanner = async () => {
    if (!selected.size) return;
    setSyncing(true);
    setSyncError(null);
    setResults(null);
    setSummary(null);

    const toSync = allTickets.filter((t) => selected.has(t.key));
    try {
      const res = await fetch("/api/planner/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickets: toSync }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync хийхэд алдаа гарлаа");
      setResults(data.results ?? []);
      setSummary({
        created: data.created,
        skipped: data.skipped,
        errors: data.errors,
      });
    } catch (e: unknown) {
      setSyncError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  };

  // ── Current tab tickets ──
  const currentTickets: (JiraTicket & { participants?: string[] })[] =
    activeTab === "all"
      ? allTickets
      : (byPerson.find((p) => p.email === activeTab)?.tickets ?? []);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
          J→P
        </div>
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            Jira → Microsoft Planner
          </h1>
          <p className="text-xs text-slate-500">
            DC project -- GP team
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={loadTickets}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Татаж байна…
              </>
            ) : (
              "Jira ticket татах"
            )}
          </button>

          {hasData && (
            <button
              onClick={syncToPlanner}
              disabled={syncing || selected.size === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {syncing ? (
                <>
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Sync хийж байна…
                </>
              ) : (
                `Planner-д нэмэх${selected.size > 0 ? ` (${selected.size})` : ""}`
              )}
            </button>
          )}
        </div>

        {/* Errors */}
        {fetchError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            <strong>Алдаа:</strong> {fetchError}
          </div>
        )}
        {syncError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            <strong>Sync алдаа:</strong> {syncError}
          </div>
        )}

        {/* Tabs + table */}
        {hasData && (
          <div className="space-y-0">
            {/* Tab bar */}
            <div className="flex gap-1 border-b border-slate-200">
              {/* All tab */}
              <button
                onClick={() => setActiveTab("all")}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg border transition-colors ${
                  activeTab === "all"
                    ? "bg-white border-slate-200 border-b-white text-blue-600 -mb-px"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                Бүгд
                <span className="ml-1.5 text-xs bg-slate-100 text-slate-600 rounded-full px-1.5 py-0.5">
                  {allTickets.length}
                </span>
              </button>

              {/* Per-person tabs */}
              {byPerson.map((p) => (
                <button
                  key={p.email}
                  onClick={() => setActiveTab(p.email)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg border transition-colors ${
                    activeTab === p.email
                      ? "bg-white border-slate-200 border-b-white text-blue-600 -mb-px"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {p.displayName}
                  <span className="ml-1.5 text-xs bg-slate-100 text-slate-600 rounded-full px-1.5 py-0.5">
                    {p.tickets.length}
                  </span>
                </button>
              ))}

              {/* Selected count pill */}
              {selected.size > 0 && (
                <div className="ml-auto self-center pr-1">
                  <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded-full">
                    {selected.size} сонгогдсон
                  </span>
                </div>
              )}
            </div>

            {/* Table */}
            <TicketTable
              tickets={currentTickets}
              showParticipants={activeTab === "all"}
              selected={selected}
              onToggleOne={toggleOne}
              onToggleAll={toggleGroup}
            />
          </div>
        )}

        {/* Sync results */}
        {summary && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-4 text-center">
                <div className="text-2xl font-bold text-emerald-700">
                  {summary.created}
                </div>
                <div className="inline-flex items-center justify-center gap-1 text-xs text-emerald-600 mt-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Амжилттай үүссэн
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-center">
                <div className="text-2xl font-bold text-slate-600">
                  {summary.skipped}
                </div>
                <div className="inline-flex items-center justify-center gap-1 text-xs text-slate-500 mt-1">
                  <SkipForward className="w-3.5 h-3.5" /> Алгасагдсан (давхардал)
                </div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-4 text-center">
                <div className="text-2xl font-bold text-red-600">
                  {summary.errors}
                </div>
                <div className="inline-flex items-center justify-center gap-1 text-xs text-red-500 mt-1"><XCircle className="w-3.5 h-3.5" /> Алдаатай</div>
              </div>
            </div>

            {results && results.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <span className="text-sm font-medium text-slate-700">
                    Дэлгэрэнгүй үр дүн
                  </span>
                </div>
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="py-2 px-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Key
                      </th>
                      <th className="py-2 px-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Гарчиг
                      </th>
                      <th className="py-2 px-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Үр дүн
                      </th>
                      <th className="py-2 px-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Холбоос / Алдаа
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <ResultRow key={r.key} r={r} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!loading && !hasData && !fetchError && (
          <div className="text-center py-20 text-slate-400">
            <div className="flex items-center justify-center mb-3 text-slate-300"><ClipboardList className="w-12 h-12" /></div>
            <p className="text-sm font-bold">
              &ldquo;Jira ticket татах&rdquo; товчийг дарж эхлэнэ үү
            </p>
          </div>
        )}

        {/* Teams report panel — always visible */}
        <TeamsPanel />
      </main>
    </div>
  );
}
