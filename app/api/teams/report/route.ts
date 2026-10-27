/**
 * Teams тайлан API
 *
 * GET  /api/teams/report?type=digest|daily|morning|evening&email=xxx  → preview
 * POST /api/teams/report  body: { type, send?: true }  → товчоор Teams-д илгээнэ
 */
import { NextRequest, NextResponse } from "next/server";
import {
  generateReports,
  generateDailyDigest,
  type ReportType,
} from "@/lib/planner-report";
import {
  sendTeamsMessage,
  sendTeamsMultiSection,
} from "@/lib/teams-webhook";
import { PARTICIPANTS } from "@/lib/jira";
import { assertApiSession } from "@/lib/session";

const MEMBERS = PARTICIPANTS;

function getMembers(email?: string | null) {
  if (!email) return MEMBERS;
  const found = MEMBERS.filter((m) => m.email === email);
  return found.length ? found : null;
}

function isDigestType(type: string) {
  return type === "digest" || type === "team";
}

export async function GET(req: NextRequest) {
  const denied = await assertApiSession();
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const type = (searchParams.get("type") ?? "digest") as ReportType;
    const email = searchParams.get("email");

    const members = getMembers(email);
    if (!members) {
      return NextResponse.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });
    }

    if (isDigestType(type)) {
      const { message, reports } = await generateDailyDigest(members);
      return NextResponse.json({
        type: "digest",
        message,
        members: reports.map((r) => ({ displayName: r.displayName, stats: r.stats })),
      });
    }

    const reports = await generateReports(members, type);
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

export async function POST(req: NextRequest) {
  const denied = await assertApiSession();
  if (denied) return denied;

  try {
    const body = (await req.json().catch(() => ({}))) as {
      type?: string;
      email?: string;
      send?: boolean;
    };

    const type = (body.type ?? "digest") as ReportType;
    const send = body.send ?? false;
    const email = body.email;

    const members = getMembers(email);
    if (!members) {
      return NextResponse.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });
    }

    if (isDigestType(type)) {
      const { message, reports } = await generateDailyDigest(members);
      if (send) {
        await sendTeamsMessage(message, "GP Daily Digest");
      }
      return NextResponse.json({
        type: "digest",
        sent: send,
        message,
        members: reports.map((r) => ({ displayName: r.displayName, stats: r.stats })),
      });
    }

    const reports = await generateReports(members, type);

    if (send) {
      if (reports.length === 1) {
        await sendTeamsMessage(reports[0].message);
      } else {
        await sendTeamsMultiSection(
          type === "morning"
            ? "☀️ Өглөөний тайлан"
            : type === "evening"
              ? "🌙 Оройн тайлан"
              : "📋 Таскийн тойм",
          reports.map((r) => ({ title: r.displayName, text: r.message }))
        );
      }
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
