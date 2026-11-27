import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Gift, Profile } from "@/lib/team-catalog";

/**
 * GP Arena-ийн character, badge, mood-ыг хадгалах store.
 *
 * - Upstash Redis-ийн env тохируулсан бол (Vercel дээр) Redis-д нэг JSON key-ээр хадгална.
 *   Vercel Marketplace → "Upstash for Redis" холбоход KV_REST_API_URL / KV_REST_API_TOKEN
 *   (эсвэл UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN) автоматаар орно.
 * - Үгүй бол local `data/team-hub.json` файлд хадгална (dev, self-hosted).
 */
type HubData = {
  profiles: Record<string, Profile>;
  gifts: Gift[];
  /** memberId → YYYY-MM-DD → 1..5 */
  moods: Record<string, Record<string, number>>;
};

const REDIS_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "";
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
const REDIS_KEY = process.env.TEAM_HUB_KEY ?? "gp-arena:hub";
const FILE = process.env.TEAM_HUB_FILE ?? path.join(process.cwd(), "data", "team-hub.json");

const useRedis = !!(REDIS_URL && REDIS_TOKEN);

function parse(raw: string | null | undefined): HubData {
  const data = (raw ? JSON.parse(raw) : {}) as Partial<HubData>;
  return { profiles: data.profiles ?? {}, gifts: data.gifts ?? [], moods: data.moods ?? {} };
}

// ── Redis (Upstash REST) ────────────────────────────────────────────────────

async function redis<T>(command: (string | number)[]): Promise<T> {
  const res = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { result?: T; error?: string };
  if (!res.ok || body.error) throw new Error(`Redis алдаа: ${body.error ?? res.status}`);
  return body.result as T;
}

/** Утга нь уншсанаас хойш өөрчлөгдөөгүй бол л бичнэ (өөр instance-тэй зөрчилдөхөөс сэргийлнэ) */
const CAS_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if (current == false and ARGV[1] == '') or current == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2])
  return 1
end
return 0`;

async function mutateRedis<T>(fn: (data: HubData) => T | Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const raw = await redis<string | null>(["GET", REDIS_KEY]);
    const data = parse(raw);
    const result = await fn(data);
    const ok = await redis<number>(["EVAL", CAS_SCRIPT, 1, REDIS_KEY, raw ?? "", JSON.stringify(data)]);
    if (ok === 1) return result;
  }
  throw new Error("Хадгалах үед зөрчил гарлаа, дахин оролдоно уу");
}

// ── Local file ──────────────────────────────────────────────────────────────

let queue: Promise<unknown> = Promise.resolve();

async function loadFile(): Promise<HubData> {
  try {
    return parse(await readFile(FILE, "utf8"));
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return parse(null);
    throw error;
  }
}

async function saveFile(data: HubData) {
  if (process.env.VERCEL) {
    throw new Error(
      "Vercel дээр хадгалах сан тохируулаагүй байна — Upstash Redis холбоно уу (KV_REST_API_URL, KV_REST_API_TOKEN)"
    );
  }
  await mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await rename(tmp, FILE);
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function readHub(): Promise<HubData> {
  if (useRedis) return parse(await redis<string | null>(["GET", REDIS_KEY]));
  await queue.catch(() => undefined);
  return loadFile();
}

/** Уншиж → өөрчилж → бичих үйлдлийг аюулгүй гүйцэтгэнэ */
export function mutateHub<T>(fn: (data: HubData) => T | Promise<T>): Promise<T> {
  if (useRedis) return mutateRedis(fn);
  const run = queue.catch(() => undefined).then(async () => {
    const data = await loadFile();
    const result = await fn(data);
    await saveFile(data);
    return result;
  });
  queue = run;
  return run;
}
