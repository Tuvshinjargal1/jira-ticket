"use client";

import { useState, useCallback, useEffect } from "react";
import {
  ClipboardList,
  MessageSquare, Eye, Send,
  CheckCircle2, SkipForward, XCircle,
  Users, CheckCheck, User,
  ChevronDown, ChevronRight,
  Download, RefreshCw,
  Filter, X, Loader2,
} from "lucide-react";
import type {
  JiraTicket,
  TicketWithParticipants,
  PersonGroup,
  SyncResult,
} from "@/types";
import type { ReportType } from "@/lib/planner-report";
import { adfToPlainText } from "@/lib/adf";
import { getRequestTypeName } from "@/lib/request-type";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ── Helpers ───────────────────────────────────────────────────────────────────
/** Badge-ийн семантик өнгө — light + dark хосоороо */
const tone = {
  red: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300",
  green: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  neutral: "bg-muted text-muted-foreground",
} as const;

const PRIORITY_COLORS: Record<string, string> = {
  Highest: tone.red,
  Urgent: tone.red,
  High: tone.orange,
  Important: tone.orange,
  Medium: tone.yellow,
  Low: tone.blue,
  Lowest: tone.neutral,
};

const STATUS_COLORS: Record<string, string> = {
  "In Progress": tone.blue,
  Open: tone.green,
  Reopened: tone.amber,
  "To Do": tone.neutral,
};

/** JSM request type (customfield_10010) — DC project дээр байдаг төрлүүд */
const REQUEST_TYPE_COLORS: Record<string, string> = {
  "Доголдол": tone.rose,
  "Сайжруулалт": tone.violet,
  "Шинэ хөгжүүлэлт": tone.indigo,
  "Мэдээлэл өгсөн": tone.sky,
  "Үйлчилгээ үзүүлсэн": tone.emerald,
  "Дараах төлбөрт өөчлөлт": tone.amber,
  "Бусад": tone.neutral,
};

/** Эрэмбийг Jira-ийн дарааллаар нь эрэмбэлэх (жагсаалтад байхгүй нь сүүлд) */
const PRIORITY_ORDER = ["Highest", "Urgent", "High", "Important", "Medium", "Low", "Lowest"];

const NONE = "—";

/** Шүүлтүүрийн "бүх утга" сонголт */
const ALL = "all";

function getPriorityName(ticket: JiraTicket): string {
  return ticket.fields.priority?.name ?? NONE;
}

function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("animate-spin", className)} />;
}

/** Утгаараа өнгө нь тодорхойлогддог badge */
function ColorBadge({
  label,
  colorMap,
}: {
  label: string;
  colorMap: Record<string, string>;
}) {
  return (
    <Badge variant="secondary" className={colorMap[label] ?? tone.neutral}>
      {label}
    </Badge>
  );
}

const PLANNER_STATUSES = ["Not Started", "In Progress", "Completed"] as const;

const PLANNER_STATUS_STYLES: Record<string, string> = {
  "Completed": tone.neutral,
  "In Progress": tone.blue,
  "Not Started": tone.emerald,
};

function getLastComments(ticket: JiraTicket, limit = 3) {
  const all = ticket.fields.comment?.comments ?? [];
  return all.slice(-limit).reverse();
}

