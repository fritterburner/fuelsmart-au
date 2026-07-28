/**
 * Shared behaviour for editable numeric fields.
 *
 * The rule this module exists to enforce: while the user is typing, the field
 * holds a *string*, and "", "-", "12." and ".5" are all legal intermediate
 * states rather than errors. A number is only pinned to its range when the user
 * leaves the field.
 *
 * Clamping on every keystroke is what made the old inputs impossible to edit.
 * `Number("")` is 0, so clearing the box produced 0, and the clamp then snapped
 * it straight back to the minimum — you could never empty a field to type your
 * own figure.
 */

export interface NumberRules {
  min?: number;
  max?: number;
  /** Decimal places permitted. 0 (the default) means integers only. */
  decimals?: number;
}

function allowsNegative(rules: NumberRules): boolean {
  return (rules.min ?? 0) < 0;
}

function roundTo(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

/**
 * Reduce a raw field value to something that can still become a number,
 * discarding characters that never can (letters, stray signs, extra dots).
 *
 * Deliberately permissive about half-typed input: it preserves "", "-", "." and
 * "12." so the caret doesn't jump and the user can keep going.
 */
export function sanitiseDraft(raw: string, rules: NumberRules = {}): string {
  const decimals = rules.decimals ?? 0;

  // Spaces and thousands separators are noise — people paste "12 500" and
  // "12,500" and mean the same number.
  let body = raw.replace(/[\s,]/g, "");

  const sign = allowsNegative(rules) && body.startsWith("-") ? "-" : "";
  body = body.replace(/-/g, "");

  let seenDot = false;
  let out = "";
  for (const ch of body) {
    if (ch >= "0" && ch <= "9") {
      out += ch;
    } else if (ch === "." && decimals > 0 && !seenDot) {
      seenDot = true;
      out += ".";
    }
  }

  if (seenDot) {
    const dot = out.indexOf(".");
    out = out.slice(0, dot + 1) + out.slice(dot + 1, dot + 1 + decimals);
  }

  return sign + out;
}

/** The number a draft currently represents, or null while it's still partial. */
export function parseDraft(draft: string): number | null {
  if (!/\d/.test(draft)) return null; // "", "-", ".", "-."
  const n = Number(draft);
  return Number.isFinite(n) ? n : null;
}

export function clampNumber(n: number, rules: NumberRules = {}): number {
  let v = n;
  if (typeof rules.min === "number" && v < rules.min) v = rules.min;
  if (typeof rules.max === "number" && v > rules.max) v = rules.max;
  return roundTo(v, rules.decimals ?? 0);
}

/**
 * What the field settles on once the user leaves it.
 *
 * An empty or unparseable draft reverts to `fallback` — the value the field had
 * before editing — rather than leaping to the minimum. Blanking a box and
 * clicking away should give you back what was there, not the smallest legal
 * number.
 */
export function commitDraft(
  draft: string,
  rules: NumberRules,
  fallback: number,
): number {
  const n = parseDraft(draft);
  return clampNumber(n === null ? fallback : n, rules);
}

/** Render a committed number back into draft text. */
export function formatValue(value: number, rules: NumberRules = {}): string {
  if (!Number.isFinite(value)) return "";
  // No padding to a fixed width: trailing zeros ("10.50", "50.0") are just
  // characters to delete before you can type.
  return String(roundTo(value, rules.decimals ?? 0));
}

/** One arrow-key nudge: the smallest unit the field's precision allows. */
export function defaultStep(rules: NumberRules = {}): number {
  return 1 / 10 ** (rules.decimals ?? 0);
}
