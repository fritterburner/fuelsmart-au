import type { CSSProperties } from "react";

/**
 * Dual-colour "FuelSmart" wordmark. "Fuel" in ink (or white on dark chrome),
 * "Smart" in the theme accent — so it reskins with the palette. Uses the
 * theme's heading font.
 */
export default function Wordmark({
  tone = "auto",
  className,
  style,
}: {
  tone?: "auto" | "onDark";
  className?: string;
  style?: CSSProperties;
}) {
  const fuelColor = tone === "onDark" ? "#fff" : "var(--fs-ink, currentColor)";
  return (
    <span
      className={className}
      style={{
        fontFamily: "var(--fs-font-head, inherit)",
        fontWeight: 700,
        letterSpacing: "-.01em",
        ...style,
      }}
    >
      <span style={{ color: fuelColor }}>Fuel</span>
      <span style={{ color: "var(--fs-accent, #10b981)" }}>Smart</span>
    </span>
  );
}
