import { Station } from "./types";
import { fetchNTStations } from "./fetchers/nt";
import { fetchQLDStations } from "./fetchers/qld";
import { fetchWAStations } from "./fetchers/wa";
import { fetchNSWStations } from "./fetchers/nsw";
import { fetchTASStations } from "./fetchers/tas";
import { fetchVICStations } from "./fetchers/vic";
import { fetchSAStations } from "./fetchers/sa";
import { cacheStations, setStateLastUpdate, cacheMarketData } from "./cache";
import { recordDailySnapshot } from "./history";
import { fetchLiveMarketData } from "./excise/fetch-market-data";

export async function refreshAllData(): Promise<{
  nt: number;
  qld: number;
  wa: number;
  nsw: number;
  act: number;
  tas: number;
  vic: number;
  sa: number;
  total: number;
  errors: string[];
  marketData: { source: string; as_of: string } | { error: string };
}> {
  const errors: string[] = [];
  const allStations: Station[] = [];

  // VIC (Servo Saver) and SA (Informed Sources) only run once their access
  // credentials are configured. Until then they resolve to an empty list so the
  // cron stays clean and the other states are unaffected.
  const vicEnabled = !!process.env.VIC_SERVO_SAVER_API_KEY;
  const saEnabled = !!process.env.SA_FPIS_API_TOKEN;

  // Fetch all sources in parallel
  const [ntResult, qldResult, waResult, nswResult, tasResult, vicResult, saResult] =
    await Promise.allSettled([
      fetchNTStations(),
      fetchQLDStations(),
      fetchWAStations(),
      fetchNSWStations(),
      fetchTASStations(),
      vicEnabled ? fetchVICStations() : Promise.resolve([] as Station[]),
      saEnabled ? fetchSAStations() : Promise.resolve([] as Station[]),
    ]);

  let ntCount = 0, qldCount = 0, waCount = 0, nswCount = 0, actCount = 0, tasCount = 0, vicCount = 0, saCount = 0;

  if (ntResult.status === "fulfilled") {
    allStations.push(...ntResult.value);
    ntCount = ntResult.value.length;
    await setStateLastUpdate("NT");
  } else {
    errors.push(`NT: ${ntResult.reason}`);
  }

  if (qldResult.status === "fulfilled") {
    allStations.push(...qldResult.value);
    qldCount = qldResult.value.length;
    await setStateLastUpdate("QLD");
  } else {
    errors.push(`QLD: ${qldResult.reason}`);
  }

  if (waResult.status === "fulfilled") {
    allStations.push(...waResult.value);
    waCount = waResult.value.length;
    await setStateLastUpdate("WA");
  } else {
    errors.push(`WA: ${waResult.reason}`);
  }

  if (nswResult.status === "fulfilled") {
    // The NSW FuelCheck feed carries both NSW and ACT stations; the fetcher
    // tags each with its own state. Count and stamp them independently so the
    // data-freshness page can report ACT honestly.
    allStations.push(...nswResult.value);
    nswCount = nswResult.value.filter((s) => s.state === "NSW").length;
    actCount = nswResult.value.filter((s) => s.state === "ACT").length;
    if (nswCount > 0) await setStateLastUpdate("NSW");
    if (actCount > 0) await setStateLastUpdate("ACT");
  } else {
    errors.push(`NSW: ${nswResult.reason}`);
  }

  if (tasResult.status === "fulfilled") {
    allStations.push(...tasResult.value);
    tasCount = tasResult.value.length;
    if (tasCount > 0) await setStateLastUpdate("TAS");
  } else {
    errors.push(`TAS: ${tasResult.reason}`);
  }

  if (vicResult.status === "fulfilled") {
    allStations.push(...vicResult.value);
    vicCount = vicResult.value.length;
    if (vicCount > 0) await setStateLastUpdate("VIC");
  } else {
    errors.push(`VIC: ${vicResult.reason}`);
  }

  if (saResult.status === "fulfilled") {
    allStations.push(...saResult.value);
    saCount = saResult.value.length;
    if (saCount > 0) await setStateLastUpdate("SA");
  } else {
    errors.push(`SA: ${saResult.reason}`);
  }

  // Cache whatever we got (partial success is better than nothing)
  if (allStations.length > 0) {
    await cacheStations(allStations);
  }

  // Daily price snapshot for 30-day history charts + forecasting (non-fatal).
  if (allStations.length > 0) {
    try {
      await recordDailySnapshot(allStations);
    } catch (err) {
      errors.push("History: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  // Refresh market data (Brent crude + AUD/USD) for excise pass-through calcs.
  // Failure here must not kill the station refresh.
  let marketData: { source: string; as_of: string } | { error: string };
  try {
    const fetched = await fetchLiveMarketData();
    await cacheMarketData(fetched);
    marketData = { source: fetched.source, as_of: fetched.as_of };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`MarketData: ${msg}`);
    marketData = { error: msg };
  }

  return {
    nt: ntCount,
    qld: qldCount,
    wa: waCount,
    nsw: nswCount,
    act: actCount,
    tas: tasCount,
    vic: vicCount,
    sa: saCount,
    total: allStations.length,
    errors,
    marketData,
  };
}
