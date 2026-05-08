import type { Place } from '../types';
import { reverseGeocode } from '../api/geocoding';
import { I18nError } from '../i18n';

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new I18nError('errors.geolocation_unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => {
        const errorKeys: Record<number, string> = {
          1: 'errors.geolocation_denied',
          2: 'errors.geolocation_unavailable',
          3: 'errors.geolocation_timeout',
        };
        reject(new I18nError(errorKeys[err.code] ?? 'errors.geolocation_unavailable'));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  });
}

export async function getCurrentPlace(): Promise<Place> {
  const pos = await getCurrentPosition();
  return reverseGeocode(pos.coords.latitude, pos.coords.longitude);
}
