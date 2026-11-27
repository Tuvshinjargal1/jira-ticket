"use client";

import { useId } from "react";
import { PALETTES, type Profile } from "@/lib/team-catalog";
import { cn } from "@/lib/utils";

export type Mood = "happy" | "normal" | "tired";

const INK = "#2B2140";
const GOLD = "#FFC83D";

type Props = {
  profile: Pick<Profile, "species" | "palette">;
  mood?: Mood;
  level?: number;
  size?: number;
  animated?: boolean;
  className?: string;
  label?: string;
};

function Eyes({ mood, color, robot }: { mood: Mood; color: string; robot: boolean }) {
  if (mood === "happy") {
    return (
      <g stroke={color} strokeWidth={3} strokeLinecap="round" fill="none">
        <path d="M43 67 Q47 61 51 67" />
        <path d="M69 67 Q73 61 77 67" />
      </g>
    );
  }
  if (mood === "tired") {
    return (
      <g stroke={color} strokeWidth={3} strokeLinecap="round">
        <path d="M43 66 L51 67" />
        <path d="M69 67 L77 66" />
      </g>
    );
  }
  return (
    <g className="arena-blink">
      <circle cx={47} cy={65} r={robot ? 4 : 4.4} fill={color} />
      <circle cx={73} cy={65} r={robot ? 4 : 4.4} fill={color} />
      {!robot && (
        <>
          <circle cx={48.5} cy={63.4} r={1.5} fill="#fff" />
          <circle cx={74.5} cy={63.4} r={1.5} fill="#fff" />
        </>
      )}
    </g>
  );
}

const BLOB = "M60 34 C86 34 98 52 98 74 C98 96 82 106 60 106 C38 106 22 96 22 74 C22 52 34 34 60 34 Z";

