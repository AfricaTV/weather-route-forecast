# Weather Route Forecast

A single-page web app that shows a weather forecast along a driving route.
Enter a starting point, optional intermediate stops, a destination, and a
departure time — the app draws the route on a map and overlays weather
predictions at sample points, each timed to the estimated time of arrival.

Built as a university project. Uses only free services with no API keys
required.

## Quick start

Requires Node.js 18 or newer.

```bash
npm install
npm run dev      # http://localhost:5173
```

**Live site:** https://africatv.github.io/weather-route-forecast/

Pushes to `main` are built and published automatically via GitHub Actions.

Other commands:

```bash
npm run build       # production build → dist/
npm run preview     # serve the production build
npm test            # run unit tests once
npm run test:watch  # run unit tests in watch mode
```

## Stack

- **Vite + React 19 + TypeScript** — frontend SPA
- **Leaflet** + **OpenStreetMap** — map
- **[Photon](https://photon.komoot.io/)** — address autocomplete and (reverse) geocoding
- **[OSRM](https://project-osrm.org/)** demo server — multi-waypoint driving routes
- **[Open-Meteo](https://open-meteo.com/)** — hourly weather forecast (up to 16 days)
- **Vitest** — unit tests

## Features

- Multi-waypoint routing with add/remove of intermediate stops
- Address autocomplete with debounce, keyboard navigation, abort-on-retype
- Use-current-location button (browser geolocation API)
- Three-language UI: Russian, English, Latvian
- Bidirectional selection between map markers and the sidebar timeline,
  with a popup showing extended weather details
- 16 unit tests on pure functions

## Documentation

See [`REPORT.md`](./REPORT.md) for the full project report — architecture,
external API contracts (request/response shapes), implementation notes,
testing approach, and limitations.
