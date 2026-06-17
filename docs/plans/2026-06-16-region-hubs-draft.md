# Region hubs — draft for review

**Date:** 2026-06-16
**Purpose:** the curated anchor set for the named-region scheme (see the regional-granularity plan). Each state = **Greater \<Capital\>** (metro, kept whole) + named regional hubs chosen from **ABS Significant Urban Areas / population**. A station joins its **nearest anchor within that anchor's catchment**; anything beyond every catchment falls to **"Rest of \<state\>"**. Thin regions (< ~5 reporting stations/day) auto-roll-up into "Rest of \<state\>", so an over-generous list is safe — prune freely.

**Review this for the region SET (names/coverage).** Coordinates are city-centre approximations — I'll snap them to ABS SUA centroids at build. Catchment km are proposals — isolated hubs get large catchments (nothing else nearby), metro-adjacent ones get small ones (avoid grabbing the metro's fringe).

Legend: `kind` = metro | regional. `catch` = catchment radius (km).

## NSW — `id` prefix `nsw-`
| id | label | kind | lat | lng | catch |
|---|---|---|---|---|---|
| nsw-sydney | Greater Sydney | metro | -33.87 | 151.21 | 70 |
| nsw-central-coast | Central Coast | regional | -33.43 | 151.34 | 30 |
| nsw-newcastle | Newcastle & Hunter | regional | -32.93 | 151.78 | 55 |
| nsw-wollongong | Wollongong & Illawarra | regional | -34.42 | 150.89 | 40 |
| nsw-south-coast | South Coast (Nowra) | regional | -34.88 | 150.60 | 70 |
| nsw-northern-rivers | Northern Rivers (Tweed–Lismore) | regional | -28.81 | 153.28 | 70 |
| nsw-mid-north-coast | Mid North Coast (Coffs–Port Macquarie) | regional | -30.90 | 153.00 | 80 |
| nsw-new-england | New England (Tamworth–Armidale) | regional | -31.09 | 150.93 | 110 |
| nsw-central-west | Central West (Orange–Bathurst–Dubbo) | regional | -32.80 | 148.90 | 130 |
| nsw-riverina | Riverina (Wagga Wagga) | regional | -35.11 | 147.37 | 110 |
| nsw-border | Border (Albury) | regional | -36.08 | 146.92 | 70 |
| nsw-rest | Rest of NSW | regional | — | — | fallback |

## VIC — `vic-`
| id | label | kind | lat | lng | catch |
|---|---|---|---|---|---|
| vic-melbourne | Greater Melbourne | metro | -37.81 | 144.96 | 70 |
| vic-geelong | Geelong | regional | -38.15 | 144.36 | 40 |
| vic-ballarat | Ballarat | regional | -37.56 | 143.85 | 60 |
| vic-bendigo | Bendigo | regional | -36.76 | 144.28 | 70 |
| vic-gippsland | Gippsland (Latrobe Valley) | regional | -38.20 | 146.54 | 90 |
| vic-shepparton | Goulburn (Shepparton) | regional | -36.38 | 145.40 | 70 |
| vic-mildura | Mildura | regional | -34.21 | 142.15 | 130 |
| vic-warrnambool | South West (Warrnambool) | regional | -38.38 | 142.48 | 90 |
| vic-wodonga | Wodonga | regional | -36.12 | 146.89 | 40 |
| vic-rest | Rest of VIC | regional | — | — | fallback |

## QLD — `qld-`
| id | label | kind | lat | lng | catch |
|---|---|---|---|---|---|
| qld-brisbane | Greater Brisbane | metro | -27.47 | 153.03 | 60 |
| qld-gold-coast | Gold Coast | regional | -28.00 | 153.43 | 35 |
| qld-sunshine-coast | Sunshine Coast | regional | -26.65 | 153.07 | 45 |
| qld-toowoomba | Toowoomba & Darling Downs | regional | -27.56 | 151.95 | 90 |
| qld-wide-bay | Wide Bay (Bundaberg–Hervey Bay) | regional | -25.10 | 152.50 | 80 |
| qld-gladstone | Gladstone | regional | -23.84 | 151.26 | 60 |
| qld-rockhampton | Rockhampton (Capricornia) | regional | -23.38 | 150.51 | 90 |
| qld-mackay | Mackay | regional | -21.14 | 149.19 | 100 |
| qld-townsville | Townsville | regional | -19.26 | 146.82 | 100 |
| qld-cairns | Cairns (Far North) | regional | -16.92 | 145.77 | 120 |
| qld-mount-isa | Mount Isa (North West) | regional | -20.73 | 139.49 | 250 |
| qld-rest | Rest of QLD | regional | — | — | fallback |

