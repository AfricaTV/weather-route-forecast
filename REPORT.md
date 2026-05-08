# Route Weather Forecast — Project Report

## 1. Introduction

This project is a single-page web application that displays a weather
forecast along a driving route. The user enters a starting point, an
optional set of intermediate stops, and a destination, together with a
departure time. The application then draws the route on an interactive
map and overlays weather predictions at points sampled along the route,
each timed to the estimated time of arrival (ETA) at that location.

The motivation is practical: a driver planning a long trip wants to know
not only "what is the weather at the destination" but "what will I be
driving through, and when?". A storm at the destination is irrelevant if
it has already passed by the time the driver arrives; conversely, fog
arising in two hours along the way matters even if conditions at the
endpoints look fine.

## 2. Requirements

**Functional requirements.**

- Build a driving route between two or more user-specified locations.
- Display the route on an interactive map.
- Show a weather forecast at multiple points along the route, each tied
  to the predicted ETA.
- Provide address autocomplete while the user types.
- Allow the user to use their current location as the starting point.
- Allow the user to add and remove intermediate stops.
- Allow the user to select a forecast point to see additional details,
  with bidirectional synchronisation between the map and the sidebar
  list.
- Provide a user interface in three languages: Russian, English, Latvian.

**Non-functional requirements.**

- Use only free services that do not require API keys, billing, or
  account registration.
- Run as a static client-side application (no backend server required).
- Be deployable from a single `npm run build` command.

## 3. Technology Stack

| Concern        | Choice                          | Rationale                                                                                  |
|----------------|---------------------------------|--------------------------------------------------------------------------------------------|
| Build tool     | Vite                            | Fast HMR, first-class TypeScript and React support, zero-config production bundling.       |
| UI framework   | React 19 + TypeScript           | Component model fits the map/sidebar split; types catch contract errors at compile time.   |
| Map rendering  | Leaflet via `react-leaflet`     | Mature, free, OpenStreetMap-compatible, no API key required.                               |
| Geocoding      | Photon (komoot.io)              | Built specifically for autocomplete (prefix queries); free; no API key.                    |
| Routing        | OSRM public demo server         | Free, supports multi-waypoint routes, returns per-segment durations needed for ETA.        |
| Weather        | Open-Meteo                      | Free, no API key, hourly forecast up to 16 days, supports multi-location batch requests.   |
| Testing        | Vitest                          | Native to Vite; reuses the existing build configuration; fast.                             |

The constraint of no paid services and no registration shaped most
choices. Google Maps, Mapbox, and OpenWeather were rejected on those
grounds, even where they would offer richer data.

## 4. Architecture

The application is a pure client-side SPA. It loads once, then orchestrates
calls to several external HTTP APIs.

```
┌────────────────────────────────────────────────────────────────────────┐
│                            Browser (SPA)                               │
│                                                                        │
│  ┌──────────────┐   ┌────────────────┐   ┌────────────────────────┐    │
│  │  RouteForm   │   │ WeatherTimeline│   │       RouteMap         │    │
│  │ (autocomplete│   │   (sidebar     │◄──┤  (Leaflet + markers)   │    │
│  │  geolocation)│   │    list)       │   │                        │    │
│  └──────┬───────┘   └────────▲───────┘   └────────────▲───────────┘    │
│         │                    │                        │                │
│         │  values            │ samples + selected     │ samples +      │
│         ▼                    │                        │ selected       │
│  ┌────────────────────────────────────────────────────┴───────────┐    │
│  │                          App.tsx                               │    │
│  │  state: route, samples, resolvedPlaces, selectedIndex, error   │    │
│  └──┬──────────┬────────────┬──────────────┬─────────────┬────────┘    │
│     │          │            │              │             │             │
│     ▼          ▼            ▼              ▼             ▼             │
│  geocode  reverseGeo    getRoute   sampleRouteByTime  getWeather       │
│     │          │            │                            │             │
│     └──────────┴──────┐     │                            │             │
│                       │     │                            │             │
│              ┌────────┴─────┴────────────────────────────┴───────┐     │
│              │ src/i18n  ·  src/lib/compass  ·  geolocation API  │     │
│              └──────────────────────────────────────────────────┬┘     │
└──────────────────────────────────────────────────────────────────┴─────┘
            │                       │                       │
            ▼                       ▼                       ▼
    photon.komoot.io       project-osrm.org       api.open-meteo.com
       (geocoding)             (routing)               (weather)
```

