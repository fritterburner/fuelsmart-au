# MyFuel NT API Documentation

> Reverse-engineered from https://myfuelnt.nt.gov.au/ on 2026-04-07
> NT Government — Consumer Affairs, real-time fuel price data

## Overview

MyFuel NT is an ASP.NET MVC application. It does **not** expose a formal REST API. Instead, it uses:
1. **AJAX endpoints** for autocomplete and regional trends (return JSON directly)
2. **Server-rendered HTML pages** with a massive `serverJson` hidden input containing the full station dataset as JSON

All endpoints are **publicly accessible** — no authentication, API keys, or session tokens required. Requests use standard cookies (`BIGipServer*` load-balancer stickiness) but these are not required for data access.

---

## Endpoints

### 1. `POST /Home/SearchSuburb` — Suburb/Postcode Autocomplete

Search for NT suburbs by name or postcode prefix.

| Field | Value |
|-------|-------|
| **URL** | `https://myfuelnt.nt.gov.au/Home/SearchSuburb` |
| **Method** | POST |
| **Content-Type** | `application/x-www-form-urlencoded` |
| **Auth** | None |

#### Request Body

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prefix` | string | Yes | Search term (suburb name or postcode prefix). Empty string returns all ~305 suburbs. |

#### Response (JSON Array)

```json
[
  {
    "SubPostCodeId": 1,
    "Suburb": "DARWIN CITY",
    "Postcode": "0800",
    "Longitude": 0,
    "Latitude": 0,
    "SubsAndPostCodes": "DARWIN CITY (0800)"
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `SubPostCodeId` | int | Unique suburb ID (used as `SuburbId` in Results endpoint) |
| `Suburb` | string | Suburb name (uppercase) |
| `Postcode` | string | 4-digit NT postcode |
| `Longitude` | float | Always 0 in this endpoint (coordinates are in the Results data) |
| `Latitude` | float | Always 0 in this endpoint |
| `SubsAndPostCodes` | string | Display label: `"SUBURB (POSTCODE)"` |

#### Example curl

```bash
# Search for suburbs matching "Darwin"
curl -s 'https://myfuelnt.nt.gov.au/Home/SearchSuburb' \
  -X POST \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'prefix=Darwin'

# Get ALL suburbs (empty prefix)
curl -s 'https://myfuelnt.nt.gov.au/Home/SearchSuburb' \
  -X POST \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'prefix='
```

---

### 2. `GET /Home/GetRegionCurrentTrend` — Regional Average Prices

Returns 24-hour average fuel prices by region for a given fuel type.

| Field | Value |
|-------|-------|
| **URL** | `https://myfuelnt.nt.gov.au/Home/GetRegionCurrentTrend` |
| **Method** | GET |
| **Auth** | None |

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fuelCode` | string | Yes | Fuel type code (see Reference Tables below) |
| `_` | int | Yes | Cache-buster timestamp (milliseconds since epoch) |

#### Response (JSON Object)

```json
{
  "FuelCode": null,
  "FuelName": "Diesel",
  "RegionPrices": [
    {
      "RegionName": "Barkly",
      "AveragePrice": 319.29
    },
    {
      "RegionName": "Central Australia",
      "AveragePrice": 333.27
    },
    {
      "RegionName": "Darwin",
      "AveragePrice": 309.13
    },
    {
      "RegionName": "East Arnhem",
      "AveragePrice": 321.16
    },
    {
      "RegionName": "Katherine",
      "AveragePrice": 308.20
    },
    {
      "RegionName": "Litchfield",
      "AveragePrice": 312.31
    },
    {
      "RegionName": "Palmerston",
      "AveragePrice": 308.85
    },
    {
      "RegionName": "Tiwi Island",
      "AveragePrice": 328.00
    },
    {
      "RegionName": "Top End Rural",
      "AveragePrice": 326.75
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `FuelCode` | string\|null | Always null in observed responses |
| `FuelName` | string | Human-readable fuel name |
| `RegionPrices` | array | Average prices per region (only regions with data) |
| `RegionPrices[].RegionName` | string | Region name |
| `RegionPrices[].AveragePrice` | float | 24-hour average price in cents per litre |

#### Fuel Code Coverage (regions with data)

| Code | Name | Regions |
|------|------|---------|
| DL | Diesel | 9 |
| U91 | Unleaded 91 | 8 |
| P95 | Premium 95 | 8 |
| P98 | Premium 98 | 7 |
| LAF | Low Aromatic Fuel | 7 |
| PD | Premium Diesel | 6 |
| LPG | LPG | 2 |
| E85 | Ethanol 105 (E85) | 2 |
| E10 | Ethanol 94 (E10) | 0 |
| B20 | Biodiesel 20 | 0 |

#### Example curl

```bash
curl -s "https://myfuelnt.nt.gov.au/Home/GetRegionCurrentTrend?fuelCode=U91&_=$(date +%s)000"
```

---

### 3. `GET /Home/Results` — Full Station Data (HTML with embedded JSON)

**This is the primary data endpoint.** Returns an HTML page containing a hidden input `#serverJson` with the complete dataset of ALL 212 fuel outlets across the NT, including coordinates, current prices for all fuel types, and brand info.

| Field | Value |
|-------|-------|
| **URL** | `https://myfuelnt.nt.gov.au/Home/Results` |
| **Method** | GET |
| **Auth** | None |
| **Response** | HTML (extract JSON from `<input id="serverJson" value="...">`) |

#### Query Parameters

The endpoint supports three search modes. **All modes return the same complete dataset of all 212 outlets** — the parameters only affect which stations are displayed in the HTML table, but the `serverJson` always contains everything.

##### Mode 1: Suburb/Postcode Search

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `searchOptions` | string | Yes | `"suburbPostcode"` |
| `Suburb` | string | Yes | Suburb display label, e.g. `"DARWIN CITY (0800)"` |
| `SuburbId` | int | Yes | From SearchSuburb response `SubPostCodeId` |
| `RegionId` | string | No | Leave empty |
| `FuelCode` | string | No | Fuel type code. Empty = all types |
| `BrandIdentifier` | string | No | Brand code. Empty = all brands |

##### Mode 2: Region Search

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `searchOptions` | string | Yes | `"region"` |
| `Suburb` | string | No | Leave empty |
| `SuburbId` | int | Yes | `0` |
| `RegionId` | int | Yes | Region ID (see Reference Tables) |
| `FuelCode` | string | No | Fuel type code |
| `BrandIdentifier` | string | No | Brand code |

##### Mode 3: Geolocation (Fuel Near Me)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `Location` | string | Yes | `"latitude,longitude"` e.g. `"-12.4634,130.8456"` |

#### Extracting the JSON

The HTML contains:
```html
<input type="hidden" id="serverJson" value="{&quot;Suburb&quot;:...}">
```

HTML-decode the `value` attribute to get the JSON object.

#### Response JSON Structure

```json
{
  "Suburb": "DARWIN CITY (0800)",
  "SuburbLatitude": -12.4617910629012,
  "SuburbLongitude": 130.843732383344,
  "RegionId": null,
  "BrandIdentifier": null,
  "FuelCode": "DL",
  "Location": null,
  "FuelTypeList": [ ... ],
  "FuelBrandList": [ ... ],
  "FuelOutlet": [ ... ],
  "polygonCoordinates": "[[[-12.457,130.833], ...]]"
}
```

##### `FuelOutlet[]` — Station Object (212 total)

```json
{
  "FuelOutletId": 42,
  "FuelOutletIdentifier": "08300042",
  "OutletName": "SHELL REDDY EXPRESS PALMERSTON",
  "OutletBrandIdentifier": "C3",
  "FuelBrandIdentifier": "C3",
  "Address": "2 YARRAWONGA RD (CNR ROYSTONEA AVE)",
  "Suburb": "PALMERSTON",
  "Postcode": "0830",
  "OutletState": "NT",
  "RegionId": 9,
  "Longitude": 130.9841,
  "Latitude": -12.473721,
  "IsNTFleet": false,
  "IsActive": true,
  "FuelCode": null,
  "FuelPriceForSelectedCode": 0.0,
  "IsAvailable": false,
  "SuburbLongitude": 0.0,
  "SuburbLatitude": 0.0,
  "WebAddress": "https://www.colesexpress.com.au/",
  "AvailableFuels": [
    {
      "FuelCode": "DL",
      "Price": 310.9,
      "isAvailable": true,
      "OutletId": 42
    },
    {
      "FuelCode": "LAF",
      "Price": 227.5,
      "isAvailable": true,
      "OutletId": 42
    },
    {
      "FuelCode": "P95",
      "Price": 245.0,
      "isAvailable": true,
      "OutletId": 42
    },
    {
      "FuelCode": "U91",
      "Price": 227.5,
      "isAvailable": true,
      "OutletId": 42
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `FuelOutletId` | int | Unique station ID |
| `FuelOutletIdentifier` | string | Station identifier code (postcode + sequence) |
| `OutletName` | string | Station name |
| `OutletBrandIdentifier` | string | Brand code for the outlet |
| `FuelBrandIdentifier` | string | Brand code for fuel supply |
| `Address` | string | Street address |
| `Suburb` | string | Suburb name |
| `Postcode` | string | Postcode |
| `OutletState` | string | Always `"NT"` |
| `RegionId` | int | Region ID (see Reference Tables) |
| `Longitude` | float | Station longitude (WGS84) |
| `Latitude` | float | Station latitude (WGS84, negative for southern hemisphere) |
| `IsNTFleet` | bool | NT Government fleet station |
| `IsActive` | bool | Whether station is active |
| `WebAddress` | string\|null | Station/brand website |
| `AvailableFuels` | array | Current prices for each fuel type at this station |
| `AvailableFuels[].FuelCode` | string | Fuel type code |
| `AvailableFuels[].Price` | float | Current price in **cents per litre** |
| `AvailableFuels[].isAvailable` | bool | Whether this fuel is currently available |
| `AvailableFuels[].OutletId` | int | Back-reference to FuelOutletId |

#### Example curl (with JSON extraction)

```bash
# Suburb search — get all stations, extract JSON
curl -s 'https://myfuelnt.nt.gov.au/Home/Results?searchOptions=suburbPostcode&Suburb=DARWIN+CITY+(0800)&SuburbId=1&RegionId=&FuelCode=DL&BrandIdentifier=' \
  | python3 -c "
import sys, json, html
page = sys.stdin.read()
start = page.find('id=\"serverJson\" value=\"') + len('id=\"serverJson\" value=\"')
end = page.find('\"', start)
data = json.loads(html.unescape(page[start:end]))
print(json.dumps(data, indent=2))
"

# Region search (Darwin, Unleaded 91)
curl -s 'https://myfuelnt.nt.gov.au/Home/Results?searchOptions=region&SuburbId=0&RegionId=3&FuelCode=U91&BrandIdentifier=' \
  | python3 -c "
import sys, json, html
page = sys.stdin.read()
start = page.find('id=\"serverJson\" value=\"') + len('id=\"serverJson\" value=\"')
end = page.find('\"', start)
data = json.loads(html.unescape(page[start:end]))
# Print cheapest U91 stations
for o in sorted(data['FuelOutlet'], key=lambda x: next((f['Price'] for f in x['AvailableFuels'] if f['FuelCode']=='U91'), 9999))[:5]:
    price = next((f['Price'] for f in o['AvailableFuels'] if f['FuelCode']=='U91'), None)
    if price: print(f\"{price}c - {o['OutletName']}, {o['Address']}, {o['Suburb']}\")
"

# Geolocation search (Fuel Near Me)
curl -s 'https://myfuelnt.nt.gov.au/Home/Results?Location=-12.4634,130.8456' \
  | python3 -c "
import sys, json, html
page = sys.stdin.read()
start = page.find('id=\"serverJson\" value=\"') + len('id=\"serverJson\" value=\"')
end = page.find('\"', start)
data = json.loads(html.unescape(page[start:end]))
print(f\"Total outlets: {len(data['FuelOutlet'])}\")
"
```

---

## Reference Tables

### Fuel Type Codes

| Code | Name |
|------|------|
| `DL` | Diesel |
| `U91` | Unleaded 91 |
| `P95` | Premium 95 |
| `P98` | Premium 98 |
| `E10` | Ethanol 94 (E10) |
| `PD` | Premium Diesel |
| `LPG` | LPG |
| `B20` | Biodiesel 20 |
| `E85` | Ethanol 105 (E85) |
| `LAF` | Low Aromatic Fuel |

### Region IDs

| ID | Region |
|----|--------|
| 1 | Top End Rural |
| 2 | Litchfield |
| 3 | Darwin |
| 4 | Central Australia |
| 5 | Barkly |
| 6 | Katherine |
| 7 | East Arnhem |
| 8 | Tiwi Island |
| 9 | Palmerston |

### Brand Codes

| Code | Brand |
|------|-------|
| `AF` | Ausfuel |
| `AM` | AMPOL |
| `AS` | Astron |
| `BP` | BP |
| `C2` | Shell Coles Express |
| `C3` | Shell Reddy Express |
| `CA` | Caltex |
| `CO` | Coles Express |
| `CW` | Caltex Woolworths |
| `EA` | EG Ampol |
| `FX` | FuelXpress |
| `IN` | Independent |
| `IV` | Indervon |
| `Li` | Liberty |
| `MB` | Mobil |
| `MO` | Mogas |
| `OR` | On The Run |
| `PM` | Puma Energy |
| `SH` | Shell |
| `SO` | Solo |
| `UN` | United |

---

## Architecture Notes

- **Framework**: ASP.NET MVC (server-rendered Razor views)
- **Map**: Leaflet.js with OpenStreetMap tiles
- **No CORS headers**: The AJAX endpoints (`SearchSuburb`, `GetRegionCurrentTrend`) return JSON but have no `Access-Control-Allow-Origin` headers. Direct browser-based cross-origin requests will be blocked. Server-side requests (curl, Python, Node.js) work fine.
- **Load balancer**: F5 BIG-IP (`BIGipServer*` cookies). Not required for data access.
- **No rate limiting**: No `X-RateLimit-*` headers observed. No throttling encountered during testing.
- **No pagination**: All 212 outlets are returned in a single response.
- **Data freshness**: Prices appear to be real-time (updated as stations report). The `GetRegionCurrentTrend` endpoint returns "24 Hour Average" prices.
- **Station logos**: Available at `https://myfuelnt.nt.gov.au/Content/Logos/{BrandCode}.png`

## Usage Assessment for Third-Party Apps

### Suitable for third-party use?

**Yes, with caveats:**

1. **Data is comprehensive**: 212 stations, all fuel types, GPS coordinates, real-time prices — everything needed for a fuel price comparison app.

2. **No auth required**: All endpoints work with simple HTTP requests, no API keys or tokens.

3. **Single request gets everything**: One call to `/Home/Results` returns all NT stations with all their current prices. For a mobile app, you'd only need one HTTP request to get the complete dataset.

4. **CORS restriction**: Browser-based apps (SPAs) cannot call these endpoints directly due to missing CORS headers. Use a backend proxy or server-side fetching.

5. **HTML scraping required**: The main data endpoint returns HTML, not JSON. You must parse the `serverJson` hidden input from the HTML response. This is fragile — if the HTML structure changes, extraction will break.

6. **No formal API contract**: These are internal endpoints, not a published API. They could change without notice.

### Recommended approach for FuelSmart AU

```python
import requests
import json
from html import unescape

def get_all_nt_fuel_prices():
    """Fetch all NT fuel station prices in a single request."""
    resp = requests.get(
        'https://myfuelnt.nt.gov.au/Home/Results',
        params={
            'searchOptions': 'region',
            'SuburbId': '0',
            'RegionId': '3',
            'FuelCode': '',
            'BrandIdentifier': ''
        }
    )
    html = resp.text
    start = html.find('id="serverJson" value="') + len('id="serverJson" value="')
    end = html.find('"', start)
    data = json.loads(unescape(html[start:end]))
    return data['FuelOutlet']

def get_regional_averages(fuel_code='U91'):
    """Get 24-hour average prices by region."""
    import time
    resp = requests.get(
        'https://myfuelnt.nt.gov.au/Home/GetRegionCurrentTrend',
        params={'fuelCode': fuel_code, '_': int(time.time() * 1000)}
    )
    return resp.json()
```

### Polling strategy

- **Regional averages**: Poll every 15-30 minutes (lightweight JSON response)
- **Full station data**: Poll every 30-60 minutes (larger HTML response, ~160KB)
- **Suburb list**: Cache indefinitely (changes rarely, if ever)
