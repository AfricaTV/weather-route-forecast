import type { Route, WaypointPosition } from '../types';
import type { WeatherQuery } from '../api/weather';

const MIN_SAMPLES = 3;
const MAX_SAMPLES = 12;

export function sampleRouteByTime(route: Route, departure: Date): WeatherQuery[] {
  const totalSec = route.totalDurationSec;
  const totalHours = totalSec / 3600;

  const numSamples = Math.min(
    MAX_SAMPLES,
    Math.max(MIN_SAMPLES, Math.ceil(totalHours) + 1),
  );

  const samples: WeatherQuery[] = [];
  for (let i = 0; i < numSamples; i++) {
    const targetSec = (i / (numSamples - 1)) * totalSec;
    const point = findPointAtDuration(route, targetSec);
    const eta = new Date(departure.getTime() + targetSec * 1000);
    const position: WaypointPosition =
      i === 0 ? 'start' : i === numSamples - 1 ? 'finish' : 'middle';
    samples.push({
      lat: point.lat,
      lon: point.lon,
      eta,
      position,
      distanceKm: Math.round(point.cumulativeDistanceM / 1000),
    });
  }
  return samples;
}

function findPointAtDuration(route: Route, targetSec: number) {
  const points = route.points;
  if (targetSec <= 0) return points[0];
  if (targetSec >= route.totalDurationSec) return points[points.length - 1];

  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi - 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (points[mid].cumulativeDurationSec < targetSec) lo = mid;
    else hi = mid;
  }
  const a = points[lo];
  const b = points[hi];
  return Math.abs(a.cumulativeDurationSec - targetSec) <
    Math.abs(b.cumulativeDurationSec - targetSec)
    ? a
    : b;
}
