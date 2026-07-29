import type { AdfDoc } from "@/types";

/**
 * Jira ADF (Atlassian Document Format) → plain text.
 * mention/status/emoji-ийн attrs.text-ийг зайтай авч,
 * paragraph/hardBreak-ийг шинэ мөр болгоно.
 */
export function extractPlainText(node: AdfDoc | string | null | unknown): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node !== "object") return "";

  const n = node as AdfDoc & {
    attrs?: { text?: string; shortName?: string };
  };

  if (n.type === "hardBreak") return "\n";

  let text = "";

  if (typeof n.text === "string") text += n.text;

  // status / mention / emoji — өмнөх үгтэй наалдахаас сэргийлнэ
  if (n.attrs?.text) {
    text += ` ${n.attrs.text} `;
  } else if (n.attrs?.shortName) {
    text += ` :${n.attrs.shortName}: `;
  }

  if (Array.isArray(n.content)) {
    for (const child of n.content) {
      text += extractPlainText(child);
    }
  }

  if (
    n.type === "paragraph" ||
    n.type === "heading" ||
    n.type === "listItem" ||
    n.type === "blockquote"
  ) {
    text += "\n";
  }

  return text;
}

/** Excel / UI-д зориулж илүүц зайг цэвэрлэнэ */
export function adfToPlainText(body: AdfDoc | string | null | unknown): string {
  return extractPlainText(body)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
