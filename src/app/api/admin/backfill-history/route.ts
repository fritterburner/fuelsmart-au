import { NextRequest, NextResponse } from "next/server";
import { StateCode } from "@/lib/types";
import {
  parseCsvLine,
  detectColumns,
  createAggregate,
  foldRow,
  finaliseDay,
  type ColumnMap,
} from "@/lib/backfill";
import { mergeStateDay } from "@/lib/history";

// One-off historical backfill. Point it at an open-data "price history" CSV
// (Data.NSW / data.qld) and it streams the file, aggregates per-state daily
// avg/min, and writes the same history:state:<date> keys the live cron uses.
//
// Usage (bearer-gated):
//   GET /api/admin/backfill-history?state=NSW&url=<csv-url>&dryRun=1
//   GET /api/admin/backfill-history?state=QLD&url=<csv-url>          (writes)
//
// This route is meant to be deleted after the backfill runs — the data persists
// in Redis independently of any deploy.

export const maxDuration = 60;

const VALID_STATES = new Set<StateCode>(["NT", "QLD", "WA", "NSW", "ACT", "SA", "VIC", "TAS"]);

export async function GET(request: NextRequest) {
  const secret = process.env.BACKFILL_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const state = (sp.get("state") || "").toUpperCase() as StateCode;
  const url = sp.get("url");
  const dryRun = sp.get("dryRun") === "1";

  if (!VALID_STATES.has(state)) {
    return NextResponse.json({ error: "unknown or missing state" }, { status: 400 });
  }
  if (!url || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: "valid http(s) url required" }, { status: 400 });
  }

  let resp: Response;
  try {
    resp = await fetch(url);
  } catch (e) {
    return NextResponse.json({ error: `fetch failed: ${(e as Error).message}` }, { status: 502 });
  }
  if (!resp.ok || !resp.body) {
    return NextResponse.json({ error: `source returned ${resp.status}` }, { status: 502 });
  }

  // Stream the CSV line-by-line so memory stays flat regardless of file size.
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let header: string[] | null = null;
  let cols: ColumnMap | null = null;
  let colError: string | null = null;
  let rowsParsed = 0;
  let rowsKept = 0;
  const agg = createAggregate();

  function handleLine(line: string) {
    if (!line) return;
    if (!header) {
      header = parseCsvLine(line);
      const detected = detectColumns(header);
      if ("error" in detected) colError = detected.error;
      else cols = detected;
      return;
    }
    if (!cols) return; // header detection failed; skip body
    rowsParsed++;
    if (foldRow(agg, parseCsvLine(line), cols)) rowsKept++;
  }

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        handleLine(buf.slice(0, nl).replace(/\r$/, ""));
        buf = buf.slice(nl + 1);
      }
    }
    if (buf.trim()) handleLine(buf.replace(/\r$/, ""));
  } catch (e) {
    return NextResponse.json({ error: `stream error: ${(e as Error).message}` }, { status: 502 });
  }

  if (colError) {
    return NextResponse.json({ error: colError }, { status: 422 });
  }

  // Build the per-date payloads.
  const days = [...agg.keys()].sort();
  const sample = days.slice(0, 3).map((d) => ({ date: d, fuels: finaliseDay(agg.get(d)!) }));

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      state,
      columnsDetected: cols,
      rowsParsed,
      rowsKept,
      daysFound: days.length,
      dateRange: days.length ? { from: days[0], to: days[days.length - 1] } : null,
      sample,
    });
  }

  let daysWritten = 0;
  for (const d of days) {
    await mergeStateDay(d, state, finaliseDay(agg.get(d)!));
    daysWritten++;
  }

  return NextResponse.json({
    dryRun: false,
    state,
    rowsParsed,
    rowsKept,
    daysWritten,
    dateRange: days.length ? { from: days[0], to: days[days.length - 1] } : null,
  });
}
