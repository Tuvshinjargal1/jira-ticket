export interface JiraTicket {
  id: string;
  key: string;
  fields: {
    summary: string;
    description: AdfDoc | string | null;
    assignee: {
      displayName: string;
      emailAddress: string;
    } | null;
    reporter: {
      displayName: string;
      emailAddress: string;
    } | null;
    status: {
      name: string;
    };
    priority: {
      name: string;
    };
    duedate: string | null;
    created: string;
    labels: string[];
  };
}

export interface AdfDoc {
  type: string;
  content?: AdfDoc[];
  text?: string;
  [key: string]: unknown;
}

export interface SyncResult {
  key: string;
  summary: string;
  status: "created" | "skipped" | "error";
  taskId?: string;
  taskUrl?: string;
  assigneeName?: string;
  error?: string;
}

export interface SyncSummary {
  results: SyncResult[];
  created: number;
  skipped: number;
  errors: number;
}

/** Ticket with participant names attached (for deduplication display) */
export type TicketWithParticipants = JiraTicket & { participants: string[] };

export interface PersonGroup {
  email: string;
  displayName: string;
  tickets: JiraTicket[];
}

export interface TicketsResponse {
  byPerson: PersonGroup[];
  allTickets: TicketWithParticipants[];
}
