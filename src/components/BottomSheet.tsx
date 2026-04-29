"use client";

import { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Maximum height as a CSS value, e.g. "85dvh" or "auto". Defaults to "85dvh". */
  maxHeight?: string;
}

/**
 * Mobile bottom sheet: backdrop + slide-up panel.
 * Closes on backdrop click, Escape, or the close button.
 * Renders inline (not portalled) — caller should mount it inside the
 * top-level layout container so its `fixed` positioning covers the viewport.
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  children,
  maxHeight = "85dvh",
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  // Lock background scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Focus the panel when it opens (for screen readers + Escape key reliability)
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  return (
    <div
      aria-hidden={!open}
      className={`fixed inset-0 z-[2000] ${open ? "pointer-events-auto" : "pointer-events-none"}`}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`absolute left-0 right-0 bottom-0 bg-white text-slate-900 rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out outline-none safe-area-bottom safe-area-inset ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxHeight }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1.5 rounded-full bg-slate-300" />
        </div>

        {(title || onClose) && (
          <div className="flex items-center justify-between px-4 pb-2">
            {title ? (
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex items-center justify-center min-w-[40px] min-h-[40px] rounded-lg text-slate-500 active:bg-slate-100"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        <div className="overflow-y-auto px-4 pb-4" style={{ maxHeight: `calc(${maxHeight} - 4rem)` }}>
          {children}
        </div>
      </div>
    </div>
  );
}
