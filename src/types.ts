export interface LatLon {
  lat: number;
  lon: number;
}

export interface Place extends LatLon {
  displayName: string;
}

export interface Waypoint {
  query: string;
  place: Place | null;
}

export interface RouteGeometryPoint extends LatLon {
  cumulativeDurationSec: number;
  cumulativeDistanceM: number;
}

export interface Route {
  points: RouteGeometryPoint[];
  totalDurationSec: number;
  totalDistanceM: number;
}

export type WaypointPosition = 'start' | 'finish' | 'middle';

export interface WeatherSample {
  lat: number;
  lon: number;
  eta: Date;
  temperatureC: number;
  apparentTemperatureC: number;
  humidity: number;
  cloudCover: number;
  weatherCode: number;
  precipitationMm: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  position: WaypointPosition;
  distanceKm: number;
}
