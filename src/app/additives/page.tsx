"use client";

import { useState, useMemo } from "react";

const TANK_SIZE = 55; // litres
const ADDITIVE_COST = 20; // $ per bottle
const ADDITIVE_FREQ = 4; // every 4th tank

interface VehicleCalc {
  label: string;
  consumption: number;
  annualFuelCost: number;
  annualSaving: number;
  annualAdditiveCost: number;
  net: number;
}

function calcVehicle(
  label: string,
  consumption: number,
  pricePerLitre: number,
  improvementPct: number,
  annualKm: number
): VehicleCalc {
  const litresYear = (annualKm / 100) * consumption;
  const annualFuelCost = litresYear * (pricePerLitre / 100);
  const annualSaving = annualFuelCost * (improvementPct / 100);
  const tanksYear = litresYear / TANK_SIZE;
  const additiveDoses = tanksYear / ADDITIVE_FREQ;
  const annualAdditiveCost = additiveDoses * ADDITIVE_COST;
  const net = annualSaving - annualAdditiveCost;
  return {
    label,
    consumption,
    annualFuelCost,
    annualSaving,
    annualAdditiveCost,
    net,
  };
}

function fmt(n: number) {
  return "$" + n.toFixed(0);
}

function fmtSigned(n: number) {
  return (n >= 0 ? "+$" : "−$") + Math.abs(n).toFixed(0);
}