## SA — `sa-`
| id | label | kind | lat | lng | catch |
|---|---|---|---|---|---|
| sa-adelaide | Greater Adelaide | metro | -34.93 | 138.60 | 60 |
| sa-murray-bridge | Murraylands (Murray Bridge) | regional | -35.12 | 139.27 | 60 |
| sa-mount-gambier | Limestone Coast (Mount Gambier) | regional | -37.83 | 140.78 | 110 |
| sa-spencer-gulf | Spencer Gulf (Whyalla–Pt Augusta) | regional | -32.80 | 137.65 | 100 |
| sa-eyre | Eyre Peninsula (Port Lincoln) | regional | -34.73 | 135.86 | 150 |
| sa-rest | Rest of SA | regional | — | — | fallback |

## WA — `wa-`
| id | label | kind | lat | lng | catch |
|---|---|---|---|---|---|
| wa-perth | Greater Perth | metro | -31.95 | 115.86 | 65 |
| wa-mandurah | Mandurah (Peel) | regional | -32.53 | 115.72 | 30 |
| wa-bunbury | Bunbury (South West) | regional | -33.33 | 115.64 | 70 |
| wa-albany | Great Southern (Albany) | regional | -35.02 | 117.88 | 130 |
| wa-geraldton | Mid West (Geraldton) | regional | -28.77 | 114.61 | 150 |
| wa-kalgoorlie | Goldfields (Kalgoorlie–Boulder) | regional | -30.75 | 121.47 | 180 |
| wa-pilbara | Pilbara (Karratha–Port Hedland) | regional | -20.74 | 116.85 | 250 |
| wa-kimberley | Kimberley (Broome) | regional | -17.96 | 122.24 | 300 |
| wa-rest | Rest of WA | regional | — | — | fallback |

## TAS — `tas-`
| id | label | kind | lat | lng | catch |
|---|---|---|---|---|---|
| tas-hobart | Greater Hobart | metro | -42.88 | 147.33 | 50 |
| tas-launceston | Launceston | regional | -41.43 | 147.14 | 60 |
| tas-devonport | Devonport | regional | -41.18 | 146.35 | 35 |
| tas-burnie | Burnie | regional | -41.05 | 145.91 | 50 |
| tas-rest | Rest of TAS | regional | — | — | fallback |

## NT — `nt-`
| id | label | kind | lat | lng | catch |
|---|---|---|---|---|---|
| nt-darwin | Greater Darwin | metro | -12.46 | 130.84 | 70 |
| nt-katherine | Katherine | regional | -14.46 | 132.26 | 150 |
| nt-alice-springs | Alice Springs | regional | -23.70 | 133.88 | 300 |
| nt-rest | Rest of NT | regional | — | — | fallback |

## ACT — `act-`
| id | label | kind | lat | lng | catch |
|---|---|---|---|---|---|
| act | Canberra (ACT) | metro | -35.28 | 149.13 | 50 |

---

**Totals:** ~50 named hubs + 7 "Rest of \<state\>" + ACT. Live now: NSW/ACT/QLD/WA/NT/TAS; VIC/SA populate when their feeds go live.

**To confirm:**
1. Any regions to add/drop/rename? (e.g., split NSW Central West into Orange vs Dubbo; add a QLD Whitsundays; merge anything you think is over-split.)
2. Happy with the metro staying whole (no intra-metro split)?
3. Then I snap coords to ABS SUA centroids, wire `lib/regions.ts` from this table, and build the rest.
