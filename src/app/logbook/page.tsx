"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FuelCode } from "@/lib/types";
import { FUEL_TYPES } from "@/lib/fuel-codes";
import { loadSettings } from "@/lib/settings";
import { loadVehicles } from "@/lib/vehicles";
import { sanitiseDraft } from "@/lib/number-input";
import {
  LogbookEntry,
  LogbookEntryDraft,
  computeConsumptionGaps,
  computeMonthlyTotals,
  computeSummary,
  buildExportFile,
  parseImportedLogbook,
  normalizeEntryDraft,
  sortEntriesNewestFirst,
  loadEntries,
  putEntry,
  deleteEntry,
  clearAllEntries,
  replaceAllEntries,
} from "@/lib/logbook";

// Form state uses strings for numeric inputs so fields can be legitimately
// empty (not "0") while the user is typing.
interface FormState {
  date: string;
  odometerKm: string;
  litres: string;
  totalCost: string;
  pricePerLitre: string;
  fuel: FuelCode;
  station: string;
  notes: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(defaultFuel: FuelCode): FormState {
  return {
    date: today(),
    odometerKm: "",
    litres: "",
    totalCost: "",
    pricePerLitre: "",
    fuel: defaultFuel,
    station: "",
    notes: "",
  };
}

function entryToForm(entry: LogbookEntry): FormState {
  return {
    date: entry.date,
    odometerKm: entry.odometerKm !== null ? String(entry.odometerKm) : "",
    litres: String(entry.litres),
    totalCost: String(entry.totalCost),
    pricePerLitre: String(entry.pricePerLitre),
    fuel: entry.fuel,
    station: entry.station,
    notes: entry.notes,
  };
}

function formToDraft(form: FormState, id?: string): LogbookEntryDraft {
  return {
    id,
    date: form.date,
    odometerKm: form.odometerKm.trim() === "" ? null : Number(form.odometerKm),
    litres: Number(form.litres),
    totalCost: form.totalCost.trim() === "" ? undefined : Number(form.totalCost),
    pricePerLitre: form.pricePerLitre.trim() === "" ? undefined : Number(form.pricePerLitre),
    fuel: form.fuel,
    station: form.station,
    notes: form.notes,
  };
}

function fuelName(code: string): string {
  return FUEL_TYPES.find((f) => f.code === code)?.short ?? code;
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, 1));
  return dt.toLocaleDateString("en-AU", { month: "short", year: "numeric", timeZone: "UTC" });
}

function formatDateLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export default function LogbookPage() {
  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm("U91"));
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultFuel = useMemo(() => {
    if (typeof window === "undefined") return "U91" as FuelCode;
    return loadSettings().defaultFuel;
  }, []);

  useEffect(() => {
    let active = true;
    loadEntries().then((loaded) => {
      if (active) {
        setEntries(loaded);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const sorted = useMemo(() => sortEntriesNewestFirst(entries), [entries]);
  const summary = useMemo(() => computeSummary(entries), [entries]);
  const monthly = useMemo(() => computeMonthlyTotals(entries), [entries]);
  const gaps = useMemo(() => computeConsumptionGaps(entries), [entries]);
  const gapByToId = useMemo(() => {
    const m = new Map<string, (typeof gaps)[number]>();
    for (const g of gaps) m.set(g.toId, g);
    return m;
  }, [gaps]);

  const maxMonthCost = Math.max(1, ...monthly.map((m) => m.totalCost));

  // Reuse a saved vehicle profile (see src/lib/vehicles.ts) as a rated-consumption
  // baseline to compare the logged average against, when one exists for the
  // fuel type the user is mostly logging.
  const vehicleComparison = useMemo(() => {
    if (typeof window === "undefined" || summary.avgLPer100Km === null) return null;
    const vehicles = loadVehicles();
    if (vehicles.length === 0) return null;
    const fuelCounts = new Map<string, number>();
    for (const e of entries) fuelCounts.set(e.fuel, (fuelCounts.get(e.fuel) ?? 0) + 1);
    const mostLoggedFuel = [...fuelCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const match = vehicles.find((v) => v.fuel === mostLoggedFuel) ?? vehicles[0];
    return { vehicle: match, avgLPer100Km: summary.avgLPer100Km };
  }, [entries, summary.avgLPer100Km]);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm(defaultFuel));
    setFormErrors([]);
    setSheetOpen(true);
  }

  function openEdit(entry: LogbookEntry) {
    setEditingId(entry.id);
    setForm(entryToForm(entry));
    setFormErrors([]);
    setSheetOpen(true);
  }

  async function handleSave() {
    const draft = formToDraft(form, editingId ?? undefined);
    const result = normalizeEntryDraft(draft);
    if (!result.ok) {
      setFormErrors(result.errors);
      return;
    }
    await putEntry(result.entry);
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === result.entry.id);
      if (idx >= 0) {
        const next = prev.slice();
        next[idx] = result.entry;
        return next;
      }
      return [...prev, result.entry];
    });
    setSheetOpen(false);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this logbook entry? This can't be undone.")) return;
    await deleteEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (editingId === id) setSheetOpen(false);
  }

  async function handleDeleteAll() {
    if (entries.length === 0) return;
    const ok = window.confirm(
      `Delete all ${entries.length} logbook entries from this device? This can't be undone — export a backup first if you want to keep a copy.`,
    );
    if (!ok) return;
    await clearAllEntries();
    setEntries([]);
  }

  function handleExport() {
    const file = buildExportFile(entries);
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fuelsmart-logbook-${today()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    setImportMessage(null);
    fileInputRef.current?.click();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    let parsed: unknown;
    try {
      const text = await file.text();
      parsed = JSON.parse(text);
    } catch {
      setImportMessage("That file isn't valid JSON.");
      return;
    }

    const result = parseImportedLogbook(parsed);
    if (!result.ok) {
      setImportMessage(`Import failed: ${result.error}`);
      return;
    }

    const ok = window.confirm(
      `Import ${result.entries.length} entries from this file? This replaces your current logbook (${entries.length} entries) on this device.`,
    );
    if (!ok) return;

    await replaceAllEntries(result.entries);
    setEntries(result.entries);
    setImportMessage(`Imported ${result.entries.length} entries.`);
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-slate-800 text-white px-3 py-3 flex items-center gap-3 shadow-md">
        <Link
          href="/"
          className="flex items-center justify-center w-10 h-10 min-h-[44px] min-w-[44px] rounded-full hover:bg-slate-700 active:bg-slate-600 transition-colors text-emerald-400"
          aria-label="Back to map"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>
        </Link>
        <h1 className="font-bold text-lg">Fuel logbook</h1>
      </div>

      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
        {/* Privacy line — always visible */}
        <section>
          <p className="text-sm text-gray-700 leading-relaxed">
            Your logbook never leaves this device. Every fill-up is stored in
            your browser&apos;s local database (IndexedDB) — nothing is sent to a
            server. Export a JSON backup any time to keep a copy or move it to
            another device.
          </p>
        </section>

        {/* Actions */}
        <section className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openAdd}
            className="px-4 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            + Add fill-up
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={entries.length === 0}
            className="px-4 py-2.5 min-h-[44px] bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Export backup
          </button>
          <button
            type="button"
            onClick={handleImportClick}
            className="px-4 py-2.5 min-h-[44px] bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
          >
            Import backup
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />
          {entries.length > 0 && (
            <button
              type="button"
              onClick={handleDeleteAll}
              className="px-4 py-2.5 min-h-[44px] bg-white border border-red-300 hover:bg-red-50 text-red-600 text-sm font-medium rounded-lg transition-colors ml-auto"
            >
              Delete all
            </button>
          )}
        </section>

        {importMessage && (
          <div className="text-sm bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900">
            {importMessage}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl p-8 text-center text-sm text-gray-500 border border-gray-200">
            Loading your logbook…
          </div>
        ) : entries.length === 0 ? (
          /* Empty state */
          <section className="bg-white rounded-xl p-6 border border-gray-200 text-center space-y-2">
            <div className="text-3xl" aria-hidden="true">
              📒
            </div>
            <h2 className="text-base font-semibold text-gray-900">
              Track fill-ups without sending your data anywhere
            </h2>
            <p className="text-sm text-gray-600 max-w-md mx-auto">
              Log each fill-up — date, litres, price, odometer — and see your
              real running costs: cents per litre paid, L/100km and $/100km
              between odometer readings, and monthly spend. It all stays in
              this browser; export a backup whenever you like.
            </p>
            <button
              type="button"
              onClick={openAdd}
              className="mt-2 px-4 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Log your first fill-up
            </button>
          </section>
        ) : (
          <>
            {/* Summary cards */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Total spend</div>
                <div className="font-mono text-lg font-bold text-gray-900">${summary.totalCost.toFixed(2)}</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Total litres</div>
                <div className="font-mono text-lg font-bold text-gray-900">{summary.totalLitres.toFixed(1)} L</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Avg paid</div>
                <div className="font-mono text-lg font-bold text-gray-900">{summary.avgPricePerLitre.toFixed(1)}¢/L</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">Avg consumption</div>
                <div className="font-mono text-lg font-bold text-gray-900">
                  {summary.avgLPer100Km !== null ? `${summary.avgLPer100Km.toFixed(1)} L/100km` : "—"}
                </div>
              </div>
            </section>

            {summary.avgLPer100Km === null && (
              <p className="text-xs text-gray-500 -mt-2">
                Add odometer readings to at least two fill-ups to see L/100km and $/100km.
              </p>
            )}

            {vehicleComparison && (
              <section className="bg-white rounded-xl p-4 border border-gray-200 text-sm text-gray-700">
                Your logged average of <strong>{vehicleComparison.avgLPer100Km.toFixed(1)} L/100km</strong> vs{" "}
                <strong>{vehicleComparison.vehicle.name}</strong>&apos;s rated{" "}
                <strong>{vehicleComparison.vehicle.consumption.toFixed(1)} L/100km</strong>
                {vehicleComparison.avgLPer100Km > vehicleComparison.vehicle.consumption ? (
                  <>
                    {" "}
                    — running about{" "}
                    {(
                      ((vehicleComparison.avgLPer100Km - vehicleComparison.vehicle.consumption) /
                        vehicleComparison.vehicle.consumption) *
                      100
                    ).toFixed(0)}
                    % thirstier than the rated figure.
                  </>
                ) : (
                  <> — matching or beating the rated figure.</>
                )}
              </section>
            )}

            {/* Monthly bar chart */}
            {monthly.length > 0 && (
              <section className="bg-white rounded-xl p-4 border border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Monthly spend</h2>
                <div className="flex items-end gap-2 overflow-x-auto pb-1" style={{ minHeight: 140 }}>
                  {monthly.map((m) => (
                    <div key={m.month} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ width: 44 }}>
                      <div className="text-[10px] font-mono text-gray-600">${m.totalCost.toFixed(0)}</div>
                      <div
                        className="w-full rounded-t bg-emerald-500"
                        style={{ height: Math.max(4, (m.totalCost / maxMonthCost) * 100) }}
                        title={`${formatMonthLabel(m.month)}: $${m.totalCost.toFixed(2)}, ${m.totalLitres.toFixed(1)} L`}
                      />
                      <div className="text-[10px] text-gray-500 text-center leading-tight">
                        {formatMonthLabel(m.month)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Entries list */}
            <section className="space-y-2" aria-label="Fill-up history">
              <h2 className="text-sm font-semibold text-gray-900">
                All fill-ups ({sorted.length})
              </h2>
              {sorted.map((entry) => {
                const gap = gapByToId.get(entry.id);
                return (
                  <div key={entry.id} className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{formatDateLabel(entry.date)}</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                            {fuelName(entry.fuel)}
                          </span>
                        </div>
                        {entry.station && <div className="text-sm text-gray-600">{entry.station}</div>}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(entry)}
                          className="text-xs px-2.5 py-1.5 min-h-[32px] rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(entry.id)}
                          className="text-xs px-2.5 py-1.5 min-h-[32px] rounded-lg border border-red-300 hover:bg-red-50 text-red-600 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-gray-500">Litres</div>
                        <div className="font-mono text-sm font-semibold text-gray-900">{entry.litres.toFixed(2)} L</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-gray-500">Total paid</div>
                        <div className="font-mono text-sm font-semibold text-gray-900">${entry.totalCost.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-gray-500">Price</div>
                        <div className="font-mono text-sm font-semibold text-gray-900">{entry.pricePerLitre.toFixed(1)}¢/L</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-gray-500">Odometer</div>
                        <div className="font-mono text-sm font-semibold text-gray-900">
                          {entry.odometerKm !== null ? `${entry.odometerKm.toLocaleString()} km` : "—"}
                        </div>
                      </div>
                    </div>

                    {gap && (
                      <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-600">
                        Since last odometer reading: {gap.kmDriven.toFixed(0)} km ·{" "}
                        <strong>{gap.lPer100Km.toFixed(1)} L/100km</strong> ·{" "}
                        <strong>${gap.costPer100Km.toFixed(2)}/100km</strong>
                      </div>
                    )}

                    {entry.notes && <p className="mt-2 text-xs text-gray-500 italic">{entry.notes}</p>}
                  </div>
                );
              })}
            </section>
          </>
        )}
      </div>

      {/* Add / edit sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-[2000]">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSheetOpen(false)} />
          <div className="absolute left-0 right-0 bottom-0 md:inset-0 md:m-auto md:max-w-md md:h-fit bg-white rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                {editingId ? "Edit fill-up" : "Add fill-up"}
              </h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close"
                className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3">
              {formErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  <ul className="list-disc list-inside space-y-0.5">
                    {formErrors.map((err) => (
                      <li key={err}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2.5 min-h-[44px] border rounded-lg text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Odometer (km, optional)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.odometerKm}
                    onChange={(e) =>
                      setForm({ ...form, odometerKm: sanitiseDraft(e.target.value) })
                    }
                    className="w-full px-3 py-2.5 min-h-[44px] border rounded-lg text-base"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fuel type</label>
                <select
                  value={form.fuel}
                  onChange={(e) => setForm({ ...form, fuel: e.target.value as FuelCode })}
                  className="w-full px-3 py-2.5 min-h-[44px] border rounded-lg text-base bg-white"
                >
                  {FUEL_TYPES.map((f) => (
                    <option key={f.code} value={f.code}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Litres</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.litres}
                  onChange={(e) =>
                    setForm({ ...form, litres: sanitiseDraft(e.target.value, { decimals: 2 }) })
                  }
                  className="w-full px-3 py-2.5 min-h-[44px] border rounded-lg text-base"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total paid ($)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.totalCost}
                    onChange={(e) =>
                      setForm({ ...form, totalCost: sanitiseDraft(e.target.value, { decimals: 2 }) })
                    }
                    placeholder="derived from price"
                    className="w-full px-3 py-2.5 min-h-[44px] border rounded-lg text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (c/L)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.pricePerLitre}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        pricePerLitre: sanitiseDraft(e.target.value, { decimals: 1 }),
                      })
                    }
                    placeholder="derived from total"
                    className="w-full px-3 py-2.5 min-h-[44px] border rounded-lg text-base"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 -mt-1">
                Fill in either total paid or price per litre — the other is worked out for you.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Station (optional)</label>
                <input
                  type="text"
                  value={form.station}
                  onChange={(e) => setForm({ ...form, station: e.target.value })}
                  placeholder="e.g. Shell Coles Express, Darwin"
                  className="w-full px-3 py-2.5 min-h-[44px] border rounded-lg text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2.5 border rounded-lg text-base"
                />
              </div>

              <div className="flex gap-2 pt-2">
                {editingId && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingId)}
                    className="px-4 py-2.5 min-h-[44px] border border-red-300 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-1 px-4 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                  {editingId ? "Save changes" : "Add fill-up"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
