/**
 * Parse a "DD/MM/YYYY HH:MM:SS" wall-time string in the given IANA timezone
 * and return an ISO 8601 UTC string. Handles DST correctly.
 */
export function parseLocalDateToISO(dateStr: string, timeZone: string): string {
  const [datePart, timePart] = dateStr.split(" ");
  if (!datePart || !timePart) return new Date().toISOString();
  const [day, month, year] = datePart.split("/");
  // Trick: treat the wall-time as if it were UTC, then compute the actual
  // offset by formatting that moment in the target timezone and comparing.
  // "sv" (Swedish) locale gives ISO-8601-shaped output: "YYYY-MM-DD HH:MM:SS".
  const asUtc = new Date(`${year}-${month}-${day}T${timePart}Z`);
  const asLocalStr =
    asUtc.toLocaleString("sv", { timeZone }).replace(" ", "T") + "Z";
  const offsetMs = asUtc.getTime() - new Date(asLocalStr).getTime();
  return new Date(asUtc.getTime() + offsetMs).toISOString();
}
