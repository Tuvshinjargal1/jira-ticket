/**
 * GP Arena — client болон server аль алинд нь ашиглагдах тогтмол каталог.
 * Character, хувцас, бэлэглэх badge, achievement, mood check-in.
 */

export const SPECIES = ["fox", "bear", "cat", "owl", "bunny", "robot"] as const;
export type Species = (typeof SPECIES)[number];

export const SPECIES_LABEL: Record<Species, string> = {
  fox: "Үнэг",
  bear: "Баавгай",
  cat: "Муур",
  owl: "Шар шувуу",
  bunny: "Туулай",
  robot: "Робот",
};

/** Character-ийн өнгө — бие, гүн сүүдэр, гэрэлтэлт */
export const PALETTES = {
  ember: { body: "#F97352", shade: "#D9502F", glow: "#FFD8C9", label: "Гал" },
  honey: { body: "#F5B83D", shade: "#D6931A", glow: "#FFEDC2", label: "Зөгийн бал" },
  mint: { body: "#3DCB9A", shade: "#219F75", glow: "#C9F5E4", label: "Гаа" },
  sky: { body: "#4FA3F7", shade: "#2A7DD6", glow: "#CDE6FF", label: "Тэнгэр" },
  grape: { body: "#9B7BF2", shade: "#7655D6", glow: "#E4DAFF", label: "Усан үзэм" },
  rose: { body: "#F2709C", shade: "#D24B7A", glow: "#FFD6E5", label: "Сарнай" },
  slate: { body: "#7D8BA3", shade: "#5B6880", glow: "#DCE3EE", label: "Чулуу" },
} as const;
export type PaletteId = keyof typeof PALETTES;
export const PALETTE_IDS = Object.keys(PALETTES) as PaletteId[];

export type OutfitSlot = "head" | "face" | "neck";
export type Outfit = Partial<Record<OutfitSlot, string | null>>;

export type Profile = {
  species: Species;
  palette: PaletteId;
  /** Өөрөө сонгосон цол, жишээ нь "Bug анчин" */
  title: string;
  outfit?: Outfit;
};

/** Хувцасны дэлгүүр — `unlock` нь achievement id (байхгүй бол үнэгүй) */
export const OUTFIT_ITEMS: Record<OutfitSlot, { id: string; name: string; unlock?: string }[]> = {
  head: [
    { id: "party", name: "Баярын малгай" },
    { id: "beanie", name: "Ноосон малгай" },
    { id: "flower", name: "Цэцэг" },
    { id: "headphones", name: "Чихэвч", unlock: "ten" },
    { id: "crown", name: "Титэм", unlock: "star" },
  ],
  face: [
    { id: "round", name: "Нүдний шил" },
    { id: "sunglasses", name: "Нарны шил", unlock: "streak3" },
  ],
  neck: [
    { id: "scarf", name: "Ороолт" },
    { id: "bow", name: "Эрвээхэй зангиа" },
    { id: "medal", name: "Алтан медаль", unlock: "loved" },
  ],
};

export const OUTFIT_SLOT_LABEL: Record<OutfitSlot, string> = {
  head: "Толгой",
  face: "Нүүр",
  neck: "Хүзүү",
};

const DEFAULT_ORDER: { species: Species; palette: PaletteId }[] = [
  { species: "fox", palette: "sky" },
  { species: "bear", palette: "ember" },
  { species: "cat", palette: "mint" },
  { species: "owl", palette: "grape" },
  { species: "bunny", palette: "rose" },
  { species: "robot", palette: "honey" },
];

/** Profile тохируулаагүй гишүүнд жагсаалтын байрлалаар нь ялгаатай default өгнө */
export function defaultProfile(index: number): Profile {
  const pick = DEFAULT_ORDER[index % DEFAULT_ORDER.length];
  return { ...pick, title: "", outfit: {} };
}

// ── Бэлэглэх badge (kudos) ──────────────────────────────────────────────────

export const GIFT_BADGES = {
  helper: {
    name: "Туслах гар",
    blurb: "Хэцүү үед гараа сунгасан",
    from: "#FF9A62",
    to: "#F2507A",
  },
  rocket: {
    name: "Пуужин",
    blurb: "Гайхалтай хурдан шийдсэн",
    from: "#5EB8FF",
    to: "#6A5CFF",
  },
  idea: {
    name: "Гэгээн санаа",
    blurb: "Шинэлэг санаа гаргасан",
    from: "#FFD54F",
    to: "#FF9F1C",
  },
  shield: {
    name: "Хамгаалагч",
    blurb: "Найдвартай, алдаа гаргаагүй",
    from: "#4DD7A6",
    to: "#1C9C8C",
  },
  sunshine: {
    name: "Нарны туяа",
    blurb: "Багт эерэг энерги өгсөн",
    from: "#FFE07A",
    to: "#FF7AA8",
  },
  mentor: {
    name: "Багш",
    blurb: "Мэдлэгээ хуваалцсан",
    from: "#B996FF",
    to: "#6E5BE8",
  },
  night: {
    name: "Шөнийн баатар",
    blurb: "Цагаас гадуур ч хүлээж аваагүй",
    from: "#6C7BFF",
    to: "#2C2F7A",
  },
  mvp: {
    name: "MVP",
    blurb: "Энэ долоо хоногийн шилдэг",
    from: "#FFCF5A",
    to: "#E08A00",
  },
} as const;
export type GiftBadgeId = keyof typeof GIFT_BADGES;
export const GIFT_BADGE_IDS = Object.keys(GIFT_BADGES) as GiftBadgeId[];

