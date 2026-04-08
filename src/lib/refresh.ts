import { Station } from "./types";
import { fetchNTStations } from "./fetchers/nt";
import { fetchQLDStations } from "./fetchers/qld";
import { fetchWAStations } from "./fetchers/wa";
import { fetchNSWStations } from "./fetchers/nsw";
import { cacheStations, setStateLastUpdate } from "./cache";

export async function refreshAllData(): Promise<{
  nt: number;
  qld: number;
  wa: number;
  nsw: number;
  total: number;
  errors: string[];
}> {
  const errors: string[] = [];
  const allStations: Station[] = [];

  // Fetch all sources in parallel
  const [ntResult, qldResult, waResult, nswResult] = await Promise.allSettled([
    fetchNTStations(),
    fetchQLDStations(),
    fetchWAStations(),
    fetchNSWStations(),
  ]);

  let ntCount = 0, qldCount = 0, waCount = 0, nswCount = 0;

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
    allStations.push(...nswResult.value);
    nswCount = nswResult.value.length;
    if (nswCount > 0) await setStateLastUpdate("NSW");
  } else {
    errors.push(`NSW: ${nswResult.reason}`);
  }

  // Cache whatever we got (partial success is better than nothing)
  if (allStations.length > 0) {
    await cacheStations(allStations);
  }

  return {
    nt: ntCount,
    qld: qldCount,
    wa: waCount,
    nsw: nswCount,
    total: allStations.length,
    errors,
  };
}