export function Character({
  profile,
  mood = "normal",
  level = 1,
  size = 96,
  animated = true,
  className,
  label,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const pal = PALETTES[profile.palette] ?? PALETTES.sky;
  const { species } = profile;
  const robot = species === "robot";
  const fill = `url(#body-${uid})`;

  const ears = (() => {
    switch (species) {
      case "fox":
        return (
          <>
            <path d="M94 92 C112 88 116 66 104 58 C108 74 98 84 88 86 Z" fill={pal.shade} />
            <path d="M104 58 C110 62 112 68 111 72 C107 68 104 64 104 58 Z" fill={pal.glow} />
            <path d="M30 56 L34 20 L56 40 Z" fill={pal.body} />
            <path d="M35 47 L37 28 L49 40 Z" fill={pal.glow} />
            <path d="M90 56 L86 20 L64 40 Z" fill={pal.body} />
            <path d="M85 47 L83 28 L71 40 Z" fill={pal.glow} />
          </>
        );
      case "bear":
        return (
          <>
            <circle cx={36} cy={42} r={12} fill={pal.body} />
            <circle cx={36} cy={42} r={6} fill={pal.shade} />
            <circle cx={84} cy={42} r={12} fill={pal.body} />
            <circle cx={84} cy={42} r={6} fill={pal.shade} />
          </>
        );
      case "cat":
        return (
          <>
            <path d="M28 58 L32 26 L52 40 Z" fill={pal.body} />
            <path d="M33 50 L35 33 L46 41 Z" fill={pal.glow} />
            <path d="M92 58 L88 26 L68 40 Z" fill={pal.body} />
            <path d="M87 50 L85 33 L74 41 Z" fill={pal.glow} />
          </>
        );
      case "owl":
        return (
          <>
            <path d="M34 46 L28 24 L50 38 Z" fill={pal.shade} />
            <path d="M86 46 L92 24 L70 38 Z" fill={pal.shade} />
            <ellipse cx={24} cy={80} rx={7} ry={16} fill={pal.shade} transform="rotate(14 24 80)" />
            <ellipse cx={96} cy={80} rx={7} ry={16} fill={pal.shade} transform="rotate(-14 96 80)" />
          </>
        );
      case "bunny":
        return (
          <>
            <ellipse cx={46} cy={24} rx={8.5} ry={21} fill={pal.body} transform="rotate(-12 46 24)" />
            <ellipse cx={46} cy={26} rx={4} ry={14} fill="#FFC2D4" transform="rotate(-12 46 26)" />
            <ellipse cx={74} cy={24} rx={8.5} ry={21} fill={pal.body} transform="rotate(12 74 24)" />
            <ellipse cx={74} cy={26} rx={4} ry={14} fill="#FFC2D4" transform="rotate(12 74 26)" />
          </>
        );
      case "robot":
        return (
          <>
            {level < 8 && (
              <>
                <path d="M60 38 L60 25" stroke={pal.shade} strokeWidth={3} strokeLinecap="round" />
                <circle cx={60} cy={21} r={5} fill="#FFE07A" className={animated ? "arena-twinkle" : undefined} />
              </>
            )}
            <rect x={14} y={62} width={10} height={18} rx={4} fill={pal.shade} />
            <rect x={96} y={62} width={10} height={18} rx={4} fill={pal.shade} />
          </>
        );
    }
  })();

  const face = (() => {
    if (robot) {
      return (
        <>
          <rect x={34} y={51} width={52} height={32} rx={12} fill="#1E2433" />
          <Eyes mood={mood} color="#7CF5E6" robot />
          <path d="M55 76 Q60 79 65 76" stroke="#7CF5E6" strokeWidth={2.2} strokeLinecap="round" fill="none" />
          <circle cx={50} cy={95} r={3} fill={pal.glow} />
          <circle cx={60} cy={95} r={3} fill={GOLD} />
          <circle cx={70} cy={95} r={3} fill={pal.glow} />
        </>
      );
    }
    const catLike = species === "cat" || species === "fox";
    return (
      <>
        <ellipse cx={60} cy={89} rx={20} ry={13} fill={pal.glow} opacity={0.85} />
        {species === "owl" && (
          <>
            <circle cx={47} cy={65} r={12} fill={pal.glow} />
            <circle cx={73} cy={65} r={12} fill={pal.glow} />
          </>
        )}
        {(species === "bear" || species === "fox") && (
          <ellipse cx={60} cy={76} rx={species === "bear" ? 13 : 15} ry={9} fill={pal.glow} />
        )}
        <circle cx={37} cy={76} r={5} fill="#FF7FA0" opacity={0.45} />
        <circle cx={83} cy={76} r={5} fill="#FF7FA0" opacity={0.45} />
        <Eyes mood={mood} color={INK} robot={false} />
        {species === "owl" ? (
          <path d="M56.5 71 L63.5 71 L60 77 Z" fill="#F5A524" />
        ) : (
          <>
            <ellipse cx={60} cy={72} rx={3} ry={2.2} fill={species === "bunny" ? "#FF8FB1" : INK} />
            <path
              d={catLike ? "M54 76 Q57 80 60 76 Q63 80 66 76" : "M55 76.5 Q60 81 65 76.5"}
              stroke={INK}
              strokeWidth={2}
              strokeLinecap="round"
              fill="none"
            />
          </>
        )}
        {species === "cat" && (
          <g stroke={INK} strokeOpacity={0.35} strokeWidth={1.4} strokeLinecap="round">
            <path d="M38 73 L26 70" />
            <path d="M38 77 L26 79" />
            <path d="M82 73 L94 70" />
            <path d="M82 77 L94 79" />
          </g>
        )}
      </>
    );
  })();

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role="img"
      aria-label={label}
      className={cn("shrink-0 overflow-visible", className)}
    >
      <defs>
        <linearGradient id={`body-${uid}`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor={pal.body} />
          <stop offset="100%" stopColor={pal.shade} />
        </linearGradient>
        <radialGradient id={`aura-${uid}`}>
          <stop offset="0%" stopColor={GOLD} stopOpacity={0.55} />
          <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
        </radialGradient>
      </defs>

      <ellipse cx={60} cy={111} rx={28} ry={4} fill="#000" opacity={0.12} />
      {level >= 12 && <circle cx={60} cy={68} r={58} fill={`url(#aura-${uid})`} />}

      <g className={animated ? "arena-bob" : undefined}>
        {ears}
        {robot ? (
          <rect x={24} y={38} width={72} height={68} rx={24} fill={fill} />
        ) : (
          <path d={BLOB} fill={fill} />
        )}
        <ellipse cx={46} cy={46} rx={10} ry={5} fill="#fff" opacity={0.22} transform="rotate(-25 46 46)" />
        {face}

        {mood === "tired" && (
          <path d="M92 40 Q97 48 92 52 Q87 48 92 40 Z" fill="#8FD3FF" stroke="#fff" strokeWidth={1} />
        )}
        {level >= 3 && (
          <path
            d="M84 90 l2.2 4.5 5 .7 -3.6 3.5 .9 5 -4.5 -2.4 -4.5 2.4 .9 -5 -3.6 -3.5 5 -.7 Z"
            fill={GOLD}
            stroke="#E09A00"
            strokeWidth={0.8}
          />
        )}
        {level >= 8 && (
          <path
            d={robot ? "M46 40 L44 26 L53 33 L60 22 L67 33 L76 26 L74 40 Z" : "M46 38 L44 24 L53 31 L60 20 L67 31 L76 24 L74 38 Z"}
            fill={GOLD}
            stroke="#E09A00"
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
        )}
      </g>

      {level >= 5 && (
        <g fill={GOLD}>
          <path className={animated ? "arena-twinkle" : undefined} d="M14 30 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2 Z" />
          <path
            className={animated ? "arena-twinkle arena-delay" : undefined}
            d="M106 34 l1.5 4.5 4.5 1.5 -4.5 1.5 -1.5 4.5 -1.5 -4.5 -4.5 -1.5 4.5 -1.5 Z"
          />
        </g>
      )}
    </svg>
  );
}