**Source layout.**

```
src/
├── App.tsx                  // top-level orchestration
├── main.tsx                 // React root + I18nProvider
├── types.ts                 // shared types
├── api/
│   ├── geocoding.ts         // Photon (search + reverse)
│   ├── routing.ts           // OSRM
│   └── weather.ts           // Open-Meteo
├── lib/
│   ├── sampleRoute.ts       // sample N points along route by time
│   ├── compass.ts           // bearing → 8-point direction
│   ├── geolocation.ts       // navigator.geolocation wrapper
│   └── useDebouncedValue.ts // debounce hook for autocomplete
├── i18n/
│   ├── index.tsx            // I18nProvider, useI18n, I18nError
│   ├── types.ts
│   └── dictionaries/{ru,en,lv}.ts
└── components/
    ├── RouteForm.tsx
    ├── PlaceAutocomplete.tsx
    ├── RouteMap.tsx
    ├── WeatherTimeline.tsx
    ├── WeatherDetails.tsx
    └── LanguageSwitcher.tsx
```

## 5. External APIs and Data Exchange

The application has no backend of its own. All dynamic data comes from
four external HTTP APIs and the browser's built-in Geolocation API. All
HTTP calls are simple `GET` requests; the application sends only query
parameters and receives JSON. No user data is uploaded anywhere — the
project has no persistence layer.

### 5.1 Summary

| API                       | Endpoint                                                | Purpose                                  | Module               |
|---------------------------|---------------------------------------------------------|------------------------------------------|----------------------|
| Photon — forward search   | `GET https://photon.komoot.io/api/`                     | Address autocomplete and geocoding       | `api/geocoding.ts`   |
| Photon — reverse          | `GET https://photon.komoot.io/reverse`                  | Coordinates → human-readable place name  | `api/geocoding.ts`   |
| OSRM — driving route      | `GET https://router.project-osrm.org/route/v1/driving/` | Compute the route between waypoints      | `api/routing.ts`     |
| Open-Meteo — forecast     | `GET https://api.open-meteo.com/v1/forecast`            | Hourly weather forecast at sample points | `api/weather.ts`     |
| Browser Geolocation API   | `navigator.geolocation.getCurrentPosition`              | Detect the user's current coordinates    | `lib/geolocation.ts` |

### 5.2 Photon — forward search

**Request.**

```
GET https://photon.komoot.io/api/?q={query}&limit={n}
```

| Parameter | Sent                                                              |
|-----------|-------------------------------------------------------------------|
| `q`       | URL-encoded user query (minimum 2 characters).                    |
| `limit`   | `5` for autocomplete suggestions, `1` for direct geocoding on submit. |

**Response (relevant fields only).** GeoJSON FeatureCollection:

```
{
  "features": [
    {
      "geometry": { "coordinates": [lon, lat] },
      "properties": {
        "name", "street", "housenumber",
        "city", "state", "country"
      }
    },
    ...
  ]
}
```

The implementation builds a display string from `name`, `street`,
`housenumber`, `city`, `state`, `country`, deduplicating identical
values, and stores `(lat, lon, displayName)` for each suggestion.

### 5.3 Photon — reverse geocoding

**Request.**

```
GET https://photon.komoot.io/reverse?lat={lat}&lon={lon}
```

**Sent:** the latitude and longitude returned by the browser geolocation
API (decimal degrees).

