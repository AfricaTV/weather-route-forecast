import type { LatLon, Route, RouteGeometryPoint } from '../types';
import { I18nError } from '../i18n';

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

interface OsrmResponse {
  code: string;
  routes: Array<{
    duration: number;
    distance: number;
    geometry: { coordinates: [number, number][] };
    legs: Array<{
      annotation?: { duration: number[]; distance: number[] };
    }>;
  }>;
}

export async function getRoute(waypoints: LatLon[]): Promise<Route> {
  if (waypoints.length < 2) {
    throw new I18nError('errors.need_two_points');
  }
  const coords = waypoints.map((w) => `${w.lon},${w.lat}`).join(';');
  const url = `${OSRM_URL}/${coords}?overview=full&geometries=geojson&annotations=duration,distance`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Routing failed: ${res.status}`);
  const data = (await res.json()) as OsrmResponse;
  if (data.code !== 'Ok' || data.routes.length === 0) {
    throw new Error(`No route found: ${data.code}`);
  }
  const route = data.routes[0];

  const durations = route.legs.flatMap((l) => l.annotation?.duration ?? []);
  const distances = route.legs.flatMap((l) => l.annotation?.distance ?? []);
  const coordinates = route.geometry.coordinates;

  const points: RouteGeometryPoint[] = [];
  let cumDur = 0;
  let cumDist = 0;
  for (let i = 0; i < coordinates.length; i++) {
    if (i > 0) {
      cumDur += durations[i - 1] ?? 0;
      cumDist += distances[i - 1] ?? 0;
    }
    const [lon, lat] = coordinates[i];
    points.push({ lat, lon, cumulativeDurationSec: cumDur, cumulativeDistanceM: cumDist });
  }

  return {
    points,
    totalDurationSec: route.duration,
    totalDistanceM: route.distance,
  };
}
