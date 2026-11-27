"use client";

import { useId } from "react";
import { PALETTES, type Profile } from "@/lib/team-catalog";
import { cn } from "@/lib/utils";

export type Mood = "happy" | "normal" | "tired";

const INK = "#2B2140";
const GOLD = "#FFC83D";

type Props = {
  profile: Pick<Profile, "species" | "palette" | "outfit">;
  mood?: Mood;
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

// ── Хувцас ──────────────────────────────────────────────────────────────────

function HeadItem({ id, robot, animated }: { id: string; robot: boolean; animated: boolean }) {
  const dy = robot ? 3 : 0;
  switch (id) {
    case "crown":
      return (
        <path
          d="M46 38 L44 24 L53 31 L60 20 L67 31 L76 24 L74 38 Z"
          transform={`translate(0 ${dy})`}
          fill={GOLD}
          stroke="#E09A00"
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
      );
    case "party":
      return (
        <g transform={`rotate(-10 60 34) translate(0 ${dy})`}>
          <path d="M48 38 L60 8 L72 38 Z" fill="#9B7BF2" />
          <path d="M52.8 26 L67.2 26 L65.6 30 L54.4 30 Z M57.6 14 L62.4 14 L61.6 18 L58.4 18 Z" fill="#FFE07A" />
          <circle cx={60} cy={8} r={4.5} fill="#F2709C" className={animated ? "arena-twinkle" : undefined} />
        </g>
      );
    case "beanie":
      return (
        <g transform={`translate(0 ${dy})`}>
          <path d="M32 46 C32 22 88 22 88 46 Z" fill="#3D5A9E" />
          <path d="M44 30 L44 44 M52 27 L52 44 M60 26 L60 44 M68 27 L68 44 M76 30 L76 44" stroke="#fff" strokeOpacity={0.15} strokeWidth={3} />
          <rect x={30} y={41} width={60} height={9} rx={4.5} fill="#2C437A" />
          <circle cx={60} cy={21} r={6} fill="#F4F4F8" />
        </g>
      );
    case "flower":
      return (
        <g transform={`translate(80 ${40 + dy})`}>
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 5} cy={Math.sin((a * Math.PI) / 180) * 5} r={4.2} fill="#FF8FB1" />
          ))}
          <circle r={3.2} fill="#FFD54F" />
        </g>
      );
    case "headphones":
      return (
        <g>
          <path d="M24 66 C24 22 96 22 96 66" stroke="#2B2140" strokeWidth={5} fill="none" strokeLinecap="round" />
          <rect x={15} y={57} width={13} height={20} rx={6} fill="#F2709C" />
          <rect x={92} y={57} width={13} height={20} rx={6} fill="#F2709C" />
        </g>
      );
    default:
      return null;
  }
}

function FaceItem({ id }: { id: string }) {
  if (id === "sunglasses") {
    return (
      <g>
        <rect x={37} y={58} width={20} height={12} rx={5} fill="#1E2433" />
        <rect x={63} y={58} width={20} height={12} rx={5} fill="#1E2433" />
        <path d="M57 62 L63 62" stroke="#1E2433" strokeWidth={2.5} />
        <path d="M40 61 L45 61 M66 61 L71 61" stroke="#fff" strokeOpacity={0.5} strokeWidth={1.6} strokeLinecap="round" />
      </g>
    );
  }
  if (id === "round") {
    return (
      <g stroke={INK} strokeWidth={2} fill="#fff" fillOpacity={0.12}>
        <circle cx={47} cy={65} r={8.5} />
        <circle cx={73} cy={65} r={8.5} />
        <path d="M55.5 64 Q60 61 64.5 64" fill="none" />
      </g>
    );
  }
  return null;
}

function NeckItem({ id }: { id: string }) {
  if (id === "scarf") {
    return (
      <g>
        <path d="M28 92 C44 102 76 102 92 92 L94 100 C76 111 44 111 26 100 Z" fill="#F97352" />
        <path d="M74 100 L80 116 L88 114 L82 98 Z" fill="#D9502F" />
        <path d="M34 98 L36 94 M46 102 L47 97 M58 104 L58 99 M70 103 L69 98" stroke="#fff" strokeOpacity={0.35} strokeWidth={2} strokeLinecap="round" />
      </g>
    );
  }
  if (id === "bow") {
    return (
      <g>
        <path d="M60 99 L47 92 L47 106 Z" fill="#9B7BF2" />
        <path d="M60 99 L73 92 L73 106 Z" fill="#9B7BF2" />
        <circle cx={60} cy={99} r={3.5} fill="#7655D6" />
      </g>
    );
  }
  if (id === "medal") {
    return (
      <g>
        <path d="M52 86 L60 100 L68 86" stroke="#4FA3F7" strokeWidth={4} fill="none" strokeLinejoin="round" />
        <circle cx={60} cy={103} r={7} fill={GOLD} stroke="#E09A00" strokeWidth={1.2} />
        <path d="M60 99 l1.3 2.6 2.9.4 -2.1 2 .5 2.9 -2.6 -1.4 -2.6 1.4 .5 -2.9 -2.1 -2 2.9 -.4 Z" fill="#fff" />
      </g>
    );
  }
  return null;
}

const BLOB ="M60 34 C86 34 98 52 98 74 C98 96 82 106 60 106 C38 106 22 96 22 74 C22 52 34 34 60 34 Z";

export function Character({
  profile,
  mood = "normal",
  size = 96,
  animated = true,
  className,
  label,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const pal = PALETTES[profile.palette] ?? PALETTES.sky;
  const { species } = profile;
  const outfit = profile.outfit ?? {};
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
            {!outfit.head && (
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
      </defs>

      <ellipse cx={60} cy={111} rx={28} ry={4} fill="#000" opacity={0.12} />

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
        {outfit.neck && <NeckItem id={outfit.neck} />}
        {outfit.face && <FaceItem id={outfit.face} />}
        {outfit.head && <HeadItem id={outfit.head} robot={robot} animated={animated} />}
      </g>
    </svg>
  );
}
