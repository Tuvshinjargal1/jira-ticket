import type { JiraTicket } from "@/types";

/** JSM "Request Type" талбарын id (com.atlassian.servicedesk:vp-origin) */
export const REQUEST_TYPE_FIELD = "customfield_10010";

/** Ticket-ийн request type-ийн нэрийг гаргаж авна (байхгүй бол null) */
export function getRequestTypeName(ticket: JiraTicket): string | null {
  return ticket.fields.customfield_10010?.requestType?.name ?? null;
}
