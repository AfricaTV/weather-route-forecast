import type { LatLon, WaypointPosition, WeatherSample } from '../types';

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

interface HourlyData {
  time: number[];
  temperature_2m: number[];
  apparent_temperature: number[];
  relative_humidity_2m: number[];
  cloud_cover: number[];
  weather_code: number[];
  precipitation: number[];
  wind_speed_10m: number[];
  wind_direction_10m: number[];
}

interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  hourly: HourlyData;
}

export interface WeatherQuery extends LatLon {
  eta: Date;
  position: WaypointPosition;
  distanceKm: number;
}

export async function getWeatherAtPoints(
  queries: WeatherQuery[],
): Promise<WeatherSample[]> {
  if (queries.length === 0) return [];

  const lats = queries.map((q) => q.lat.toFixed(4)).join(',');
  const lons = queries.map((q) => q.lon.toFixed(4)).join(',');
  const params = new URLSearchParams({
    latitude: lats,
    longitude: lons,
    hourly:
      'temperature_2m,apparent_temperature,relative_humidity_2m,cloud_cover,weather_code,precipitation,wind_speed_10m,wind_direction_10m',
    timeformat: 'unixtime',
    forecast_days: '16',
  });
  const url = `${OPEN_METEO_URL}?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API failed: ${res.status}`);
  const raw = await res.json();
  const responses: OpenMeteoResponse[] = Array.isArray(raw) ? raw : [raw];

  return queries.map((q, i) => {
    const r = responses[i];
    const idx = nearestHourIndex(r.hourly.time, q.eta);
    return {
      lat: q.lat,
      lon: q.lon,
      eta: q.eta,
      temperatureC: r.hourly.temperature_2m[idx],
      apparentTemperatureC: r.hourly.apparent_temperature[idx],
      humidity: r.hourly.relative_humidity_2m[idx],
      cloudCover: r.hourly.cloud_cover[idx],
      weatherCode: r.hourly.weather_code[idx],
      precipitationMm: r.hourly.precipitation[idx],
      windSpeedKmh: r.hourly.wind_speed_10m[idx],
      windDirectionDeg: r.hourly.wind_direction_10m[idx],
      position: q.position,
      distanceKm: q.distanceKm,
    };
  });
}

function nearestHourIndex(unixTimes: number[], target: Date): number {
  const targetSec = Math.floor(target.getTime() / 1000);
  let bestIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < unixTimes.length; i++) {
    const diff = Math.abs(unixTimes[i] - targetSec);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  return bestIdx;
}

const WMO_CODE_TO_EMOJI: Record<number, string> = {
  0: '☀️',
  1: '🌤️',
  2: '⛅',
  3: '☁️',
  45: '🌫️',
  48: '🌫️',
  51: '🌦️',
  53: '🌦️',
  55: '🌦️',
  61: '🌧️',
  63: '🌧️',
  65: '🌧️',
  71: '🌨️',
  73: '🌨️',
  75: '🌨️',
  77: '🌨️',
  80: '🌦️',
  81: '🌧️',
  82: '⛈️',
  85: '🌨️',
  86: '🌨️',
  95: '⛈️',
  96: '⛈️',
  99: '⛈️',
};

export function weatherEmoji(code: number): string {
  return WMO_CODE_TO_EMOJI[code] ?? '❔';
}
