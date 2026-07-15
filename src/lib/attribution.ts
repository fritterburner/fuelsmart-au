/**
 * Required source-attribution strings per data licence. Render these wherever a
 * feed's terms require crediting the source.
 */

/**
 * Mandated verbatim by the SA Fuel Pricing Information Scheme Data Publisher
 * T&Cs (cl. 3.1). Must appear on any copy of SA data, however reformatted.
 * NOTE: confirm the year range with CBS — the v1 (Feb 2021) licence text reads
 * "2021-2023".
 */
export const SA_ATTRIBUTION =
  "Based on or contains data provided by the State of South Australia " +
  "(Office of Consumer and Business Services) 2021-2023. " +
  "Copyright of the State of South Australia.";

/** Where SA consumers can report a price that isn't current (licence cl. 3.3). */
export const SA_COMPLAINT_CONTACT = "FuelPricingScheme@sa.gov.au";

/**
 * Mandatory verbatim notice for the VIC Fair Fuel Open Data API ("Servo
 * Saver"), Service Victoria — CC BY 4.0 licence. Must appear on any copy of
 * VIC data, however reformatted (same obligation shape as SA_ATTRIBUTION).
 *
 * NOTE: the public tier is 24-hour delayed. Don't pair this string with any
 * "live" framing — per-price `updatedAt` timestamps already convey the delay
 * honestly, so no separate delay caveat is baked into this constant.
 */
export const VIC_ATTRIBUTION =
  "© State of Victoria accessed via the Victorian Government Service Victoria Platform";
