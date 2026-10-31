import type { Place } from '../types';
import { reverseGeocode } from '../api/geocoding';
import { I18nError } from '../i18n';

export interface GeoFix {
  lat: number;
  lon: number;
  heading: number | null;
  speed: number | null;
  accuracy: number;
}

function geolocationError(err: GeolocationPositionError): I18nError {
  const errorKeys: Record<number, string> = {
    1: 'errors.geolocation_denied',
    2: 'errors.geolocation_unavailable',
    3: 'errors.geolocation_timeout',
  };
  return new I18nError(errorKeys[err.code] ?? 'errors.geolocation_unavailable');
}

function toGeoFix(pos: GeolocationPosition): GeoFix {
  const { latitude, longitude, heading, speed, accuracy } = pos.coords;
  return {
    lat: latitude,
    lon: longitude,
    heading: heading == null || Number.isNaN(heading) ? null : heading,
    speed: speed == null || Number.isNaN(speed) ? null : speed,
    accuracy,
  };
}

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new I18nError('errors.geolocation_unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => reject(geolocationError(err)),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  });
}

export async function getCurrentPlace(): Promise<Place> {
  const pos = await getCurrentPosition();
  return reverseGeocode(pos.coords.latitude, pos.coords.longitude);
}

const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 1000,
  timeout: 15000,
};

/** Continuous GPS updates for navigation. Returns the watch id. */
export function watchPosition(
  onUpdate: (fix: GeoFix) => void,
  onError: (err: I18nError) => void,
): number {
  if (!('geolocation' in navigator)) {
    onError(new I18nError('errors.geolocation_unsupported'));
    return -1;
  }
  return navigator.geolocation.watchPosition(
    (pos) => onUpdate(toGeoFix(pos)),
    (err) => onError(geolocationError(err)),
    WATCH_OPTIONS,
  );
}

export function clearWatch(watchId: number): void {
  if (watchId >= 0 && 'geolocation' in navigator) {
    navigator.geolocation.clearWatch(watchId);
  }
}
