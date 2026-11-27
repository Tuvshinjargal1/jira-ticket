import type { Gift, GiftBadgeId, MemberStats, Profile } from "@/lib/team-catalog";

export type TeamMember = {
  id: string;
  name: string;
  stats: MemberStats;
  profile: Profile;
  achievements: string[];
  giftsReceived: number;
  giftCounts: Partial<Record<GiftBadgeId, number>>;
  moodToday: number | null;
  /** Сүүлийн 14 хоног (хуучнаас шинэ рүү) */
  moodHistory: (number | null)[];
};

export type TeamPayload = {
  generatedAt: string;
  today: string;
  me: { key: string; memberId: string | null; name: string };
  members: TeamMember[];
  gifts: Gift[];
};

/** Chart дээрх гишүүний тогтмол өнгө — жагсаалтын дарааллаар (validated palette) */
export function seriesColor(index: number): string {
  return `var(--series-${(index % 8) + 1})`;
}
