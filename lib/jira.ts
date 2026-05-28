import type { AdfDoc, JiraTicket, PersonGroup, TicketWithParticipants } from "@/types";

const JIRA_BASE_URL = process.env.JIRA_BASE_URL!;
const JIRA_EMAIL = process.env.JIRA_EMAIL!;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN!;

/** Request participant-аар шүүх имэйлүүд */
export const PARTICIPANTS: { email: string; displayName: string }[] = [
  { email: "tuvshinjargal@zerotech.mn", displayName: "Tuvshinjargal" },
  { email: "nandintsetseg@zerotech.mn", displayName: "Nandintsetseg" },
  { email: "khuslen@zerotech.mn", displayName: "Khuslen" },
];

export function getJiraAuthHeader(): string {
  const creds = `${JIRA_EMAIL}:${JIRA_API_TOKEN}`;
  return `Basic ${Buffer.from(creds).toString("base64")}`;
}

async function fetchTicketsForEmail(email: string): Promise<JiraTicket[]> {
  const jql = `project in ("DC") AND "Request Participants" = "${email}" AND status != Resolved ORDER BY created DESC`;

  const url = new URL(`${JIRA_BASE_URL}/rest/api/3/search/jql`);
  url.searchParams.set("jql", jql);
  url.searchParams.set(
    "fields",
    "summary,description,assignee,priority,duedate,status,labels,comment,created"
  );
  url.searchParams.set("maxResults", "50");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: getJiraAuthHeader(),
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Jira API алдаа (${email}): ${response.status} — ${body}`);
  }

  const data = await response.json();
  return (data.issues ?? []) as JiraTicket[];
}

/**
 * 3 имэйл тус бүрт query хийж, давхардлыг нэгтгэнэ.
 * allTickets: global deduplicated (participants[] талбартай)
 * byPerson: хүн тус бүрийн жагсаалт
 */
export async function fetchAllParticipantTickets(): Promise<{
  byPerson: PersonGroup[];
  allTickets: TicketWithParticipants[];
}> {
  // Зэрэгцээ fetch
  const perPerson = await Promise.all(
    PARTICIPANTS.map(async (p) => ({
      email: p.email,
      displayName: p.displayName,
      tickets: await fetchTicketsForEmail(p.email),
    }))
  );

  // Давхардал арилгах — key-ээр
  const ticketMap = new Map<string, TicketWithParticipants>();
  for (const person of perPerson) {
    for (const ticket of person.tickets) {
      if (ticketMap.has(ticket.key)) {
        ticketMap.get(ticket.key)!.participants.push(person.displayName);
      } else {
        ticketMap.set(ticket.key, { ...ticket, participants: [person.displayName] });
      }
    }
  }

  return {
    byPerson: perPerson,
    allTickets: Array.from(ticketMap.values()),
  };
}

export function extractPlainText(node: AdfDoc | string | null): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  let text = "";
  if (node.text) text += node.text;
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      text += extractPlainText(child as AdfDoc);
    }
  }
  if (node.type === "paragraph") text += "\n";
  return text;
}
