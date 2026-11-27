"use client";

import { useMemo, useState } from "react";
import { Ban, Check, Gift, Loader2, Lock, Send, ShoppingBag } from "lucide-react";
import {
  ACHIEVEMENTS,
  GIFT_BADGES,
  GIFT_BADGE_IDS,
  GIFT_MESSAGE_MAX,
  PALETTES,
  PALETTE_IDS,
  SPECIES,
  SPECIES_LABEL,
  OUTFIT_ITEMS,
  OUTFIT_SLOT_LABEL,
  TITLE_MAX,
  type GiftBadgeId,
  type Outfit,
  type OutfitSlot,
  type PaletteId,
  type Species,
} from "@/lib/team-catalog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Character } from "@/components/team/character";
import { GiftMedal } from "@/components/team/medal";
import type { TeamMember, TeamPayload } from "@/components/team/types";

async function send(method: "POST" | "PUT", body: unknown): Promise<TeamPayload> {
  const res = await fetch("/api/team", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as TeamPayload & { error?: string };
  if (!res.ok) throw new Error(data.error || "Алдаа гарлаа");
  return data;
}

const CONFETTI_COLORS = ["#FFC83D", "#F2709C", "#4FA3F7", "#3DCB9A", "#9B7BF2", "#F97352"];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        const angle = (i / 28) * Math.PI * 2;
        const dist = 90 + ((i * 37) % 70);
        return {
          dx: `${Math.cos(angle) * dist}px`,
          dy: `${Math.sin(angle) * dist - 30}px`,
          rot: `${(i * 97) % 360}deg`,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          round: i % 3 === 0,
        };
      }),
    []
  );
  return (
    <div className="pointer-events-none absolute top-1/2 left-1/2" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className={cn("arena-confetti absolute block h-2 w-1.5", p.round && "size-2 rounded-full")}
          style={{ background: p.color, ["--dx" as string]: p.dx, ["--dy" as string]: p.dy, ["--rot" as string]: p.rot }}
        />
      ))}
    </div>
  );
}

// ── Badge бэлэглэх ──────────────────────────────────────────────────────────

type GiftProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: TeamMember[];
  initialTo: string | null;
  me: TeamPayload["me"];
  onDone: (data: TeamPayload) => void;
};

export function GiftDialog(props: GiftProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-xl">{props.open && <GiftBody key={props.initialTo ?? "-"} {...props} />}</DialogContent>
    </Dialog>
  );
}

