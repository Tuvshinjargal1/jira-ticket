import { NextResponse } from "next/server";
import { getSession, type SessionUser } from "@/lib/session";
import {
  ACHIEVEMENTS,
  GIFT_BADGE_IDS,
  GIFT_MESSAGE_MAX,
  PALETTE_IDS,
  SPECIES,
  TITLE_MAX,
  WEEKLY_GIFT_QUOTA,
  computeXp,
  defaultProfile,
  levelFromXp,
  tierName,
  ubDay,
  weekStart,
  type Gift,
  type GiftBadgeId,
  type PaletteId,
  type Species,
} from "@/lib/team-catalog";
import { loadTeamStats, memberIdOf, type TeamMemberRaw } from "@/lib/team-stats";
import { mutateHub, readHub } from "@/lib/team-store";

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function identify(session: SessionUser, members: TeamMemberRaw[]) {
  const local = memberIdOf(session.email.split("@")[0] ?? "");
  const first = memberIdOf(session.name.split(/\s+/)[0] ?? "");
  const member = members.find((m) => m.id === local || m.id === first) ?? null;
  return { key: member?.id ?? local, memberId: member?.id ?? null };
}

function giftsLeft(gifts: Gift[], key: string): number {
  const week = weekStart(ubDay());
  const used = gifts.filter((g) => g.from === key && weekStart(ubDay(new Date(g.at))) === week).length;
  return Math.max(0, WEEKLY_GIFT_QUOTA - used);
}

async function buildPayload(session: SessionUser, fresh = false) {
  const [members, hub] = await Promise.all([loadTeamStats({ fresh }), readHub()]);
  const me = identify(session, members);
  const topWeek = Math.max(0, ...members.map((m) => m.stats.completed7));

  const enriched = members.map((m, index) => {
    const received = hub.gifts.filter((g) => g.to === m.id);
    const giftCounts: Partial<Record<GiftBadgeId, number>> = {};
    for (const g of received) giftCounts[g.badge] = (giftCounts[g.badge] ?? 0) + 1;
    const xp = computeXp(m.stats, received.length);
    const level = levelFromXp(xp);
    const ctx = { topWeek: topWeek > 0 && m.stats.completed7 === topWeek, giftsReceived: received.length };
    return {
      ...m,
      profile: hub.profiles[m.id] ?? defaultProfile(index),
      xp,
      level,
      tier: tierName(level.level),
      achievements: ACHIEVEMENTS.filter((a) => a.test(m.stats, ctx)).map((a) => a.id),
      giftsReceived: received.length,
      giftCounts,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    today: ubDay(),
    me: {
      memberId: me.memberId,
      name: session.name,
      giftsLeft: giftsLeft(hub.gifts, me.key),
      quota: WEEKLY_GIFT_QUOTA,
    },
    members: enriched,
    gifts: [...hub.gifts].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40),
  };
}

function fail(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : String(error);
  return NextResponse.json({ error: message }, { status: 500 });
}

async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new HttpError(401, "Нэвтрээгүй байна");
  return session;
}

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const fresh = new URL(req.url).searchParams.get("fresh") === "1";
    return NextResponse.json(await buildPayload(session, fresh), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return fail(error);
  }
}

/** Badge бэлэглэх */
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const body = (await req.json().catch(() => ({}))) as {
      to?: unknown;
      badge?: unknown;
      message?: unknown;
    };
    const members = await loadTeamStats();
    const me = identify(session, members);

    const to = typeof body.to === "string" ? body.to : "";
    const badge = body.badge as GiftBadgeId;
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!members.some((m) => m.id === to)) throw new HttpError(400, "Хүлээн авагч олдсонгүй");
    if (to === me.key) throw new HttpError(400, "Өөртөө badge бэлэглэх боломжгүй 🙂");
    if (!GIFT_BADGE_IDS.includes(badge)) throw new HttpError(400, "Badge буруу");
    if (message.length > GIFT_MESSAGE_MAX) {
      throw new HttpError(400, `Мессеж ${GIFT_MESSAGE_MAX} тэмдэгтээс богино байна`);
    }

    await mutateHub((hub) => {
      if (giftsLeft(hub.gifts, me.key) <= 0) {
        throw new HttpError(429, `Энэ долоо хоногийн ${WEEKLY_GIFT_QUOTA} badge-аа бэлэглэж дууссан`);
      }
      hub.gifts.push({
        id: crypto.randomUUID(),
        from: me.key,
        fromName: session.name,
        to,
        badge,
        message,
        at: new Date().toISOString(),
      });
    });

    return NextResponse.json(await buildPayload(session));
  } catch (error) {
    return fail(error);
  }
}

/** Өөрийн character-ийг өөрчлөх */
export async function PUT(req: Request) {
  try {
    const session = await requireSession();
    const body = (await req.json().catch(() => ({}))) as {
      species?: unknown;
      palette?: unknown;
      title?: unknown;
    };
    const members = await loadTeamStats();
    const me = identify(session, members);
    if (!me.memberId) throw new HttpError(403, "Та GP багийн гишүүнээр бүртгэгдээгүй байна");

    const species = body.species as Species;
    const palette = body.palette as PaletteId;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!SPECIES.includes(species)) throw new HttpError(400, "Character буруу");
    if (!PALETTE_IDS.includes(palette)) throw new HttpError(400, "Өнгө буруу");
    if (title.length > TITLE_MAX) throw new HttpError(400, `Цол ${TITLE_MAX} тэмдэгтээс богино байна`);

    const memberId = me.memberId;
    await mutateHub((hub) => {
      hub.profiles[memberId] = { species, palette, title };
    });

    return NextResponse.json(await buildPayload(session));
  } catch (error) {
    return fail(error);
  }
}
