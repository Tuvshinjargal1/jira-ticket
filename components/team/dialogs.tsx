"use client";

import { useMemo, useState } from "react";
import { Check, Gift, Loader2, Send } from "lucide-react";
import {
  GIFT_BADGES,
  GIFT_BADGE_IDS,
  GIFT_MESSAGE_MAX,
  PALETTES,
  PALETTE_IDS,
  SPECIES,
  SPECIES_LABEL,
  TITLE_MAX,
  type GiftBadgeId,
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
  const noQuota = me.giftsLeft <= 0;

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
                Энэ долоо хоногт{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {me.giftsLeft}/{me.quota}
                </span>{" "}
                бэлэглэх эрх үлдсэн. Хүлээн авагч +15 XP авна.
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
              <Button onClick={submit} disabled={busy || !to || noQuota}>
                {busy ? <Loader2 className="animate-spin" /> : <Send />}
                {noQuota ? "Эрх дууссан" : "Бэлэглэх"}
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    try {
      onDone(await send("PUT", { species, palette, title }));
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
            Дүрээ сонгоорой. Level ахих тусам од, гялбаа, титэм нэмэгдэнэ.
          </DialogDescription>
        </div>

        <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-2xl p-4"
            style={{ background: `color-mix(in oklab, ${PALETTES[palette].body} 16%, transparent)` }}
          >
            <Character profile={{ species, palette }} level={member.level.level} mood="happy" size={150} />
            <div className="text-center">
              <div className="font-semibold">{member.name}</div>
              <div className="min-h-4 text-xs text-muted-foreground italic">{title || "Цолгүй"}</div>
            </div>
          </div>

          <div className="space-y-4">
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
                    <Character profile={{ species: s, palette }} size={48} animated={false} />
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