function GiftBody({ onOpenChange, members, initialTo, me, onDone }: GiftProps) {
  const candidates = members.filter((m) => m.id !== me.memberId);
  const [to, setTo] = useState<string | null>(initialTo ?? candidates[0]?.id ?? null);
  const [badge, setBadge] = useState<GiftBadgeId>("helper");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const target = members.find((m) => m.id === to);
  const meta = GIFT_BADGES[badge];

  async function submit() {
    if (!to) return;
    setBusy(true);
    setError("");
    try {
      const data = await send("POST", { to, badge, message });
      setSent(true);
      onDone(data);
      setTimeout(() => onOpenChange(false), 1700);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
        {sent && target ? (
          <div className="relative flex flex-col items-center gap-3 py-8 text-center">
            <Confetti />
            <GiftMedal badge={badge} size={88} className="arena-pop" />
            <DialogTitle>{target.name}-д &ldquo;{meta.name}&rdquo; хүрлээ!</DialogTitle>
            <DialogDescription>Сайхан үг хэлсэнд баярлалаа. Таны kudos feed-д харагдана.</DialogDescription>
          </div>
        ) : (
          <>
            <div className="space-y-1 pr-6">
              <DialogTitle className="flex items-center gap-2">
                <Gift className="size-5 text-rose-500" /> Badge бэлэглэх
              </DialogTitle>
              <DialogDescription>
                Хамт олондоо талархлаа илэрхийлээрэй — хэдэн ч удаа бэлэглэж болно.
              </DialogDescription>
            </div>

            <fieldset className="space-y-2">
              <legend className="mb-2 text-xs font-medium text-muted-foreground">Хэнд?</legend>
              <div className="flex flex-wrap gap-2">
                {candidates.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setTo(m.id)}
                    aria-pressed={to === m.id}
                    className={cn(
                      "flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      to === m.id
                        ? "border-foreground bg-foreground text-background"
                        : "hover:border-foreground/40 hover:bg-muted"
                    )}
                  >
                    <span className="flex size-7 items-center justify-center overflow-hidden rounded-full bg-muted">
                      <Character profile={m.profile} size={32} animated={false} className="translate-y-1" />
                    </span>
                    {m.name}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-xs font-medium text-muted-foreground">Ямар badge?</legend>
              <div className="grid grid-cols-4 gap-2">
                {GIFT_BADGE_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setBadge(id)}
                    aria-pressed={badge === id}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      badge === id
                        ? "border-foreground/60 bg-muted shadow-sm"
                        : "border-transparent hover:bg-muted/60"
                    )}
                  >
                    <GiftMedal badge={id} size={badge === id ? 46 : 40} className="transition-all" />
                    <span className="text-[11px] leading-tight font-medium">{GIFT_BADGES[id].name}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">{meta.blurb}</p>
            </fieldset>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Хэдэн үг (заавал биш)</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, GIFT_MESSAGE_MAX))}
                rows={2}
                placeholder={target ? `${target.name}, өчигдрийн incident дээр тусалсанд баярлалаа!` : ""}
                className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              />
              <span className="block text-right text-[11px] text-muted-foreground tabular-nums">
                {message.length}/{GIFT_MESSAGE_MAX}
              </span>
            </label>

            {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Болих
              </Button>
              <Button onClick={submit} disabled={busy || !to}>
                {busy ? <Loader2 className="animate-spin" /> : <Send />}
                Бэлэглэх
              </Button>
            </div>
          </>
        )}
    </>
  );
}

// ── Character засах ─────────────────────────────────────────────────────────

type CharacterProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
  onDone: (data: TeamPayload) => void;
};

export function CharacterDialog({ open, onOpenChange, member, onDone }: CharacterProps) {
  if (!member) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {open && <CharacterBody member={member} onOpenChange={onOpenChange} onDone={onDone} />}
      </DialogContent>
    </Dialog>
  );
}

function CharacterBody({
  member,
  onOpenChange,
  onDone,
}: {
  member: TeamMember;
  onOpenChange: (open: boolean) => void;
  onDone: (data: TeamPayload) => void;
}) {
  const [species, setSpecies] = useState<Species>(member.profile.species);
  const [palette, setPalette] = useState<PaletteId>(member.profile.palette);
  const [title, setTitle] = useState(member.profile.title);
  const [outfit, setOutfit] = useState<Outfit>(member.profile.outfit ?? {});
  const [pane, setPane] = useState<"look" | "shop">("look");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    try {
      onDone(await send("PUT", { species, palette, title, outfit }));
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
        <div className="space-y-1 pr-6">
          <DialogTitle>Миний character</DialogTitle>
          <DialogDescription>
            Дүр, өнгөө сонгоод дэлгүүрээс хувцаслаарай. Онцгой хувцсууд achievement-аар нээгдэнэ.
          </DialogDescription>
        </div>

        <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-2xl p-4"
            style={{ background: `color-mix(in oklab, ${PALETTES[palette].body} 16%, transparent)` }}
          >
            <Character profile={{ species, palette, outfit }} mood="happy" size={150} />
            <div className="text-center">
              <div className="font-semibold">{member.name}</div>
              <div className="min-h-4 text-xs text-muted-foreground italic">{title || "Цолгүй"}</div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex rounded-lg bg-muted p-0.5" role="tablist">
              {(
                [
                  ["look", "Дүр ба өнгө"],
                  ["shop", "Хувцасны дэлгүүр"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={pane === id}
                  onClick={() => setPane(id)}
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                    pane === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {id === "shop" && <ShoppingBag className="mr-1 inline size-3.5 align-[-2px]" />}
                  {label}
                </button>
              ))}
            </div>

            {pane === "shop" ? (
              <Wardrobe
                species={species}
                palette={palette}
                outfit={outfit}
                previous={member.profile.outfit ?? {}}
                unlocked={new Set(member.achievements)}
                onChange={setOutfit}
              />
            ) : (
            <>
            <fieldset>
              <legend className="mb-2 text-xs font-medium text-muted-foreground">Дүр</legend>
              <div className="grid grid-cols-3 gap-2">
                {SPECIES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpecies(s)}
                    aria-pressed={species === s}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border p-2 text-xs transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      species === s ? "border-foreground/60 bg-muted" : "border-transparent hover:bg-muted/60"
                    )}
                  >
                    <Character profile={{ species: s, palette, outfit }} size={48} animated={false} />
                    {SPECIES_LABEL[s]}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-xs font-medium text-muted-foreground">Өнгө</legend>
              <div className="flex flex-wrap gap-2">
                {PALETTE_IDS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPalette(p)}
                    aria-pressed={palette === p}
                    aria-label={PALETTES[p].label}
                    title={PALETTES[p].label}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-popover transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      palette === p && "ring-2 ring-foreground"
                    )}
                    style={{ background: `linear-gradient(135deg, ${PALETTES[p].body}, ${PALETTES[p].shade})` }}
                  >
                    {palette === p && <Check className="size-4 text-white" strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Цол</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
                placeholder="жишээ нь: Bug анчин"
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              />
            </label>
            </>
            )}
          </div>
        </div>

        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Болих
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Check />}
            Хадгалах
          </Button>
        </div>
    </>
  );
}

