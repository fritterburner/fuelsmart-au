"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  clampNumber,
  commitDraft,
  defaultStep,
  formatValue,
  parseDraft,
  sanitiseDraft,
  type NumberRules,
} from "@/lib/number-input";

interface Props {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Decimal places permitted. 0 (the default) means integers only. */
  decimals?: number;
  /** Arrow-key increment. Defaults to the smallest unit `decimals` allows. */
  step?: number;
  /** Highlight the current value on focus so typing replaces it. */
  selectOnFocus?: boolean;
  id?: string;
  name?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

/**
 * A numeric input you can actually edit.
 *
 * Two things make it behave, both of which the old raw `<input type="number">`
 * call sites got wrong:
 *
 * 1. The field keeps its own draft string while focused. Empty is allowed, and
 *    so are half-typed values like "10." — nothing is clamped mid-keystroke, so
 *    you can wipe the box and enter your own figure.
 * 2. The range is applied on blur. Typing "1" on the way to "150" no longer
 *    trips a minimum of 5.
 *
 * It renders `type="text"` with `inputMode="decimal"` rather than
 * `type="number"`. That keeps the numeric keypad on mobile while avoiding two
 * long-standing annoyances of number inputs: the scroll wheel silently changing
 * a value the pointer happens to rest over, and browsers reporting an empty
 * string for input they consider malformed, which hides what the user typed.
 * Arrow-key stepping is reimplemented below so nothing is lost by the swap.
 */
export default function NumberField({
  value,
  onChange,
  min,
  max,
  decimals = 0,
  step,
  selectOnFocus = true,
  id,
  name,
  className,
  placeholder,
  disabled,
  autoFocus,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: Props) {
  const rules = useMemo<NumberRules>(
    () => ({ min, max, decimals }),
    [min, max, decimals],
  );

  const formatted = formatValue(value, rules);
  const [draft, setDraft] = useState(formatted);
  const [shownFor, setShownFor] = useState(formatted);
  const [focused, setFocused] = useState(false);

  // Suppress the mouseup that would otherwise collapse the select-on-focus
  // highlight back to a caret.
  const pendingSelect = useRef(false);

  // Pick up a value the parent changed underneath us (settings hydrating from
  // localStorage, a saved vehicle being selected). Adjusted during render
  // rather than in an effect — the effect version re-renders twice and trips
  // react-hooks/set-state-in-effect.
  //
  // Gated on focus: while the field has focus its draft is the source of truth,
  // so a parent re-render can't overwrite a half-typed number.
  if (!focused && formatted !== shownFor) {
    setShownFor(formatted);
    setDraft(formatted);
  }

  const publish = useCallback(
    (next: number) => {
      if (next !== value) onChange(next);
    },
    [onChange, value],
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = sanitiseDraft(e.target.value, rules);
    setDraft(next);

    // Publish the clamped value on every keystroke that parses, so the parent
    // always holds exactly what a blur would commit. That matters for the trip
    // form, where pressing Enter submits in the same tick as the blur — the
    // parent must never be one edit behind what the box shows.
    //
    // Clamping here is invisible: the draft, not `value`, is what's rendered
    // while the field has focus, so typing "1" on the way to "150" still reads
    // as "1" even though the parent briefly sees the minimum.
    const n = parseDraft(next);
    if (n !== null) publish(clampNumber(n, rules));
  }

  function handleBlur() {
    setFocused(false);
    pendingSelect.current = false;
    const committed = commitDraft(draft, rules, value);
    setDraft(formatValue(committed, rules));
    publish(committed);
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    setFocused(true);
    if (selectOnFocus) {
      pendingSelect.current = true;
      e.currentTarget.select();
    }
  }

  function handleMouseUp(e: React.MouseEvent<HTMLInputElement>) {
    if (!pendingSelect.current) return;
    pendingSelect.current = false;
    e.preventDefault();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      // Standalone control (no surrounding form): Enter means "I'm done with
      // this box", so commit and drop focus — on mobile that also dismisses the
      // keypad. Inside a form, leave Enter alone so implicit submit still works.
      if (!e.currentTarget.form) e.currentTarget.blur();
      return;
    }
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;

    e.preventDefault();
    const delta = (step ?? defaultStep(rules)) * (e.key === "ArrowUp" ? 1 : -1);
    const base = parseDraft(draft) ?? value;
    const next = clampNumber(base + delta, rules);
    setDraft(formatValue(next, rules));
    publish(next);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      id={id}
      name={name}
      value={draft}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseUp={handleMouseUp}
      onKeyDown={handleKeyDown}
      className={className}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
    />
  );
}
