import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getJiraAuthHeader } from "@/lib/jira";
import type { JiraTicket } from "@/types";

const JIRA_BASE_URL = process.env.JIRA_BASE_URL!;

const JIRA_FIELDS =
  "summary,assignee,reporter,priority,duedate,status,labels,comment,created,issuetype,components";

// ── Jira fetch ────────────────────────────────────────────────────────────────

async function fetchByJql(jql: string): Promise<JiraTicket[]> {
  const url = new URL(`${JIRA_BASE_URL}/rest/api/3/search/jql`);
  url.searchParams.set("jql", jql);
  url.searchParams.set("fields", JIRA_FIELDS);
  url.searchParams.set("maxResults", "100");

  const res = await fetch(url.toString(), {
    headers: { Authorization: getJiraAuthHeader(), Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.issues ?? []) as JiraTicket[];
}

/** Assignee displayName-аар өдрийн тикетүүдийг татна */
async function fetchDailyForAssignee(displayName: string): Promise<JiraTicket[]> {
  const today = new Date();
  const ymd = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}`;

  const [open, resolved] = await Promise.all([
    // Хаагдаагүй тикетүүд
    fetchByJql(
      `project = "DC" AND assignee = "${displayName}" AND status != Resolved ORDER BY created DESC`
    ),
    // Өнөөдөр хаагдсан тикетүүд
    fetchByJql(
      `project = "DC" AND assignee = "${displayName}" AND status = Resolved AND updated >= "${ymd}" ORDER BY updated DESC`
    ),
  ]);

  const seen = new Set<string>();
  const all: JiraTicket[] = [];
  for (const t of [...resolved, ...open]) {
    if (!seen.has(t.key)) { seen.add(t.key); all.push(t); }
  }
  return all;
}

/** Тайлан гаргах assignee-уудын жагсаалт */
const REPORT_ASSIGNEES = [
  { displayName: "Uyanga" },
  { displayName: "Khulan" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toExcelSerial(date: Date): number {
  return Math.floor(date.getTime() / 86400000) + 25569;
}

function isToday(date: Date): boolean {
  const n = new Date();
  return (
    date.getFullYear() === n.getFullYear() &&
    date.getMonth() === n.getMonth() &&
    date.getDate() === n.getDate()
  );
}

function ticketGroup(t: JiraTicket): "Closed ticket " | "New ticket " | "Open ticket " {
  const s = t.fields.status?.name?.toLowerCase() ?? "";
  if (s === "resolved" || s === "closed" || s === "done") return "Closed ticket ";
  if (isToday(new Date(t.fields.created))) return "New ticket ";
  return "Open ticket ";
}

function getSystem(t: JiraTicket): string {
  if (t.fields.components?.length) return t.fields.components[0].name;
  if (t.fields.labels?.length) return t.fields.labels[0];
  return "";
}

function getRequestType(t: JiraTicket): string {
  const mn: Record<string, string> = {
    Bug: "Доголдол",
    Improvement: "Сайжруулалт",
    Story: "Сайжруулалт",
    Task: "Бусад",
    Epic: "Бусад",
    Support: "Үйлчилгээ үзүүлсэн",
    Service: "Үйлчилгээ үзүүлсэн",
  };
  const label = mn[t.fields.issuetype?.name ?? ""] ?? t.fields.issuetype?.name ?? "Бусад";
  const pri = t.fields.priority?.name ?? "";
  return pri ? `${label}- ${pri} ` : label;
}

function adfToText(body: unknown): string {
  if (!body) return "";
  if (typeof body === "string") return body;
  const parts: string[] = [];
  function walk(n: unknown) {
    if (!n || typeof n !== "object") return;
    const node = n as { text?: string; content?: unknown[] };
    if (node.text) parts.push(node.text);
    node.content?.forEach(walk);
  }
  walk(body);
  return parts.join(" ").trim();
}

function getStatus(t: JiraTicket): string {
  const comments = t.fields.comment?.comments ?? [];
  if (!comments.length) return t.fields.status?.name ?? "";
  const last = comments[comments.length - 1];
  const author = last.author?.displayName ?? "";
  const text = adfToText(last.body);
  return author ? `${author}\r\n${text}` : text;
}

function getResolved(t: JiraTicket): string {
  const s = t.fields.status?.name?.toLowerCase() ?? "";
  if (s !== "resolved" && s !== "closed" && s !== "done") return "";
  const comments = t.fields.comment?.comments ?? [];
  if (!comments.length) return t.fields.status?.name ?? "";
  const last = comments[comments.length - 1];
  const author = last.author?.displayName ?? "";
  const text = adfToText(last.body);
  return author ? `${author}\r\n${text}` : text;
}

// ── Sheet builder — one sheet = one person, one day ───────────────────────────

type Merge = { s: { r: number; c: number }; e: { r: number; c: number } };

const GROUP_ORDER: ReturnType<typeof ticketGroup>[] = [
  "Closed ticket ",
  "New ticket ",
  "Open ticket ",
];

function buildDailySheet(
  tickets: JiraTicket[],
  _assignName: string,
  dateSerial: number,
  totalLabel: string
): XLSX.WorkSheet {
  const aoa: (string | number)[][] = [];
  const merges: Merge[] = [];

  // Header — exact column names from template (with trailing spaces)
  aoa.push([
    "Day ",
    "Total ticket",
    "Assign ",
    "Ticket types",
    "System ",
    "Ticket name ",
    "Request type",
    "Current status ",
    "Resolved issue",
  ]);

  // Group tickets
  const groups = new Map<string, JiraTicket[]>([
    ["Closed ticket ", []],
    ["New ticket ", []],
    ["Open ticket ", []],
  ]);
  for (const t of tickets) {
    groups.get(ticketGroup(t))!.push(t);
  }

  const dataStartRow = 1; // row index of first data row
  let curRow = dataStartRow;

  for (const groupKey of GROUP_ORDER) {
    const grpTickets = groups.get(groupKey)!;
    if (!grpTickets.length) continue;

    const typeStart = curRow;

    for (const t of grpTickets) {
      aoa.push([
        dateSerial,
        totalLabel,
        t.fields.assignee?.displayName ?? "",
        groupKey,
        getSystem(t),
        `${t.key} ${t.fields.summary}`,
        getRequestType(t),
        getStatus(t),
        getResolved(t),
      ]);
      curRow++;
    }

    // Merge Ticket types (col D = 3) for this group
    if (curRow - 1 > typeStart) {
      merges.push({ s: { r: typeStart, c: 3 }, e: { r: curRow - 1, c: 3 } });
    }
  }

  const lastDataRow = curRow - 1;

  // Merge Day (A=0) and Total ticket (B=1) for all data rows
  if (lastDataRow >= dataStartRow) {
    merges.push({ s: { r: dataStartRow, c: 0 }, e: { r: lastDataRow, c: 0 } });
    merges.push({ s: { r: dataStartRow, c: 1 }, e: { r: lastDataRow, c: 1 } });
  }

  // Merge Assign (C=2) for consecutive rows with the same assignee
  if (lastDataRow >= dataStartRow) {
    let blockStart = dataStartRow;
    for (let r = dataStartRow + 1; r <= lastDataRow + 1; r++) {
      const prev = aoa[r - 1]?.[2] ?? "";
      const cur  = aoa[r]?.[2]  ?? null;
      if (cur === null || cur !== prev) {
        if (r - 1 > blockStart) {
          merges.push({ s: { r: blockStart, c: 2 }, e: { r: r - 1, c: 2 } });
        }
        blockStart = r;
      }
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Format Day cells as date
  for (let r = dataStartRow; r <= lastDataRow; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: 0 });
    if (ws[addr]) { ws[addr].t = "n"; ws[addr].z = "m/d/yy"; }
  }

  ws["!merges"] = merges;
  ws["!cols"] = [
    { wch: 10 },  // A: Day
    { wch: 15 },  // B: Total ticket
    { wch: 20 },  // C: Assign
    { wch: 16 },  // D: Ticket types
    { wch: 12 },  // E: System
    { wch: 55 },  // F: Ticket name
    { wch: 24 },  // G: Request type
    { wch: 50 },  // H: Current status
    { wch: 50 },  // I: Resolved issue
  ];

  return ws;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const today = new Date();
    const dateSerial = toExcelSerial(today);

    // Sheet name = MMDD (e.g., "0612")
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const sheetDateLabel = `${mm}${dd}`;

    const wb = XLSX.utils.book_new();

    // Assignee бүрийн тикетийг зэрэгцээ татна
    const results = await Promise.all(
      REPORT_ASSIGNEES.map(async (a) => ({
        displayName: a.displayName,
        tickets: await fetchDailyForAssignee(a.displayName),
      }))
    );

    // Нэгтгэж давхардлыг арилгана
    const seen = new Set<string>();
    const allTickets: JiraTicket[] = [];
    for (const { tickets } of results) {
      for (const t of tickets) {
        if (!seen.has(t.key)) { seen.add(t.key); allTickets.push(t); }
      }
    }

    const totalLabel = `DC-${allTickets.length}`;
    const ws = buildDailySheet(allTickets, "", dateSerial, totalLabel);
    XLSX.utils.book_append_sheet(wb, ws, sheetDateLabel);

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const fileName = `daily-report-${today.getFullYear()}-${mm}-${dd}.xlsx`;

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