// ── Хувцасны дэлгүүр ────────────────────────────────────────────────────────

function Wardrobe({
  species,
  palette,
  outfit,
  previous,
  unlocked,
  onChange,
}: {
  species: Species;
  palette: PaletteId;
  outfit: Outfit;
  previous: Outfit;
  unlocked: Set<string>;
  onChange: (outfit: Outfit) => void;
}) {
  const achievementName = new Map(ACHIEVEMENTS.map((a) => [a.id, a.name]));
  return (
    <div className="space-y-4">
      {(Object.keys(OUTFIT_ITEMS) as OutfitSlot[]).map((slot) => (
        <fieldset key={slot}>
          <legend className="mb-2 text-xs font-medium text-muted-foreground">{OUTFIT_SLOT_LABEL[slot]}</legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => onChange({ ...outfit, [slot]: null })}
              aria-pressed={!outfit[slot]}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-xl border p-2 text-[11px] text-muted-foreground transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                !outfit[slot] ? "border-foreground/60 bg-muted text-foreground" : "border-dashed hover:bg-muted/60"
              )}
            >
              <Ban className="size-5" />
              Юу ч үгүй
            </button>
            {OUTFIT_ITEMS[slot].map((item) => {
              const locked = !!item.unlock && !unlocked.has(item.unlock) && previous[slot] !== item.id;
              const active = outfit[slot] === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={locked}
                  onClick={() => onChange({ ...outfit, [slot]: item.id })}
                  aria-pressed={active}
                  title={locked ? `Нээх: "${achievementName.get(item.unlock!)}" achievement` : item.name}
                  className={cn(
                    "relative flex flex-col items-center gap-0.5 rounded-xl border p-1.5 text-[11px] transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    active ? "border-foreground/60 bg-muted shadow-sm" : "border-transparent hover:bg-muted/60",
                    locked && "cursor-not-allowed opacity-60 hover:bg-transparent"
                  )}
                >
                  <Character
                    profile={{ species, palette, outfit: { [slot]: item.id } }}
                    size={52}
                    animated={false}
                    className={cn(locked && "grayscale")}
                  />
                  <span className="leading-tight font-medium">{item.name}</span>
                  {locked ? (
                    <span className="flex items-center gap-0.5 text-[10px] leading-tight text-muted-foreground">
                      <Lock className="size-2.5" /> {achievementName.get(item.unlock!)}
                    </span>
                  ) : item.unlock ? (
                    <span className="text-[10px] leading-tight text-amber-600 dark:text-amber-400">Онцгой</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
