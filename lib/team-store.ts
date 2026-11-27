import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Gift, Profile } from "@/lib/team-catalog";

/**
 * GP Arena-ийн character болон бэлэглэсэн badge-уудыг хадгалах энгийн JSON store.
 * Нэг server process дээр ажиллана гэж үзсэн (self-hosted). Serverless орчинд
 * DB/KV рүү шилжүүлэх хэрэгтэй.
 */
type HubData = {
  profiles: Record<string, Profile>;
  gifts: Gift[];
  /** memberId → YYYY-MM-DD → 1..5 */
  moods: Record<string, Record<string, number>>;
};

const FILE = process.env.TEAM_HUB_FILE ?? path.join(process.cwd(), "data", "team-hub.json");

let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<HubData> {
  try {
    const raw = await readFile(FILE, "utf8");
    const data = JSON.parse(raw) as Partial<HubData>;
    return { profiles: data.profiles ?? {}, gifts: data.gifts ?? [], moods: data.moods ?? {} };
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return { profiles: {}, gifts: [], moods: {} };
    throw error;
  }
}

async function save(data: HubData) {
  await mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await rename(tmp, FILE);
}

export async function readHub(): Promise<HubData> {
  await queue.catch(() => undefined);
  return load();
}

/** Уншиж → өөрчилж → бичих үйлдлийг дарааллаар гүйцэтгэнэ */
export function mutateHub<T>(fn: (data: HubData) => T | Promise<T>): Promise<T> {
  const run = queue.catch(() => undefined).then(async () => {
    const data = await load();
    const result = await fn(data);
    await save(data);
    return result;
  });
  queue = run;
  return run;
}
