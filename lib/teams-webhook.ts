const POWER_AUTOMATE_WEBHOOK = process.env.POWER_AUTOMATE_WEBHOOK ?? "";

// ── AdaptiveCard types (v1.5) ─────────────────────────────────────────────────

interface ACTextBlock {
  type: "TextBlock";
  text: string;
  weight?: "Bolder" | "Default" | "Lighter";
  size?: "Small" | "Default" | "Medium" | "Large" | "ExtraLarge";
  color?: "Default" | "Accent" | "Good" | "Warning" | "Attention" | "Light" | "Dark";
  wrap?: boolean;
  spacing?: "None" | "Small" | "Default" | "Medium" | "Large" | "ExtraLarge" | "Padding";
  separator?: boolean;
}

interface ACFact { title: string; value: string }
interface ACFactSet { type: "FactSet"; facts: ACFact[] }
interface ACOpenUrlAction { type: "Action.OpenUrl"; title: string; url: string }

type ACElement = ACTextBlock | ACFactSet;
type ACAction = ACOpenUrlAction;

interface AdaptiveCard {
  type: "AdaptiveCard";
  $schema: "http://adaptivecards.io/schemas/adaptive-card.json";
  version: "1.5";
  body: ACElement[];
  actions?: ACAction[];
}

// ── Core sender ───────────────────────────────────────────────────────────────

// Python example-tei adil: card-ig shууд payload болгож явуулна (wrapper угуй)
// requests.post(url, json=card_payload) == fetch(url, { body: JSON.stringify(card) })
async function post(card: AdaptiveCard): Promise<void> {
  if (!POWER_AUTOMATE_WEBHOOK) {
    throw new Error("POWER_AUTOMATE_WEBHOOK тохируулаагүй байна (.env)");
  }

  const res = await fetch(POWER_AUTOMATE_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Power Automate webhook алдаа ${res.status}: ${err}`);
  }
}

// ── Text → AdaptiveCard body ──────────────────────────────────────────────────
// **text** → Bolder TextBlock
// ---      → separator
// буусад мөр → wrap TextBlock

function textToCardBody(text: string): ACElement[] {
  const elements: ACElement[] = [];

  for (const line of text.split("\n")) {
    const t = line.trim();

    if (t === "---") {
      elements.push({ type: "TextBlock", text: " ", separator: true, spacing: "Medium" });
      continue;
    }

    const isBold = t.startsWith("**") && t.endsWith("**") && t.length > 4;

    if (isBold) {
      elements.push({ type: "TextBlock", text: t.slice(2, -2), weight: "Bolder", wrap: true });
    } else {
      elements.push({ type: "TextBlock", text: t || " ", wrap: true });
    }
  }

  return elements;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function sendTeamsMessage(text: string, title?: string): Promise<void> {
  const body: ACElement[] = [];
  if (title) {
    body.push({ type: "TextBlock", text: title, weight: "Bolder", size: "Large", wrap: true });
  }
  body.push(...textToCardBody(text));

  await post({ type: "AdaptiveCard", $schema: "http://adaptivecards.io/schemas/adaptive-card.json", version: "1.5", body });
}

export async function sendTeamsCard(title: string, text: string): Promise<void> {
  const body: ACElement[] = [
    { type: "TextBlock", text: title, weight: "Bolder", size: "Large", wrap: true },
    ...textToCardBody(text),
  ];
  await post({ type: "AdaptiveCard", $schema: "http://adaptivecards.io/schemas/adaptive-card.json", version: "1.5", body });
}

export async function sendTeamsMultiSection(
  title: string,
  sections: { title: string; text: string }[]
): Promise<void> {
  const body: ACElement[] = [
    { type: "TextBlock", text: title, weight: "Bolder", size: "Large", wrap: true },
  ];

  for (const section of sections) {
    body.push({ type: "TextBlock", text: " ", separator: true, spacing: "Medium" });
    body.push({ type: "TextBlock", text: section.title, weight: "Bolder", wrap: true });
    body.push(...textToCardBody(section.text));
  }

  await post({ type: "AdaptiveCard", $schema: "http://adaptivecards.io/schemas/adaptive-card.json", version: "1.5", body });
}

// Python-ий notify_power_automate()-тай адил: FactSet + Action.OpenUrl карт
export async function sendFactCard(opts: {
  title: string;
  summary?: string;
  facts: ACFact[];
  actionTitle?: string;
  actionUrl?: string;
}): Promise<void> {
  const body: ACElement[] = [
    { type: "TextBlock", text: opts.title, weight: "Bolder", size: "Large", wrap: true },
  ];

  if (opts.summary) {
    body.push({ type: "TextBlock", text: opts.summary, wrap: true });
  }

  if (opts.facts.length > 0) {
    body.push({ type: "FactSet", facts: opts.facts });
  }

  const actions: ACAction[] = [];
  if (opts.actionTitle && opts.actionUrl) {
    actions.push({ type: "Action.OpenUrl", title: opts.actionTitle, url: opts.actionUrl });
  }

  await post({
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body,
    ...(actions.length > 0 ? { actions } : {}),
  });
}