/**
 * Build-time feature flags. Read from NEXT_PUBLIC_* so client and server agree.
 */

/**
 * Excise checker — the "is this station passing on the excise cut" map mode and
 * the explainer pages. Default OFF: the Apr–Jun 2026 26.3¢/L excise halving ends
 * 30 Jun 2026, after which the content is stale. All excise code is kept dormant
 * behind this flag (not deleted); set NEXT_PUBLIC_ENABLE_EXCISE="true" to revive.
 */
export const EXCISE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_EXCISE === "true";