**Response.** Same FeatureCollection shape as forward search; the first
feature is used to produce a display name. The latitude and longitude
are kept from the original GPS reading rather than from the response, to
preserve precision.

### 5.4 OSRM — driving route

**Request.**

```
GET https://router.project-osrm.org/route/v1/driving/{coords}
    ?overview=full
    &geometries=geojson
    &annotations=duration,distance
```

| Parameter      | Sent                                                                                  |
|----------------|---------------------------------------------------------------------------------------|
| `{coords}`     | `lon,lat;lon,lat;...` — two or more waypoints in order.                               |
| `overview`     | `full` — request the full polyline, not a simplified one.                             |
| `geometries`   | `geojson` — coordinates as `[lon, lat]` pairs (rather than encoded polyline).         |
| `annotations`  | `duration,distance` — request per-segment durations and distances for ETA computation. |

**Response (relevant fields only).**

```
{
  "code": "Ok",
  "routes": [
    {
      "duration": <total seconds>,
      "distance": <total metres>,
      "geometry": {
        "coordinates": [[lon, lat], ...]    // the full polyline
      },
      "legs": [
        {
          "annotation": {
            "duration": [<sec per segment>, ...],
            "distance": [<m per segment>, ...]
          }
        },
        ...
      ]
    }
  ]
}
```

The combined `geometry.coordinates` array spans every leg. The per-segment
annotations from each leg are concatenated and accumulated to give the
elapsed time and distance at every geometry point — the basis for ETA-aware
sampling (see §6.2).

### 5.5 Open-Meteo — hourly forecast

**Request.**

```
GET https://api.open-meteo.com/v1/forecast
    ?latitude=lat1,lat2,...
    &longitude=lon1,lon2,...
    &hourly=temperature_2m,apparent_temperature,
            relative_humidity_2m,cloud_cover,
            weather_code,precipitation,
            wind_speed_10m,wind_direction_10m
    &timeformat=unixtime
    &forecast_days=16
```

| Parameter        | Sent                                                                                          |
|------------------|-----------------------------------------------------------------------------------------------|
| `latitude`       | Comma-separated latitudes of every sample point along the route.                              |
| `longitude`      | Comma-separated longitudes, in the same order.                                                |
| `hourly`         | Comma-separated list of weather variables to return.                                          |
| `timeformat`     | `unixtime` — return absolute timestamps in seconds (simplifies ETA matching).                 |
| `forecast_days`  | `16` — the maximum horizon Open-Meteo supports.                                               |

Querying multiple sample points in a single request keeps the application
to one HTTP call per route, regardless of how many points it samples.

**Response.** When multiple locations are requested, the response is an
array of forecasts in the same order as the inputs:

```
[
  {
    "latitude", "longitude",
    "hourly": {
      "time":                 [unixSec, ...],   // hourly steps, 16 days
      "temperature_2m":       [°C, ...],
      "apparent_temperature": [°C, ...],
      "relative_humidity_2m": [%, ...],
      "cloud_cover":          [%, ...],
      "weather_code":         [WMO code, ...],
      "precipitation":        [mm, ...],
      "wind_speed_10m":       [km/h, ...],
      "wind_direction_10m":   [degrees, ...]
    }
  },
  ...
]
```

For each sample, the implementation finds the index in `hourly.time`
whose value is closest to the sample's ETA and reads the corresponding
weather variables at that index. WMO weather codes are mapped to emoji
and to a localised description ("light rain", "thunderstorm", etc.).

### 5.6 Browser Geolocation API

This is not an HTTP API but is used as one. It is invoked when the user
clicks "Use my location" or submits the form with an empty origin.

**Call.**

```
navigator.geolocation.getCurrentPosition(success, error, {
  enableHighAccuracy: false,
  timeout: 10_000,
  maximumAge: 60_000,
})
```

