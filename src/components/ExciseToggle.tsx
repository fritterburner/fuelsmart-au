"use client";

interface Props {
  mode: boolean;
  onToggle: (next: boolean) => void;
  variant: "desktop" | "mobile-menu";
}

/**
 * Toggle control for excise mode. Desktop variant is a pill button in the header;
 * mobile variant is a full-width menu row with an explicit on/off state.
 */
export default function ExciseToggle({ mode, onToggle, variant }: Props) {
  if (variant === "desktop") {
    return (
      <button
        onClick={() => onToggle(!mode)}
        className={
          "hidden md:inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 md:hover:brightness-110 transition-all text-sm font-medium whitespace-nowrap " +
          (mode
            ? "bg-emerald-600 text-white ring-2 ring-emerald-300"
            : "bg-slate-700 text-gray-200 md:hover:bg-slate-600")
        }
        title={
          mode
            ? "Excise mode is ON — pins coloured by pass-through verdict"
            : "Enable excise mode to see federal-excise pass-through verdicts"
        }
        aria-pressed={mode}
      >
        <span aria-hidden="true">⛽</span>
        <span>Excise: {mode ? "on" : "off"}</span>
      </button>
    );
  }

  // mobile-menu
  return (
    <button
      onClick={() => onToggle(!mode)}
      className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-slate-600 active:bg-slate-600 transition-colors"
      aria-pressed={mode}
    >
      <span className="flex items-center gap-2">
        <span aria-hidden="true">⛽</span> Excise mode
      </span>
      <span
        className={
          "inline-flex items-center justify-center min-w-[36px] px-2 py-0.5 rounded text-xs font-semibold " +
          (mode ? "bg-emerald-500 text-white" : "bg-slate-500 text-gray-100")
        }
      >
        {mode ? "on" : "off"}
      </span>
    </button>
  );
}