function CommentsDropdown({ ticket }: { ticket: JiraTicket }) {
  const [open, setOpen] = useState(false);
  const comments = getLastComments(ticket, 3);

  if (!comments.length) return null;

  return (
    <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
      <Button
        variant="ghost"
        size="xs"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="-ml-2 text-[11px] text-muted-foreground"
      >
        <MessageSquare />
        {comments.length} comment
        <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
      </Button>

      {open && (
        <div className="mt-1.5 rounded-md border bg-muted/40 divide-y">
          {comments.map((c, i) => {
            const body = adfToPlainText(c.body);
            const date = new Date(c.created).toLocaleString("mn-MN", {
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <div key={`${c.created}-${i}`} className="px-2.5 py-2">
                <div className="flex items-baseline justify-between gap-2 mb-0.5">
                  <span className="text-[11px] font-medium text-foreground truncate">
                    {c.author?.displayName ?? "—"}
                  </span>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                    {date}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground whitespace-pre-wrap break-words leading-snug line-clamp-4">
                  {body || <span className="italic">(хоосон)</span>}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Single ticket row ─────────────────────────────────────────────────────────
function TicketRow({
  ticket,
  showParticipants,
  isChecked,
  onToggle,
  plannerInfo,
  onStatusChange,
}: {
  ticket: JiraTicket & { participants?: string[] };
  showParticipants: boolean;
  isChecked: boolean;
  onToggle: (key: string) => void;
  plannerInfo: { status: string; taskId: string } | undefined;
  onStatusChange: (key: string, taskId: string, newStatus: string) => void;
}) {
  const f = ticket.fields;
  const created = new Date(f.created).toLocaleDateString("mn-MN");
  const requestType = getRequestTypeName(ticket);
  const participants = ticket.participants ?? [];
  const isSynced = !!plannerInfo;

  return (
    <TableRow
      onClick={() => onToggle(ticket.key)}
      data-state={isChecked ? "selected" : undefined}
      className={cn(
        "cursor-pointer",
        // Planner-т sync хийгдсэн мөрийг ногоон өнгөөр ялгана
        isSynced && !isChecked && "bg-emerald-50/70 hover:bg-emerald-100/70 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/15"
      )}
    >
      <TableCell className="py-3 align-top">
        <Checkbox
          checked={isChecked}
          onCheckedChange={() => onToggle(ticket.key)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`${ticket.key} сонгох`}
        />
      </TableCell>
      <TableCell className="py-3 align-top">
        <div className="flex flex-col gap-1 items-start">
          <a
            href={`https://zerotech.atlassian.net/browse/${ticket.key}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-xs text-primary hover:underline"
          >
            {ticket.key}
          </a>
          {isSynced && plannerInfo && (
            <Select
              value={plannerInfo.status}
              onValueChange={(v) => onStatusChange(ticket.key, plannerInfo.taskId, v)}
            >
              <SelectTrigger
                size="sm"
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "h-5.5 rounded-full border-transparent px-2 text-[10px] font-semibold",
                  PLANNER_STATUS_STYLES[plannerInfo.status] ?? tone.emerald
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLANNER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </TableCell>
      <TableCell className="py-3 max-w-md whitespace-normal align-top">
        <div className="flex flex-col gap-1">
          <span className="text-sm line-clamp-2">{f.summary}</span>
          {f.assignee && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium">
              <User className="w-3 h-3" />
              {f.assignee.displayName}
            </span>
          )}
          {showParticipants && participants.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 dark:text-violet-400">
              <Users className="w-3 h-3" />
              {participants.join(", ")}
            </span>
          )}
          <CommentsDropdown ticket={ticket} />
        </div>
      </TableCell>
      <TableCell className="py-3 text-xs text-muted-foreground align-top">
        {f.assignee?.displayName ?? "—"}
      </TableCell>
      <TableCell className="py-3 align-top">
        {requestType ? (
          <ColorBadge label={requestType} colorMap={REQUEST_TYPE_COLORS} />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="py-3 align-top">
        <ColorBadge label={f.status?.name ?? "—"} colorMap={STATUS_COLORS} />
      </TableCell>
      <TableCell className="py-3 align-top">
        <ColorBadge label={f.priority?.name ?? "—"} colorMap={PRIORITY_COLORS} />
      </TableCell>
      <TableCell className="py-3 text-xs text-muted-foreground align-top">
        {created}
      </TableCell>
    </TableRow>
  );
}

// ── Ticket table ──────────────────────────────────────────────────────────────
const TICKET_COLUMNS = [
  "Key",
  "Гарчиг",
  "Assignee",
  "Хүсэлтийн төрөл",
  "Статус",
  "Эрэмбэ",
  "Огноо",
];

function TicketTableHeader({ selectAll }: { selectAll?: React.ReactNode }) {
  return (
    <TableHeader className="bg-muted/50">
      <TableRow className="hover:bg-transparent">
        <TableHead className="w-10 px-3">{selectAll}</TableHead>
        {TICKET_COLUMNS.map((col) => (
          <TableHead
            key={col}
            className="px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {col}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

function TicketTable({
  tickets,
  showParticipants,
  selected,
  onToggleOne,
  onToggleAll,
  plannerStatusMap,
  onStatusChange,
}: {
  tickets: (JiraTicket & { participants?: string[] })[];
  showParticipants: boolean;
  selected: Set<string>;
  onToggleOne: (key: string) => void;
  onToggleAll: (keys: string[]) => void;
  plannerStatusMap: Map<string, { status: string; taskId: string }>;
  onStatusChange: (key: string, taskId: string, newStatus: string) => void;
}) {
  const [completedOpen, setCompletedOpen] = useState(false);

  const activeTickets = tickets.filter(
    (t) => plannerStatusMap.get(t.key)?.status !== "Completed"
  );
  const completedTickets = tickets.filter(
    (t) => plannerStatusMap.get(t.key)?.status === "Completed"
  );

  const keys = activeTickets.map((t) => t.key);
  const allChecked = keys.length > 0 && keys.every((k) => selected.has(k));
  const someChecked = keys.some((k) => selected.has(k)) && !allChecked;

  const rows = (list: typeof tickets) =>
    list.map((ticket) => (
      <TicketRow
        key={ticket.key}
        ticket={ticket}
        showParticipants={showParticipants}
        isChecked={selected.has(ticket.key)}
        onToggle={onToggleOne}
        plannerInfo={plannerStatusMap.get(ticket.key)}
        onStatusChange={onStatusChange}
      />
    ));

  return (
    <Card className="py-0 gap-0">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {activeTickets.length} ticket
        </span>
        <Button variant="link" size="xs" onClick={() => onToggleAll(keys)}>
          {allChecked ? "Бүгдийг болиулах" : "Бүгдийг сонгох"}
        </Button>
      </div>

      <Table>
        <TicketTableHeader
          selectAll={
            <Checkbox
              checked={allChecked ? true : someChecked ? "indeterminate" : false}
              onCheckedChange={() => onToggleAll(keys)}
              aria-label="Бүгдийг сонгох"
              className="data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary/40"
            />
          }
        />
        <TableBody>{rows(activeTickets)}</TableBody>
      </Table>

      {/* Дууссан таскууд — хумигдах хэсэг */}
      {completedTickets.length > 0 && (
        <div className="border-t">
          <Button
            variant="ghost"
            onClick={() => setCompletedOpen((v) => !v)}
            className="w-full justify-start rounded-none px-4 py-3 h-auto text-muted-foreground"
          >
            {completedOpen ? <ChevronDown /> : <ChevronRight />}
            <CheckCircle2 />
            Дууссан таскууд
            <Badge variant="secondary" className="ml-1">
              {completedTickets.length}
            </Badge>
          </Button>
          {completedOpen && (
            <div className="border-t opacity-70">
              <Table>
                <TicketTableHeader />
                <TableBody>{rows(completedTickets)}</TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Filters ───────────────────────────────────────────────────────────────────
interface FilterOption {
  value: string;
  count: number;
}

/** Утга бүрийн тоог гаргаж, өгсөн дарааллаар эрэмбэлнэ */
function buildOptions(
  values: string[],
  order?: string[]
): FilterOption[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);

  return Array.from(counts, ([value, count]) => ({ value, count })).sort((a, b) => {
    if (order) {
      const ai = order.indexOf(a.value);
      const bi = order.indexOf(b.value);
      if (ai !== bi) return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi);
    }
    return b.count - a.count || a.value.localeCompare(b.value);
  });
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}) {
  const active = value !== ALL;
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          size="sm"
          className={cn("text-xs", active && "border-primary/40 bg-muted font-medium")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL} className="text-xs">
            Бүгд
          </SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">
              {o.value}
              <span className="text-muted-foreground">({o.count})</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function FilterBar({
  requestType,
  priority,
  status,
  requestTypeOptions,
  priorityOptions,
  statusOptions,
  onRequestTypeChange,
  onPriorityChange,
  onStatusChange,
  onReset,
  shown,
  total,
}: {
  requestType: string;
  priority: string;
  status: string;
  requestTypeOptions: FilterOption[];
  priorityOptions: FilterOption[];
  statusOptions: FilterOption[];
  onRequestTypeChange: (v: string) => void;
  onPriorityChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onReset: () => void;
  shown: number;
  total: number;
}) {
  const hasFilter = requestType !== ALL || priority !== ALL || status !== ALL;

  return (
    <Card className="my-3 px-4 py-3 flex-row flex-wrap items-center gap-3">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Filter className="w-3.5 h-3.5" /> Шүүлтүүр
      </span>

      <FilterSelect
        label="Хүсэлтийн төрөл"
        value={requestType}
        options={requestTypeOptions}
        onChange={onRequestTypeChange}
      />
      <FilterSelect
        label="Эрэмбэ"
        value={priority}
        options={priorityOptions}
        onChange={onPriorityChange}
      />
      <FilterSelect
        label="Статус"
        value={status}
        options={statusOptions}
        onChange={onStatusChange}
      />

      {hasFilter && (
        <>
          <Separator orientation="vertical" className="h-5" />
          <span className="text-xs text-muted-foreground">
            {shown} / {total} ticket
          </span>
          <Button variant="ghost" size="xs" onClick={onReset}>
            <X /> Цэвэрлэх
          </Button>
        </>
      )}
    </Card>
  );
}

// ── Result row ────────────────────────────────────────────────────────────────
function ResultRow({ r }: { r: SyncResult }) {
  const icon =
    r.status === "created" ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> :
    r.status === "skipped" ? <SkipForward className="w-4 h-4 text-muted-foreground" /> :
    <XCircle className="w-4 h-4 text-destructive" />;
  const label =
    r.status === "created"
      ? "Үүслээ"
      : r.status === "skipped"
      ? "Давхардал (алгасав)"
      : "Алдаа";

  return (
    <TableRow>
      <TableCell className="px-3 font-mono text-xs text-muted-foreground">
        {r.key}
      </TableCell>
      <TableCell className="px-3 max-w-xs truncate">{r.summary}</TableCell>
      <TableCell className="px-3">
        <span className="inline-flex items-center gap-1.5">
          {icon} {label}
        </span>
      </TableCell>
      <TableCell className="px-3">
        {r.status === "created" && r.taskUrl ? (
          <a
            href={r.taskUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline text-xs"
          >
            Planner харах →
          </a>
        ) : r.status === "error" ? (
          <span className="text-destructive text-xs">{r.error}</span>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

// ── Sync summary stat ─────────────────────────────────────────────────────────
function StatCard({
  value,
  label,
  icon,
  className,
}: {
  value: number;
  label: string;
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("py-4 gap-1 text-center", className)}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="inline-flex items-center justify-center gap-1 text-xs">
        {icon} {label}
      </div>
    </Card>
  );
}

// ── Teams Report Panel ────────────────────────────────────────────────────────

interface TeamsReportResult {
  type: ReportType;
  sent: boolean;
  preview: string;
}

function TeamsPanel() {
  const [loading, setLoading] = useState<"preview" | "send" | null>(null);
  const [result, setResult] = useState<TeamsReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePreview = async () => {
    setLoading("preview");
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/teams/report?type=digest");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Алдаа гарлаа");
      setResult({ type: "digest", sent: false, preview: data.message ?? "" });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  };

  const handleSend = async () => {
    setLoading("send");
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/teams/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "digest", send: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Алдаа гарлаа");
      setResult({ type: "digest", sent: true, preview: data.message ?? "" });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card className="py-0 gap-0">
      <div className="px-5 py-4 border-b flex items-center gap-2">
        <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
          <MessageSquare className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Teams өдрийн digest</h2>
          <p className="text-xs text-muted-foreground">
            Today&apos;s focus · Who&apos;s on what · Yesterday&apos;s wins — товч дарж илгээнэ
          </p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={handlePreview}
            disabled={!!loading}
          >
            {loading === "preview" ? <Spinner /> : <Eye />}
            Preview
          </Button>
          <Button
            size="lg"
            onClick={handleSend}
            disabled={!!loading}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {loading === "send" ? <Spinner /> : <Send />}
            Teams-д илгээх
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <XCircle />
            <AlertTitle>Алдаа</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="space-y-2">
            {result.sent ? (
              <Badge variant="secondary" className={tone.emerald}>
                <CheckCheck /> Teams-д амжилттай илгээлээ
              </Badge>
            ) : (
              <Badge variant="outline">
                <Eye /> Preview — илгээгээгүй
              </Badge>
            )}
            <pre className="bg-muted/50 border rounded-lg px-4 py-3 text-xs whitespace-pre-wrap font-sans leading-relaxed max-h-96 overflow-y-auto">
              {result.preview}
            </pre>
          </div>
        )}
      </div>
    </Card>
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
  const [plannerStatusMap, setPlannerStatusMap] = useState<Map<string, { status: string; taskId: string }>>(new Map());
  const [downloading, setDownloading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [completeSummary, setCompleteSummary] = useState<{
    completed: number;
    open: number;
    errors: number;
    checked: number;
    results: { key: string; status: string; jiraStatus?: string; error?: string }[];
  } | null>(null);
  const [requestTypeFilter, setRequestTypeFilter] = useState<string>(ALL);
  const [priorityFilter, setPriorityFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);

  const resetFilters = () => {
    setRequestTypeFilter(ALL);
    setPriorityFilter(ALL);
    setStatusFilter(ALL);
  };

  const hasData = allTickets.length > 0;

  // ── Fetch ──
  const loadTickets = useCallback(async (opts?: { preserveUi?: boolean }) => {
    setLoading(true);
    setFetchError(null);

    if (!opts?.preserveUi) {
      setResults(null);
      setSummary(null);
      setSelected(new Set());
      setPlannerStatusMap(new Map());
      setActiveTab("all");
      setRequestTypeFilter(ALL);
      setPriorityFilter(ALL);
      setStatusFilter(ALL);
    }

    try {
      const [jiraRes, plannerRes] = await Promise.all([
        fetch("/api/jira/tickets"),
        fetch("/api/planner/tasks"),
      ]);
      const data = await jiraRes.json();
      if (!jiraRes.ok) throw new Error(data.error ?? "Ticket татахад алдаа гарлаа");
      const nextAll: TicketWithParticipants[] = data.allTickets ?? [];
      setAllTickets(nextAll);
      setByPerson(data.byPerson ?? []);

      if (opts?.preserveUi) {
        const keys = new Set(nextAll.map((t) => t.key));
        setSelected((prev) => new Set([...prev].filter((k) => keys.has(k))));
      }

      // Planner-д аль хэдийн байгаа task-уудыг тэмдэглэнэ
      if (plannerRes.ok) {
        const plannerData = await plannerRes.json();
        const map = new Map<string, { status: string; taskId: string }>();
        for (const t of (plannerData.tasks ?? [])) {
          map.set(t.key, { status: t.status, taskId: t.taskId ?? "" });
        }
        setPlannerStatusMap(map);
      }
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Хуудсанэ ачаахд шууд ачаах
  useEffect(() => { loadTickets(); }, [loadTickets]);

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
      const syncResults: SyncResult[] = data.results ?? [];
      setResults(syncResults);
      setSummary({
        created: data.created,
        skipped: data.skipped,
        errors: data.errors,
      });
      // Sync дууссаны дараа taskId-г авахын тулд planner task-уудыг дахин татна
      const refreshRes = await fetch("/api/planner/tasks");
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        setPlannerStatusMap((prev) => {
          const next = new Map(prev);
          for (const t of (refreshData.tasks ?? [])) {
            next.set(t.key, { status: t.status, taskId: t.taskId ?? "" });
          }
          return next;
        });
      } else {
        setPlannerStatusMap((prev) => {
          const next = new Map(prev);
          syncResults
            .filter((r) => r.status === "created" || r.status === "skipped")
            .forEach((r) => {
              if (!next.has(r.key)) next.set(r.key, { status: "Not Started", taskId: "" });
            });
          return next;
        });
      }
    } catch (e: unknown) {
      setSyncError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  };

  // ── Planner status change ──
  const handleStatusChange = async (key: string, taskId: string, newStatus: string) => {
    if (!taskId) return;
    // Optimistically update UI
    setPlannerStatusMap((prev) => {
      const next = new Map(prev);
      const cur = next.get(key);
      if (cur) next.set(key, { ...cur, status: newStatus });
      return next;
    });
    try {
      const res = await fetch("/api/planner/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        // Rollback on error
        setPlannerStatusMap((prev) => {
          const next = new Map(prev);
          const cur = next.get(key);
          if (cur) next.set(key, { ...cur, status: cur.status });
          return next;
        });
        console.error("Status солиход алдаа:", data.error);
      }
    } catch (e) {
      console.error("Status солиход алдаа:", e);
    }
  };

  // ── Jira хаагдсан → Planner Complete ──
  const completeResolvedInPlanner = async () => {
    setCompleting(true);
    setCompleteError(null);
    setCompleteSummary(null);
    try {
      const res = await fetch("/api/planner/complete-resolved", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Complete хийхэд алдаа гарлаа");

      setCompleteSummary({
        completed: data.completed ?? 0,
        open: data.open ?? 0,
        errors: data.errors ?? 0,
        checked: data.checked ?? 0,
        results: data.results ?? [],
      });

      // Planner map шинэчлэх
      setPlannerStatusMap((prev) => {
        const next = new Map(prev);
        for (const r of data.results ?? []) {
          if (r.status === "completed") {
            const cur = next.get(r.key);
            if (cur) next.set(r.key, { ...cur, status: "Completed" });
            else next.set(r.key, { status: "Completed", taskId: r.taskId ?? "" });
          }
        }
        return next;
      });

      // Нээлттэй жагсаалтыг ч шинэчилнэ (хаагдсан ticket арилах)
      await loadTickets({ preserveUi: true });
    } catch (e: unknown) {
      setCompleteError(e instanceof Error ? e.message : String(e));
    } finally {
      setCompleting(false);
    }
  };

  // ── Download Excel report ──
  const downloadReport = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/report/download");
      if (!res.ok) throw new Error("Татаж авахад алдаа гарлаа");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? "daily-ticket-info.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  // ── Current tab tickets ──
  const tabTickets = (
    activeTab === "all"
      ? allTickets
      : (byPerson.find((p) => p.email === activeTab)?.tickets ?? [])
  ).slice().sort((a, b) =>
    new Date(b.fields.created).getTime() - new Date(a.fields.created).getTime()
  );

  // Шүүлтүүрийн сонголтууд — идэвхтэй табын ticket-үүдээс тоолж гаргана
  const requestTypeOptions = buildOptions(tabTickets.map((t) => getRequestTypeName(t) ?? NONE));
  const priorityOptions = buildOptions(tabTickets.map(getPriorityName), PRIORITY_ORDER);
  const statusOptions = buildOptions(tabTickets.map((t) => t.fields.status?.name ?? NONE));

  const currentTickets = tabTickets.filter(
    (t) =>
      (requestTypeFilter === ALL || (getRequestTypeName(t) ?? NONE) === requestTypeFilter) &&
      (priorityFilter === ALL || getPriorityName(t) === priorityFilter) &&
      (statusFilter === ALL || (t.fields.status?.name ?? NONE) === statusFilter)
  );

  return (
    <div className="min-h-screen bg-muted/40 font-sans">
      {/* Header */}
      <header className="bg-card border-b px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-lg flex items-center justify-center font-bold text-sm">
          J→P
        </div>
        <div>
          <h1 className="text-lg font-semibold">Jira → Microsoft Planner</h1>
          <p className="text-xs text-muted-foreground">DC project -- GP team</p>
        </div>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Controls */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={() => loadTickets({ preserveUi: true })}
            disabled={loading}
          >
            <RefreshCw className={cn(loading && "animate-spin")} />
            {loading ? "Татаж байна…" : "Шинэчлэх"}
          </Button>

          {hasData && (
            <Button
              size="lg"
              onClick={syncToPlanner}
              disabled={syncing || selected.size === 0}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {syncing ? (
                <>
                  <Spinner /> Sync хийж байна…
                </>
              ) : (
                `Planner-д нэмэх${selected.size > 0 ? ` (${selected.size})` : ""}`
              )}
            </Button>
          )}

          <Button
            size="lg"
            variant="outline"
            onClick={completeResolvedInPlanner}
            disabled={completing || loading}
            title="Planner дээрх task-уудыг Jira-тай тулгаж, хаагдсаныг Complete болгоно"
          >
            {completing ? (
              <>
                <Spinner /> Шалгаж байна…
              </>
            ) : (
              <>
                <CheckCheck /> Хаагдсаныг Complete
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={downloadReport}
            disabled={downloading}
            className="ml-auto"
          >
            {downloading ? (
              <>
                <Spinner /> Татаж байна…
              </>
            ) : (
              <>
                <Download /> Өдрийн тайлан (.xlsx)
              </>
            )}
          </Button>
        </div>

        {/* Errors */}
        {fetchError && (
          <Alert variant="destructive">
            <XCircle />
            <AlertTitle>Алдаа</AlertTitle>
            <AlertDescription>{fetchError}</AlertDescription>
          </Alert>
        )}
        {syncError && (
          <Alert variant="destructive">
            <XCircle />
            <AlertTitle>Sync алдаа</AlertTitle>
            <AlertDescription>{syncError}</AlertDescription>
          </Alert>
        )}
        {completeError && (
          <Alert variant="destructive">
            <XCircle />
            <AlertTitle>Complete алдаа</AlertTitle>
            <AlertDescription>{completeError}</AlertDescription>
          </Alert>
        )}
        {completeSummary && (
          <Alert>
            <CheckCircle2 />
            <AlertTitle>Jira → Planner Complete</AlertTitle>
            <AlertDescription>
              Шалгасан: {completeSummary.checked} · Completed: {completeSummary.completed} ·
              Нээлттэй: {completeSummary.open} · Алдаа: {completeSummary.errors}
              {completeSummary.results.filter((r) => r.status === "completed").length > 0 && (
                <span className="block mt-1 text-muted-foreground">
                  {completeSummary.results
                    .filter((r) => r.status === "completed")
                    .map((r) => r.key)
                    .join(", ")}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Tabs + table */}
        {hasData && (
          <div className="space-y-0">
            {/* Tab bar */}
            <div className="flex items-center gap-3">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="all">
                    Бүгд
                    <Badge variant="secondary">{allTickets.length}</Badge>
                  </TabsTrigger>
                  {byPerson.map((p) => (
                    <TabsTrigger key={p.email} value={p.email}>
                      {p.displayName}
                      <Badge variant="secondary">{p.tickets.length}</Badge>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {selected.size > 0 && (
                <Badge className="ml-auto">{selected.size} сонгогдсон</Badge>
              )}
            </div>

            {/* Filters */}
            <FilterBar
              requestType={requestTypeFilter}
              priority={priorityFilter}
              status={statusFilter}
              requestTypeOptions={requestTypeOptions}
              priorityOptions={priorityOptions}
              statusOptions={statusOptions}
              onRequestTypeChange={setRequestTypeFilter}
              onPriorityChange={setPriorityFilter}
              onStatusChange={setStatusFilter}
              onReset={resetFilters}
              shown={currentTickets.length}
              total={tabTickets.length}
            />

            {/* Table */}
            <TicketTable
              tickets={currentTickets}
              showParticipants={activeTab === "all"}
              selected={selected}
              onToggleOne={toggleOne}
              onToggleAll={toggleGroup}
              plannerStatusMap={plannerStatusMap}
              onStatusChange={handleStatusChange}
            />
          </div>
        )}

        {/* Sync results */}
        {summary && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <StatCard
                value={summary.created}
                label="Амжилттай үүссэн"
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                className={tone.emerald}
              />
              <StatCard
                value={summary.skipped}
                label="Алгасагдсан (давхардал)"
                icon={<SkipForward className="w-3.5 h-3.5" />}
                className={tone.neutral}
              />
              <StatCard
                value={summary.errors}
                label="Алдаатай"
                icon={<XCircle className="w-3.5 h-3.5" />}
                className={tone.red}
              />
            </div>

            {results && results.length > 0 && (
              <Card className="py-0 gap-0">
                <div className="px-4 py-3 border-b">
                  <span className="text-sm font-medium">Дэлгэрэнгүй үр дүн</span>
                </div>
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent">
                      {["Key", "Гарчиг", "Үр дүн", "Холбоос / Алдаа"].map((c) => (
                        <TableHead
                          key={c}
                          className="px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                        >
                          {c}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r) => (
                      <ResultRow key={r.key} r={r} />
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </div>
        )}

        {/* Empty state */}
        {!loading && !hasData && !fetchError && (
          <div className="text-center py-20 text-muted-foreground">
            <div className="flex items-center justify-center mb-3 opacity-50">
              <ClipboardList className="w-12 h-12" />
            </div>
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
