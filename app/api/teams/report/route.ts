/**
 * Teams тайлан API
 *
 * GET  /api/teams/report?type=daily|morning|evening|team&email=xxx
 *      → тайланг preview хийнэ (Teams-д илгээхгүй)
 *
 * POST /api/teams/report
 *      body: { type: "daily"|"morning"|"evening"|"team", email?: "...", send?: true }
 *      → send=true бол Teams webhook-оор илгээнэ
 *
 * Scheduled cron (vercel.json):
 *   morning → 09:00 МУБ (UTC+8 → 01:00 UTC)  → type=morning
 *   evening → 18:00 МУБ (UTC+8 → 10:00 UTC)  → type=evening, send=true
 *   weekly  → Баасан 17:00 МУБ               → type=team,    send=true
 */
import { NextRequest, NextResponse } from "next/server";
import {
  generateReports,
  formatTeamReport,
  type ReportType,
} from "@/lib/planner-report";
import {
  sendTeamsMessage,
  sendTeamsMultiSection,
} from "@/lib/teams-webhook";
import { PARTICIPANTS } from "@/lib/jira";

// ── Хэрэглэгчийн жагсаалт (jira.ts-н PARTICIPANTS ашиглана) ─────────────────

const MEMBERS = PARTICIPANTS; // { email, displayName }[]

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMembers(email?: string | null) {
  if (!email) return MEMBERS;
  const found = MEMBERS.filter((m) => m.email === email);
  return found.length ? found : null;
}

// ── GET — preview (илгээхгүй) ─────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type  = (searchParams.get("type") ?? "daily") as ReportType;
    const email = searchParams.get("email");

    const members = getMembers(email);
    if (!members) {
      return NextResponse.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });
    }

    const reports = await generateReports(members, type === "team" ? "daily" : type);

    if (type === "team") {
      return NextResponse.json({
        type,
        message: formatTeamReport(reports),
        members: reports.map((r) => ({ displayName: r.displayName, stats: r.stats })),
      });
    }

    return NextResponse.json({
      type,
      reports: reports.map((r) => ({
        displayName: r.displayName,
        stats: r.stats,
        message: r.message,
      })),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── POST — Teams-д илгээх ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json().catch(() => ({})) as {
      type?:  string;
      email?: string;
      send?:  boolean;
    };

    const type   = (body.type  ?? "daily") as ReportType;
    const send   = body.send   ?? false;
    const email  = body.email;

    const members = getMembers(email);
    if (!members) {
      return NextResponse.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });
    }

    const reportType = type === "team" ? "daily" : type;
    const reports    = await generateReports(members, reportType);

    // ── Teams-д илгээх ──────────────────────────────────────────────────────
    if (send) {
      if (type === "team") {
        // Нэгдсэн тайлан — нэг карт
        const teamMsg = formatTeamReport(reports);
        await sendTeamsMessage(teamMsg);
      } else if (reports.length === 1) {
        // Нэг хүн — энгийн мессеж
        await sendTeamsMessage(reports[0].message);
      } else {
        // Олон хүн — хэсэг тус бүр
        await sendTeamsMultiSection(
          type === "morning" ? "☀️ Өглөөний тайлан" :
          type === "evening" ? "🌙 Оройн тайлан"    : "📋 Таскийн тойм",
          reports.map((r) => ({ title: r.displayName, text: r.message }))
        );
      }
    }

    // ── Хариу буцаах ────────────────────────────────────────────────────────
    if (type === "team") {
      return NextResponse.json({
        type,
        sent: send,
        message: formatTeamReport(reports),
        members: reports.map((r) => ({ displayName: r.displayName, stats: r.stats })),
      });
    }

    return NextResponse.json({
      type,
      sent: send,
      reports: reports.map((r) => ({
        displayName: r.displayName,
        stats: r.stats,
        message: r.message,
      })),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