**Returned data.** A `GeolocationPosition` whose `coords.latitude` and
`coords.longitude` are then passed to Photon's reverse endpoint (§5.3)
to obtain a display name for the user. Permission errors (`PERMISSION_DENIED`,
`POSITION_UNAVAILABLE`, `TIMEOUT`) are translated into i18n keys and
shown in the user's chosen language.

## 6. Implementation

### 6.1 Routing and ETA computation

OSRM accepts an arbitrary number of waypoints joined with `;` in the URL
path (see §5.4 for the full request shape). The implementation flattens
the per-leg `annotation.duration` and `annotation.distance` arrays into a
single sequence and computes a cumulative duration and distance for every
geometry point. At leg boundaries the boundary point appears once in the
geometry, and the sum of segment counts across all legs equals
`geometry.length - 1`, so the indices align without special handling.

### 6.2 Sampling the route by time

To overlay weather along the route, we sample N points whose ETAs are
equally spaced from departure to arrival. The number of samples is chosen
proportionally to the trip duration, clamped to a sensible range:

```
N = clamp(ceil(totalHours) + 1, 3, 12)
```

For each sample `i` from `0` to `N-1`, the target elapsed time is
`(i / (N-1)) * totalDurationSec`. A binary search over the precomputed
cumulative-duration array finds the geometry point whose cumulative
duration is closest to the target. The point's coordinates and the absolute
ETA `departure + targetSec` are then queried from the weather API.

This approach yields evenly time-spaced samples regardless of how the
route's speed varies (e.g., highways vs city streets), which is what the
user actually cares about.

### 6.3 Weather lookup

Open-Meteo accepts multiple locations in a single request via comma-
separated `latitude` and `longitude` parameters (see §5.5). All sample
points are fetched in one HTTP call, and for each sample the implementation
finds the hourly forecast index whose timestamp is closest to that
sample's ETA. Open-Meteo guarantees hourly resolution, so the maximum
error in time alignment is ±30 minutes — well within the inherent
uncertainty of weather forecasting.

### 6.4 Geocoding and autocomplete

Photon was chosen over Nominatim because Nominatim's full-text search does
not perform well on prefix queries — typing "Krak" returns places literally
named "Krak", not "Kraków". Photon is a derivative project from komoot
designed specifically for autocomplete and returns sensible prefix matches
on the same OSM dataset.

The autocomplete component debounces keystrokes by 400 ms and uses
`AbortController` to cancel any in-flight request when a new keystroke
arrives. When the user picks a suggestion, the resolved coordinates are
stored alongside the textual value, so the form does not need to repeat
the geocoding request on submit.

Reverse geocoding (coordinates → display name) is also done via Photon
and is used after the browser geolocation API returns coordinates.

### 6.5 Internationalisation

A custom React Context-based i18n is used in place of a library. Three
flat dictionaries (`ru.ts`, `en.ts`, `lv.ts`) map dotted keys
(`form.label_from`, `weather.code_63`, `errors.geolocation_denied`, …) to
language-specific strings. The `t(key, params)` function performs simple
`{{name}}` interpolation. Selected language persists in `localStorage`;
on first visit it is detected from `navigator.language`.

For errors thrown from API and library modules, a custom `I18nError` class
carries a translation key plus parameters. The top-level `App` component
catches these and translates them in the user's current language.

## 7. Features

- **Multi-waypoint routing** — the form supports any number of
  intermediate stops, each with its own autocomplete input. The route is
  computed in a single OSRM request.
- **Address autocomplete** with debounced suggestions, keyboard
  navigation (arrow keys / Enter / Escape), and outside-click dismissal.
- **Current location** — a button (or an empty starting field) triggers
  the browser geolocation API, which is then reverse-geocoded to a
  human-readable name.
- **Three-language UI** (Russian / English / Latvian) with a switcher in
  the sidebar header.
