import { NextResponse } from "next/server";
import { getSession, type SessionUser } from "@/lib/session";
import {
  ACHIEVEMENTS,
  GIFT_BADGE_IDS,
  GIFT_MESSAGE_MAX,
  MOODS,
  OUTFIT_ITEMS,
  PALETTE_IDS,
  REACTIONS,
  SPECIES,
  TITLE_MAX,
  addDays,
  defaultProfile,
  ubDay,
  type GiftBadgeId,
  type Outfit,
  type OutfitSlot,
  type PaletteId,
  type Species,
} from "@/lib/team-catalog";
import { loadTeamStats, memberIdOf, type TeamMemberRaw } from "@/lib/team-stats";
import { mutateHub, readHub } from "@/lib/team-store";

const MOOD_HISTORY_DAYS = 14;
const MOOD_KEEP_DAYS = 90;

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

async function buildPayload(session: SessionUser, fresh = false) {
  const [members, hub] = await Promise.all([loadTeamStats({ fresh }), readHub()]);
  const me = identify(session, members);
  const today = ubDay();
  const topWeek = Math.max(0, ...members.map((m) => m.stats.completed7));
  const historyDays = Array.from({ length: MOOD_HISTORY_DAYS }, (_, i) => addDays(today, i - (MOOD_HISTORY_DAYS - 1)));

  const enriched = members.map((m, index) => {
    const received = hub.gifts.filter((g) => g.to === m.id);
    const giftCounts: Partial<Record<GiftBadgeId, number>> = {};
    for (const g of received) giftCounts[g.badge] = (giftCounts[g.badge] ?? 0) + 1;
    const ctx = { topWeek: topWeek > 0 && m.stats.completed7 === topWeek, giftsReceived: received.length };
    const moods = hub.moods[m.id] ?? {};
    return {
      ...m,
      profile: hub.profiles[m.id] ?? defaultProfile(index),
      achievements: ACHIEVEMENTS.filter((a) => a.test(m.stats, ctx)).map((a) => a.id),
      giftsReceived: received.length,
      giftCounts,
      moodToday: moods[today] ?? null,
      moodHistory: historyDays.map((day) => moods[day] ?? null),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    today,
    me: { key: me.key, memberId: me.memberId, name: session.name },
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

type ActionBody = {
  action?: unknown;
  to?: unknown;
  badge?: unknown;
  message?: unknown;
  giftId?: unknown;
  emoji?: unknown;
  mood?: unknown;
};

/** action: "gift" (default) | "react" | "mood" */
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const body = (await req.json().catch(() => ({}))) as ActionBody;
    const members = await loadTeamStats();
    const me = identify(session, members);
    const action = typeof body.action === "string" ? body.action : "gift";

    if (action === "gift") {
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
    } else if (action === "react") {
      const giftId = typeof body.giftId === "string" ? body.giftId : "";
      const emoji = body.emoji as (typeof REACTIONS)[number];
      if (!REACTIONS.includes(emoji)) throw new HttpError(400, "Reaction буруу");
      await mutateHub((hub) => {
        const gift = hub.gifts.find((g) => g.id === giftId);
        if (!gift) throw new HttpError(404, "Kudos олдсонгүй");
        const reactions = (gift.reactions ??= {});
        const list = reactions[emoji] ?? [];
        reactions[emoji] = list.includes(me.key) ? list.filter((k) => k !== me.key) : [...list, me.key];
        if (!reactions[emoji].length) delete reactions[emoji];
      });
    } else if (action === "mood") {
      if (!me.memberId) throw new HttpError(403, "Та GP багийн гишүүнээр бүртгэгдээгүй байна");
      const mood = Number(body.mood);
      if (!MOODS.some((m) => m.value === mood)) throw new HttpError(400, "Mood буруу");
      const memberId = me.memberId;
      const today = ubDay();
      const cutoff = addDays(today, -MOOD_KEEP_DAYS);
      await mutateHub((hub) => {
        const days = (hub.moods[memberId] ??= {});
        days[today] = mood;
        for (const day of Object.keys(days)) if (day < cutoff) delete days[day];
      });
    } else {
      throw new HttpError(400, "Үйлдэл буруу");
    }

    return NextResponse.json(await buildPayload(session));
  } catch (error) {
    return fail(error);
  }
}

/** Өөрийн character, хувцсыг өөрчлөх */
export async function PUT(req: Request) {
  try {
    const session = await requireSession();
    const body = (await req.json().catch(() => ({}))) as {
      species?: unknown;
      palette?: unknown;
      title?: unknown;
      outfit?: unknown;
    };
    const payload = await buildPayload(session);
    const self = payload.members.find((m) => m.id === payload.me.memberId);
    if (!self) throw new HttpError(403, "Та GP багийн гишүүнээр бүртгэгдээгүй байна");

    const species = body.species as Species;
    const palette = body.palette as PaletteId;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!SPECIES.includes(species)) throw new HttpError(400, "Character буруу");
    if (!PALETTE_IDS.includes(palette)) throw new HttpError(400, "Өнгө буруу");
    if (title.length > TITLE_MAX) throw new HttpError(400, `Цол ${TITLE_MAX} тэмдэгтээс богино байна`);

    const rawOutfit = (body.outfit && typeof body.outfit === "object" ? body.outfit : {}) as Record<string, unknown>;
    const unlocked = new Set(self.achievements);
    const previous = self.profile.outfit ?? {};
    const outfit: Outfit = {};
    for (const slot of Object.keys(OUTFIT_ITEMS) as OutfitSlot[]) {
      const value = rawOutfit[slot];
      if (value === null || value === undefined || value === "") continue;
      const item = OUTFIT_ITEMS[slot].find((i) => i.id === value);
      if (!item) throw new HttpError(400, "Хувцас буруу");
      // Өмнө нь өмссөн зүйлийг achievement алдсан ч тайлуулахгүй
      if (item.unlock && !unlocked.has(item.unlock) && previous[slot] !== item.id) {
        throw new HttpError(403, `"${item.name}" хараахан нээгдээгүй байна`);
      }
      outfit[slot] = item.id;
    }

    const memberId = self.id;
    await mutateHub((hub) => {
      hub.profiles[memberId] = { species, palette, title, outfit };
    });

    return NextResponse.json(await buildPayload(session));
  } catch (error) {
    return fail(error);
  }
}
