/**
 * Escape a string for safe interpolation into HTML.
 * Use this on any DB-sourced value embedded into HTML strings written
 * via `document.write`, template literals, etc.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}