- **Bidirectional selection** between the map and the sidebar timeline.
  Clicking a marker highlights the corresponding sidebar entry, opens a
  popup with extended weather details (apparent temperature, humidity,
  cloud cover, wind direction by 8-point compass, precipitation,
  coordinates), and auto-scrolls the list. Clicking a sidebar entry pans
  the map to the marker and opens its popup.
- **Sensible error handling** — geolocation refusal, places not found,
  and routes longer than 16 days are reported in the user's language.

## 8. Testing

The project uses Vitest for unit testing. Vitest reuses the project's
existing Vite configuration, so no separate build setup is required.

Tests focus on pure functions where the input/output relationship is
fully deterministic and no DOM, network, or React rendering is involved.
This gives a good return on testing effort and avoids the maintenance
burden of mocking external services.

| File                                  | Tests | Scope                                                |
|---------------------------------------|-------|------------------------------------------------------|
| `src/lib/compass.test.ts`             |     7 | Cardinal/diagonal directions, normalisation of >360° and negatives, sector boundaries. |
| `src/lib/sampleRoute.test.ts`         |     7 | Start/finish positions, ETA endpoints, monotonicity, sample-count clamping. |
| `src/api/weather.test.ts`             |     2 | Known WMO codes map to the right emoji; unknown codes fall back to `❔`. |

Total: 16 tests, run in ~165 ms.

```
$ npm test
 Test Files  3 passed (3)
      Tests  16 passed (16)
```

The HTTP-bound modules (`getRoute`, `geocode`, `getWeatherAtPoints`) are
not unit-tested. Testing them properly would require mocking `fetch` or
introducing a service worker (MSW); given the scope of this project, the
benefit was judged not to justify the added test infrastructure.

## 9. Limitations

- **Forecast horizon.** Open-Meteo provides hourly data for the next 16
  days. If the route's last sample falls beyond that window the
  application reports that the forecast is unavailable rather than
  returning stale data.
- **OSRM demo server.** The public OSRM endpoint is best-effort. For
  production use a self-hosted OSRM instance or a service such as
  OpenRouteService (also free, with a free API key) would be more
  reliable.
- **Geocoding ranking.** Photon ranks results by OSM "importance" score,
  which can place an obscure American village above the well-known
  European city of the same name (e.g., "Riga, NY" appearing before
  "Rīga, Latvia"). A bounding-box bias parameter could mitigate this for
  a regional audience.
- **Geocoding language.** Photon supports `default`, `de`, `en`, `fr`
  only. Place names returned to the user are therefore in the local
  language of each location, regardless of the UI language.
- **Geolocation.** The browser geolocation API requires HTTPS or
  `localhost`. On a public deployment the site must therefore be served
  over HTTPS.

## 10. Future Work

- Support cycling and walking profiles (OSRM exposes them via different
  URL prefixes).
- Visually highlight hazardous weather (thunderstorms, ice, heavy snow)
  along the route.
- Bias geocoding suggestions by the user's current location or by a
  recent route to improve relevance.
- Persist recent routes in `localStorage` for one-click recall.
- Show wind, temperature, or precipitation as a colour-graded overlay on
  the route polyline rather than only at sample points.

## 11. Setup and Running

The project requires Node.js 18 or newer.

```
npm install         # install dependencies
npm run dev         # start the development server (http://localhost:5173)
npm run build       # produce a production build in dist/
npm run preview     # serve the production build locally
npm test            # run unit tests once
npm run test:watch  # run unit tests in watch mode
```

No environment variables, API keys, or external services beyond a
working internet connection are required.

## 12. References

- OpenStreetMap project — https://www.openstreetmap.org/
- Leaflet — https://leafletjs.com/
- react-leaflet — https://react-leaflet.js.org/
- OSRM (Open Source Routing Machine) — https://project-osrm.org/
- Photon geocoder by komoot — https://photon.komoot.io/
- Open-Meteo — https://open-meteo.com/
- WMO weather interpretation codes — https://open-meteo.com/en/docs#weathervariables
- Vite — https://vite.dev/
- Vitest — https://vitest.dev/