export const GIFT_MESSAGE_MAX = 140;
export const TITLE_MAX = 28;

export type Gift = {
  id: string;
  from: string; // member id эсвэл имэйлийн нэр
  fromName: string;
  to: string; // member id
  badge: GiftBadgeId;
  message: string;
  at: string; // ISO
  /** emoji → reaction дарсан хүмүүсийн key */
  reactions?: Record<string, string[]>;
};

export const REACTIONS = ["👏", "❤️", "🔥", "🙌", "😂"] as const;

// ── Mood check-in ───────────────────────────────────────────────────────────

export const MOODS = [
  { value: 5, emoji: "🤩", label: "Гайхалтай" },
  { value: 4, emoji: "😊", label: "Сайн" },
  { value: 3, emoji: "😐", label: "Ердийн" },
  { value: 2, emoji: "😴", label: "Ядарсан" },
  { value: 1, emoji: "😫", label: "Хэцүү" },
] as const;

export function moodMeta(value: number | null | undefined) {
  return MOODS.find((m) => m.value === value) ?? null;
}

/** Багийн дундаж mood → "цаг агаар" */
export function teamWeather(values: number[]): { icon: string; label: string; avg: number } | null {
  if (!values.length) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  if (avg >= 4.3) return { icon: "☀️", label: "Нартай", avg };
  if (avg >= 3.5) return { icon: "🌤️", label: "Цэлмэг", avg };
  if (avg >= 2.7) return { icon: "⛅", label: "Үүлшинэ", avg };
  if (avg >= 2) return { icon: "🌧️", label: "Бороотой", avg };
  return { icon: "⛈️", label: "Шуургатай", avg };
}

// ── Автомат achievement ─────────────────────────────────────────────────────

export type MemberStats = {
  open: number;
  inProgress: number;
  overdue: number;
  dueSoon: number;
  completedTotal: number;
  completed7: number;
  completedPrev7: number;
  completed30: number;
  onTimeRate: number | null; // 0..1, сүүлийн 90 хоног
  onTimeCount: number;
  onTimeSamples: number;
  medianCycleDays: number | null;
  streak: number; // ажлын өдөр дараалан task дуусгасан
  bestDay: { day: string; count: number } | null;
  /** Сүүлийн 84 хоног (хуучнаас шинэ рүү) — өдөр бүрийн дууссан тоо */
  daily: number[];
  /** Сүүлийн 8 долоо хоног (хуучнаас шинэ рүү) */
  weekly: number[];
};

export const ACHIEVEMENTS: {
  id: string;
  name: string;
  hint: string;
  test: (s: MemberStats, ctx: { topWeek: boolean; giftsReceived: number }) => boolean;
}[] = [
  { id: "first", name: "Анхны алхам", hint: "Эхний task-аа дуусга", test: (s) => s.completedTotal >= 1 },
  { id: "ten", name: "Арвантай", hint: "10 task дуусга", test: (s) => s.completedTotal >= 10 },
  { id: "fifty", name: "Тавин бат", hint: "50 task дуусга", test: (s) => s.completedTotal >= 50 },
  { id: "streak3", name: "Халуун гар", hint: "3 ажлын өдөр дараалан дуусга", test: (s) => s.streak >= 3 },
  { id: "streak5", name: "Галт цуваа", hint: "5 ажлын өдөр дараалан дуусга", test: (s) => s.streak >= 5 },
  {
    id: "punctual",
    name: "Цагийн мастер",
    hint: "90%+ хугацаандаа (5+ task)",
    test: (s) => s.onTimeSamples >= 5 && (s.onTimeRate ?? 0) >= 0.9,
  },
  {
    id: "clean",
    name: "Цэвэр самбар",
    hint: "Хугацаа хэтэрсэн task 0",
    test: (s) => s.overdue === 0 && s.open + s.completedTotal > 0,
  },
  {
    id: "swift",
    name: "Хурдан гар",
    hint: "Дундаж 2 хоногт дуусгах",
    test: (s) => s.medianCycleDays !== null && s.medianCycleDays <= 2,
  },
  { id: "star", name: "7 хоногийн од", hint: "Энэ 7 хоногт багтаа тэргүүлэх", test: (_s, c) => c.topWeek },
  { id: "loved", name: "Багийн хайртай", hint: "5 badge хүлээн ав", test: (_s, c) => c.giftsReceived >= 5 },
];

/** Ulaanbaatar цагийн бүсээр ISO долоо хоногийн эхлэл (Даваа) — YYYY-MM-DD */
export function ubDay(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function weekStart(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Даваа = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
