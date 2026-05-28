const MS_TENANT_ID = process.env.MS_TENANT_ID!;
const MS_CLIENT_ID = process.env.MS_CLIENT_ID!;
const MS_CLIENT_SECRET = process.env.MS_CLIENT_SECRET!;

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

/** Client credentials (app-only) token — requires admin-consented application permissions */
export async function getMsToken(): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: MS_CLIENT_ID,
    client_secret: MS_CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Microsoft нэвтрэлт амжилтгүй: ${res.status} — ${err}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

export async function graphGet(token: string, path: string): Promise<unknown> {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph GET ${path} алдаа ${res.status}: ${err}`);
  }

  return res.json();
}

export async function graphPost(
  token: string,
  path: string,
  body: unknown
): Promise<unknown> {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph POST ${path} алдаа ${res.status}: ${err}`);
  }

  return res.json();
}

export async function graphPatch(
  token: string,
  path: string,
  body: unknown,
  etag: string
): Promise<void> {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "If-Match": etag,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph PATCH ${path} алдаа ${res.status}: ${err}`);
  }
}

/** Jira priority нэрийг Planner priority тоо руу хөрвүүлнэ */
export function toPlannerPriority(jiraPriority: string): number {
  // 0=Urgent, 1=Important, 5=Medium, 9=Low
  const map: Record<string, number> = {
    Highest: 0,
    Urgent: 0,
    High: 1,
    Important: 1,
    Medium: 5,
    Low: 9,
    Lowest: 9,
  };
  return map[jiraPriority] ?? 5;
}
