import type { Place } from '../types';
import { I18nError } from '../i18n';

const PHOTON_URL = 'https://photon.komoot.io/api/';

interface PhotonProps {
  name?: string;
  street?: string;
  housenumber?: string;
  city?: string;
  state?: string;
  county?: string;
  country?: string;
  postcode?: string;
  type?: string;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number]; type: string };
  properties: PhotonProps;
}

interface PhotonResponse {
  features: PhotonFeature[];
}

function formatDisplayName(props: PhotonProps): string {
  const head = [props.name, props.street, props.housenumber]
    .filter(Boolean)
    .join(' ');
  const tail = [props.city, props.state, props.country]
    .filter((v): v is string => Boolean(v) && v !== props.name)
    .filter((v, i, arr) => arr.indexOf(v) === i);
  return [head, ...tail].filter(Boolean).join(', ');
}

function toPlace(feature: PhotonFeature): Place {
  const [lon, lat] = feature.geometry.coordinates;
  return {
    lat,
    lon,
    displayName: formatDisplayName(feature.properties),
  };
}

export async function searchPlaces(
  query: string,
  limit = 5,
  signal?: AbortSignal,
): Promise<Place[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const url = `${PHOTON_URL}?q=${encodeURIComponent(trimmed)}&limit=${limit}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  const data = (await res.json()) as PhotonResponse;
  return data.features.map(toPlace);
}

export async function geocode(query: string): Promise<Place> {
  const results = await searchPlaces(query, 1);
  if (results.length === 0) {
    throw new I18nError('errors.location_not_found', { query });
  }
  return results[0];
}

export async function reverseGeocode(lat: number, lon: number): Promise<Place> {
  const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Reverse geocoding failed: ${res.status}`);
  const data = (await res.json()) as PhotonResponse;
  if (data.features.length === 0) {
    return { lat, lon, displayName: `${lat.toFixed(4)}, ${lon.toFixed(4)}` };
  }
  const place = toPlace(data.features[0]);
  return { ...place, lat, lon };
}