export default function AdditivesPage() {
  const [price, setPrice] = useState(220);
  const [improvement, setImprovement] = useState(2);
  const [annualKm, setAnnualKm] = useState(15000);

  const vehicleA = useMemo(
    () => calcVehicle("Vehicle A — 7.25 L/100km", 7.25, price, improvement, annualKm),
    [price, improvement, annualKm]
  );
  const vehicleB = useMemo(
    () => calcVehicle("Vehicle B — 10.5 L/100km", 10.5, price, improvement, annualKm),
    [price, improvement, annualKm]
  );

  // One-line breakeven: % improvement needed to cover $20 bottle on next fill cycle (4 fills × 55L)
  const beAtCurrent = (ADDITIVE_COST / (TANK_SIZE * ADDITIVE_FREQ * (price / 100))) * 100;

  // Maths verdict based on Vehicle B net
  const mathVerdict = useMemo(() => {
    const netB = vehicleB.net;
    if (netB > 10) {
      return {
        tone: "green" as const,
        text: (
          <>
            <strong>At these settings, Vehicle B marginally benefits.</strong> But remember — this
            assumes the additive actually delivers {improvement}% improvement, which is at the very
            top end of what independent testing supports for a healthy engine.
          </>
        ),
      };
    }
    if (netB > -10) {
      return {
        tone: "neutral" as const,
        text: (
          <>
            <strong>Roughly break-even.</strong> The saving is so marginal it&apos;s within
            measurement noise. You&apos;d never notice the difference at the bowser. Your money is
            better spent on a tyre pressure gauge and an air filter.
          </>
        ),
      };
    }
    return {
      tone: "red" as const,
      text: (
        <>
          <strong>Net loss.</strong> The additive costs more than it could possibly save. Even the
          thirstier vehicle loses money. For Vehicle A it&apos;s worse again.
        </>
      ),
    };
  }, [vehicleB.net, improvement]);

  // Breakeven analysis: at what fuel price does a $20 bottle (every 4th fill, 55L tank) break even?
  // Per 4-fill cycle: 220L consumed. Saving = 220 × (pct/100) litres. Dollar saving = 220 × (pct/100) × price/100.
  // Set equal to $20 → BE (c/L) = 2000 / (220 × pct/100) = 909.09 / pct
  function breakeven(pct: number) {
    return 909.09 / pct;
  }
  function fmtBE(be: number) {
    return be > 500 ? "Over $5/L" : (be / 100).toFixed(2) + " $/L";
  }

  const breakevenRows = [
    { pct: 1, note: "Very unlikely to pay off", tone: "red" as const },
    { pct: 2, note: "Still marginal", tone: "red" as const },
    { pct: 3, note: "Best-case realistic", tone: "amber" as const },
    { pct: 5, note: "Only if engine is very dirty", tone: "amber" as const },
    { pct: 10, note: "Marketing claim territory", tone: "green" as const },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Sticky header with back navigation */}
      <div className="sticky top-0 z-30 bg-slate-800 text-white px-3 py-3 flex items-center gap-3 shadow-md">
        <a
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
        </a>
        <h1 className="font-bold text-lg">Fuel additives — are they worth it?</h1>
      </div>

      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        {/* Intro */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Octane boosters &amp; fuel system cleaners
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Walk the bottom shelf of Repco or Supercheap and you&apos;ll see a wall of bottles
            promising more power, more economy, cleaner injectors. Here&apos;s what independent
            testing actually shows — and the maths on whether they save you money.
          </p>
        </section>

        {/* Current fuel price context */}
        <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <span aria-hidden="true">⛽</span> Current fuel price context
          </h2>
          <p className="text-sm text-gray-700 mb-3">
            Petrol prices have surged due to the Strait of Hormuz crisis. The federal government
            halved fuel excise from 52.6¢ to 26.3¢/L effective 1 April 2026 for three months.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-3 font-semibold">Fuel Type</th>
                  <th className="text-left py-2 pr-3 font-semibold">Pre-cut (late Mar)</th>
                  <th className="text-left py-2 pr-3 font-semibold">Post-cut estimate (Apr)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-3">ULP 91</td>
                  <td className="py-2 pr-3 text-gray-600">~230–258 c/L</td>
                  <td className="py-2 pr-3 text-gray-600">~205–230 c/L</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-3">PULP 95</td>
                  <td className="py-2 pr-3 text-gray-600">~250–275 c/L</td>
                  <td className="py-2 pr-3 text-gray-600">~225–250 c/L</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-3">PULP 98</td>
                  <td className="py-2 pr-3 text-gray-600">~260–283 c/L</td>
                  <td className="py-2 pr-3 text-gray-600">~235–260 c/L</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3">Darwin premium</td>
                  <td className="py-2 pr-3 text-gray-600">~258–263 c/L</td>
                  <td className="py-2 pr-3 text-gray-600">~232–237 c/L</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 italic mt-2">
            Darwin typically runs highest of all capitals. Regional QLD 10–30c/L above metro.
          </p>
        </section>

        {/* What's on the shelf */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <span aria-hidden="true">🧪</span> What&apos;s on the shelf
          </h2>
          <p className="text-sm text-gray-700 mb-4">
            Three broad categories at Repco, Supercheap and Autobarn.
          </p>

          <h3 className="text-base font-semibold text-amber-700 mb-2">Category 1: Octane boosters</h3>
          <p className="text-sm text-gray-700 mb-3">
            These raise the fuel&apos;s octane rating (resistance to detonation/knock). They do{" "}
            <strong>not</strong> improve fuel economy unless your engine is actively knock-limited.
          </p>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-3 font-semibold">Product</th>
                  <th className="text-left py-2 pr-3 font-semibold">Price</th>
                  <th className="text-left py-2 pr-3 font-semibold">Treats</th>
                  <th className="text-left py-2 pr-3 font-semibold">Claimed boost</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-3">Nulon Octane Boost &amp; Clean 300mL</td>
                  <td className="py-2 pr-3">~$19–$24</td>
                  <td className="py-2 pr-3">60L</td>
                  <td className="py-2 pr-3">Up to 2.5 RON</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-3">Nulon Pro-Strength Octane Booster 500mL</td>
                  <td className="py-2 pr-3">~$30–$38</td>
                  <td className="py-2 pr-3">60L</td>
                  <td className="py-2 pr-3">Up to 7 RON</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-3">Penrite Octane Booster 375mL</td>
                  <td className="py-2 pr-3">~$25</td>
                  <td className="py-2 pr-3">60L</td>
                  <td className="py-2 pr-3">Up to 4 RON</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3">Liqui Moly Octane Booster 200mL</td>
                  <td className="py-2 pr-3">~$26</td>
                  <td className="py-2 pr-3">60L</td>
                  <td className="py-2 pr-3">Not specified</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-base font-semibold text-amber-700 mb-2">
            Category 2: Fuel system / injector cleaners
          </h3>
          <p className="text-sm text-gray-700 mb-3">
            These clean deposits off injectors, intake valves, and combustion chambers. They can{" "}
            <strong>restore lost economy</strong> on older or high-km engines — they don&apos;t
            add economy beyond factory spec.
          </p>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-3 font-semibold">Product</th>
                  <th className="text-left py-2 pr-3 font-semibold">Price</th>
                  <th className="text-left py-2 pr-3 font-semibold">Treats</th>
                  <th className="text-left py-2 pr-3 font-semibold">Claimed benefit</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-3">Nulon Petrol Injector Cleaner 300mL</td>
                  <td className="py-2 pr-3">~$15</td>
                  <td className="py-2 pr-3">2 × 60L tanks</td>
                  <td className="py-2 pr-3">Restore economy, clean injectors</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-3">Penrite Petrol Injector Cleaner 375mL</td>
                  <td className="py-2 pr-3">~$18–$25</td>
                  <td className="py-2 pr-3">60L</td>
                  <td className="py-2 pr-3">Up to 2.4% economy improvement</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-3">Nulon Pro-Strength Extreme Clean 500mL</td>
                  <td className="py-2 pr-3">~$37</td>
                  <td className="py-2 pr-3">60L</td>
                  <td className="py-2 pr-3">Deep clean, restore power</td>
                </tr>
                <tr>
                  <td className="py-2 pr-3">Liqui Moly Fuel System Cleaner 500mL</td>
                  <td className="py-2 pr-3">~$41</td>
                  <td className="py-2 pr-3">60L</td>
                  <td className="py-2 pr-3">Clean &amp; condition</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-base font-semibold text-amber-700 mb-2">
            Category 3: &ldquo;Fuel economy&rdquo; / nano products
          </h3>
          <p className="text-sm text-gray-700 mb-3">
            Products like XSNANO, DXP, etc. claiming 10–28% economy gains via nanotechnology.
            These are predominantly sold direct-to-consumer with testimonial-based marketing and{" "}
            <strong>no independent lab verification</strong> of economy claims.
          </p>
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
            <p className="text-sm text-gray-800">
              <strong>Reality check:</strong> If any additive could genuinely deliver 20%+ fuel
              savings, every fleet operator in Australia would already be using it and it would be
              front-page news. The laws of thermodynamics haven&apos;t changed. Treat these claims
              with extreme scepticism.
            </p>
          </div>
        </section>

        {/* The science */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <span aria-hidden="true">🔬</span> What does the evidence actually say?
          </h2>

          <h3 className="text-base font-semibold text-amber-700 mb-2">Octane boosters</h3>
          <p className="text-sm text-gray-700 mb-3">
            Independent lab testing (Intertek, dyno testing by BOOSTane and others) consistently
            shows that off-the-shelf octane boosters <strong>do raise octane</strong> — but often
            far less than claimed. Many products advertise in &ldquo;points&rdquo; where 1 point =
            0.1 RON, not 1.0 RON. So a &ldquo;10-point increase&rdquo; often means just 1.0 RON.
          </p>
          <p className="text-sm text-gray-700 mb-4">
            The critical question is:{" "}
            <strong>does your engine benefit from higher octane?</strong> If it&apos;s not
            knock-limited (i.e., the ECU isn&apos;t pulling timing due to detonation), higher
            octane does absolutely nothing for performance or economy. Modern naturally-aspirated
            engines running on their recommended fuel grade will see zero benefit.
          </p>

          <h3 className="text-base font-semibold text-amber-700 mb-2">Injector cleaners</h3>
          <p className="text-sm text-gray-700 mb-4">
            Polyetheramine (PEA) based cleaners are the real deal — they genuinely dissolve carbon
            deposits. Penrite claims up to 2.4% economy improvement on dirty injectors, which is a
            realistic, honest figure. But this only helps if your injectors are actually dirty. A
            well-maintained engine on good fuel won&apos;t see much change.
          </p>

          <h3 className="text-base font-semibold text-amber-700 mb-2">
            Bottom line on &ldquo;economy&rdquo; additives
          </h3>
          <p className="text-sm text-gray-700">
            The best-case realistic economy improvement from any additive on a healthy engine is{" "}
            <strong>0–3%</strong>. Most independent reviews land around 1–2% at best. The 10–28%
            claims from nano/MLM-style products have never been verified by an independent lab.
          </p>
        </section>

        {/* Interactive maths */}
        <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <span aria-hidden="true">📊</span> The maths — Vehicle A vs Vehicle B
          </h2>
          <p className="text-sm text-gray-700 mb-4">
            Move the sliders to see realistic savings vs additive cost.
          </p>

          <div className="space-y-4 mb-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fuel price: <span className="font-mono text-amber-600">{price}</span> c/L
              </label>
              <input
                type="range"
                min={150}
                max={300}
                step={5}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assumed economy improvement:{" "}
                <span className="font-mono text-amber-600">{improvement}</span>%
              </label>
              <input
                type="range"
                min={0}
                max={10}
                step={0.5}
                value={improvement}
                onChange={(e) => setImprovement(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Annual km driven:{" "}
                <span className="font-mono text-amber-600">{annualKm.toLocaleString()}</span> km
              </label>
              <input
                type="range"
                min={5000}
                max={40000}
                step={1000}
                value={annualKm}
                onChange={(e) => setAnnualKm(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>
          </div>

          {[vehicleA, vehicleB].map((v) => (
            <div key={v.label} className="mb-4">
              <h3 className="text-base font-semibold text-gray-900 mb-2">{v.label}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">
                    Annual fuel cost
                  </div>
                  <div className="font-mono text-lg font-semibold text-gray-900">
                    {fmt(v.annualFuelCost)}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">
                    Annual saving
                  </div>
                  <div className="font-mono text-lg font-semibold text-emerald-600">
                    {fmt(v.annualSaving)}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">
                    Additive cost
                  </div>
                  <div className="font-mono text-lg font-semibold text-amber-600">
                    {fmt(v.annualAdditiveCost)}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">
                    Net gain / loss
                  </div>
                  <div
                    className={`font-mono text-lg font-semibold ${
                      v.net >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {fmtSigned(v.net)}
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div
            className={`p-4 rounded-r-lg border-l-4 ${
              mathVerdict.tone === "green"
                ? "bg-emerald-50 border-emerald-500"
                : mathVerdict.tone === "red"
                ? "bg-red-50 border-red-500"
                : "bg-amber-50 border-amber-500"
            }`}
          >
            <p className="text-sm text-gray-800">{mathVerdict.text}</p>
          </div>

          <p className="text-xs text-gray-500 italic mt-3">
            Additive cost assumes Nulon Octane Boost &amp; Clean (~$20/bottle, treats 60L, used
            every 4th tank as recommended). Tank size assumed 55L.
          </p>
        </section>

        {/* Breakeven analysis */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <span aria-hidden="true">📐</span> Breakeven analysis
          </h2>
          <p className="text-sm text-gray-700 mb-3">
            At what fuel price does a $20/bottle additive (used every 4th fill, 55L tank) break
            even?
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-3 font-semibold">Economy gain</th>
                  <th className="text-left py-2 pr-3 font-semibold">Breakeven price</th>
                  <th className="text-left py-2 pr-3 font-semibold">Realistic?</th>
                </tr>
              </thead>
              <tbody>
                {breakevenRows.map((row) => (
                  <tr key={row.pct} className="border-b border-gray-100">
                    <td className="py-2 pr-3">{row.pct}%</td>
                    <td className="py-2 pr-3 font-mono">{fmtBE(breakeven(row.pct))}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide ${
                          row.tone === "red"
                            ? "bg-red-100 text-red-700"
                            : row.tone === "amber"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {row.note}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 italic mt-2">
            Breakeven = fuel price at which the dollar value of fuel saved per treated fill cycle
            (220L over 4 fills) equals the $20 additive cost. Independent of vehicle consumption.
          </p>
        </section>

        {/* What actually works */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <span aria-hidden="true">✅</span> What actually saves fuel (for free)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-3 font-semibold">Action</th>
                  <th className="text-left py-2 pr-3 font-semibold">Typical saving</th>
                  <th className="text-left py-2 pr-3 font-semibold">Cost</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100 bg-amber-50/50">
                  <td className="py-2 pr-3">Correct tyre pressure (check monthly)</td>
                  <td className="py-2 pr-3">2–4%</td>
                  <td className="py-2 pr-3">Free</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-3">Remove unnecessary weight from boot</td>
                  <td className="py-2 pr-3">1–2%</td>
                  <td className="py-2 pr-3">Free</td>
                </tr>
                <tr className="border-b border-gray-100 bg-amber-50/50">
                  <td className="py-2 pr-3">Drive 10 km/h slower on highway</td>
                  <td className="py-2 pr-3">5–15%</td>
                  <td className="py-2 pr-3">Free</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-3">Avoid aggressive acceleration</td>
                  <td className="py-2 pr-3">5–10%</td>
                  <td className="py-2 pr-3">Free</td>
                </tr>
                <tr className="border-b border-gray-100 bg-amber-50/50">
                  <td className="py-2 pr-3">Use cruise control on open road</td>
                  <td className="py-2 pr-3">3–7%</td>
                  <td className="py-2 pr-3">Free</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-3">Air con off (windows down &lt; 80 km/h)</td>
                  <td className="py-2 pr-3">3–5%</td>
                  <td className="py-2 pr-3">Free</td>
                </tr>
                <tr className="border-b border-gray-100 bg-amber-50/50">
                  <td className="py-2 pr-3">Fill up mid-week (cycle low)</td>
                  <td className="py-2 pr-3">10–30c/L saved</td>
                  <td className="py-2 pr-3">Free</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 pr-3">Use E10 where suitable</td>
                  <td className="py-2 pr-3">~4c/L cheaper</td>
                  <td className="py-2 pr-3">Slight economy trade-off</td>
                </tr>
                <tr className="bg-amber-50/50">
                  <td className="py-2 pr-3">Regular servicing (air filter, spark plugs)</td>
                  <td className="py-2 pr-3">2–5%</td>
                  <td className="py-2 pr-3">Normal maintenance</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-lg">
            <p className="text-sm text-gray-800">
              <strong>Perspective:</strong> Driving 10 km/h slower on the highway saves more fuel
              than any additive ever will — and it&apos;s free. Correct tyre pressure alone
              matches or beats the best-case additive claim.
            </p>
          </div>
        </section>

        {/* Bottom line */}
        <section className="bg-gradient-to-br from-amber-50 to-emerald-50 border border-amber-300 rounded-xl p-5">
          <h2 className="text-lg font-bold text-amber-700 mb-3 flex items-center gap-2">
            <span aria-hidden="true">🏁</span> The bottom line
          </h2>
          <p className="text-sm text-gray-800 mb-3">
            <strong>Octane boosters</strong> are for performance engines that need higher octane
            than what&apos;s available at the pump. They won&apos;t improve economy on a standard
            commuter car. At $20–$38 per 60L tank, they&apos;re significantly more expensive than
            just buying 95 or 98 RON fuel in the first place.
          </p>
          <p className="text-sm text-gray-800 mb-3">
            <strong>Injector cleaners</strong> (Nulon PEA-based, Penrite) are worth using{" "}
            <em>occasionally</em> — say once every 10,000–15,000 km as preventative maintenance.
            They can restore lost economy on older/high-km engines. At ~$15 per dose, the cost is
            modest. But don&apos;t expect miracles — 1–3% on a dirty engine is realistic.
          </p>
          <p className="text-sm text-gray-800 mb-3">
            <strong>&ldquo;Economy miracle&rdquo; products</strong> (XSNANO, DXP, etc.) — save
            your money. No independent lab has ever verified their headline claims. Testimonials
            aren&apos;t evidence.
          </p>
          <p className="text-sm text-gray-800 mb-2">
            <strong>For Vehicle A (7.25 L/100km):</strong> Additive cost will almost certainly
            exceed any fuel saving. The engine is already efficient. Spend the $20 on a tyre
            pressure gauge instead.
          </p>
          <p className="text-sm text-gray-800">
            <strong>For Vehicle B (10.5 L/100km):</strong> Slightly better value proposition but
            still marginal. An occasional injector clean is reasonable maintenance — not a
            money-saving strategy. Driving habits and tyre pressure will deliver 5× the savings of
            any additive.
          </p>
        </section>

        {/* One-liner */}
        <section>
          <p className="text-base font-semibold text-center text-gray-900 py-2 leading-relaxed">
            At current prices (~${(price / 100).toFixed(2)}/L), a $20 octane booster needs to
            deliver <span className="font-mono text-amber-600">{beAtCurrent.toFixed(1)}%</span>{" "}
            economy improvement just to break even on Vehicle B — and independent testing shows
            most deliver 0–1% on a healthy engine. <strong>It doesn&apos;t stack up.</strong>
          </p>
        </section>

        <footer className="text-center text-xs text-gray-500 pt-4 border-t border-gray-200">
          Prices sourced from NRMA, AIP, Supercheap Auto, Repco · Independent test data from
          Intertek / Grassroots Motorsports / BOOSTane
        </footer>
      </div>
    </div>
  );
}
