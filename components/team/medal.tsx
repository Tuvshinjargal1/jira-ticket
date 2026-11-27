"use client";

import { useId } from "react";
import {
  Clock,
  Crown,
  Flame,
  Footprints,
  Gauge,
  GraduationCap,
  HandHeart,
  Heart,
  Lightbulb,
  Moon,
  Mountain,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { GIFT_BADGES, type GiftBadgeId } from "@/lib/team-catalog";
import { cn } from "@/lib/utils";

export const GIFT_ICONS: Record<GiftBadgeId, LucideIcon> = {
  helper: HandHeart,
  rocket: Rocket,
  idea: Lightbulb,
  shield: ShieldCheck,
  sunshine: Sun,
  mentor: GraduationCap,
  night: Moon,
  mvp: Crown,
};

export const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  first: Footprints,
  ten: Target,
  fifty: Mountain,
  streak3: Flame,
  streak5: Zap,
  punctual: Clock,
  clean: Sparkles,
  swift: Gauge,
  star: Star,
  loved: Heart,
};

const HEX = "M24 2.5 L43 13.25 L43 34.75 L24 45.5 L5 34.75 L5 13.25 Z";

/** Зургаан өнцөгт медаль — бэлэглэх badge */
export function GiftMedal({
  badge,
  size = 44,
  count,
  className,
}: {
  badge: GiftBadgeId;
  size?: number;
  count?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const meta = GIFT_BADGES[badge];
  const Icon = GIFT_ICONS[badge];
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden className="drop-shadow-sm">
        <defs>
          <linearGradient id={`m-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={meta.from} />
            <stop offset="100%" stopColor={meta.to} />
          </linearGradient>
        </defs>
        <path d={HEX} fill={`url(#m-${uid})`} />
        <path d={HEX} fill="none" stroke="#fff" strokeOpacity={0.55} strokeWidth={1.5} transform="translate(24 24) scale(0.82) translate(-24 -24)" />
        <path d="M5 13.25 L24 2.5 L43 13.25 L24 20 Z" fill="#fff" opacity={0.18} />
      </svg>
      <Icon
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white"
        style={{ width: size * 0.42, height: size * 0.42 }}
        strokeWidth={2.2}
        aria-hidden
      />
      {count !== undefined && count > 1 && (
        <span className="absolute -right-1 -bottom-1 min-w-[18px] rounded-full border-2 border-card bg-foreground px-1 text-center text-[10px] leading-[14px] font-bold text-background tabular-nums">
          {count}
        </span>
      )}
      <span className="sr-only">{meta.name}</span>
    </span>
  );
}

/** Автомат achievement — тойрог хэлбэртэй */
export function AchievementToken({
  id,
  unlocked,
  size = 40,
}: {
  id: string;
  unlocked: boolean;
  size?: number;
}) {
  const Icon = ACHIEVEMENT_ICONS[id] ?? Star;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        unlocked
          ? "border-amber-300 bg-gradient-to-br from-amber-200 to-orange-400 text-white shadow-sm shadow-amber-500/30 dark:border-amber-400/60"
          : "border-dashed border-border bg-muted text-muted-foreground/60"
      )}
      style={{ width: size, height: size }}
    >
      <Icon style={{ width: size * 0.45, height: size * 0.45 }} strokeWidth={2.2} aria-hidden />
    </span>
  );
}
