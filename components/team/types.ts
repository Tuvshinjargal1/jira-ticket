import type { Gift, GiftBadgeId, MemberStats, Profile } from "@/lib/team-catalog";

export type TeamMember = {
  id: string;
  name: string;
  stats: MemberStats;
  profile: Profile;
  xp: number;
  level: { level: number; into: number; need: number };
  tier: string;
  achievements: string[];
  giftsReceived: number;
  giftCounts: Partial<Record<GiftBadgeId, number>>;
};

export type TeamPayload = {
  generatedAt: string;
  today: string;
  me: { memberId: string | null; name: string; giftsLeft: number; quota: number };
  members: TeamMember[];
  gifts: Gift[];
};

/** Chart дээрх гишүүний тогтмол өнгө — жагсаалтын дарааллаар (validated palette) */
export function seriesColor(index: number): string {
  return `var(--series-${(index % 8) + 1})`;
}
