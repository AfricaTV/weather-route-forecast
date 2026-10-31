import { useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Route, WeatherSample } from '../types';
import { weatherEmoji } from '../api/weather';
import { WeatherDetails } from './WeatherDetails';

interface Props {
  route: Route | null;
  samples: WeatherSample[];
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
}

function FitBounds({ route }: { route: Route | null }) {
  const map = useMap();
  useEffect(() => {
    if (!route || route.points.length === 0) return;
    const bounds = L.latLngBounds(route.points.map((p) => [p.lat, p.lon]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [route, map]);
  return null;
}

function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const target = container.parentElement ?? container;
    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    ro.observe(target);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

function makeWeatherIcon(sample: WeatherSample, isSelected: boolean): L.DivIcon {
  const html = `
    <div class="weather-marker${isSelected ? ' selected' : ''}">
      <span class="emoji">${weatherEmoji(sample.weatherCode)}</span>
      <span class="temp">${Math.round(sample.temperatureC)}°</span>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'weather-marker-wrapper',
    iconSize: [60, 40],
    iconAnchor: [30, 20],
  });
}

export function RouteMap({ route, samples, selectedIndex, onSelect }: Props) {
  const polyline = route?.points.map((p) => [p.lat, p.lon] as [number, number]) ?? [];
  const markerRefs = useRef<Map<number, L.Marker>>(new Map());
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (selectedIndex == null) return;
    const sample = samples[selectedIndex];
    const marker = markerRefs.current.get(selectedIndex);
    if (sample && mapRef.current) {
      mapRef.current.panTo([sample.lat, sample.lon]);
    }
    if (marker) marker.openPopup();
  }, [selectedIndex, samples]);

  return (
    <MapContainer
      center={[55, 22]}
      zoom={5}
      className="route-map"
      scrollWheelZoom
      ref={(instance) => {
        mapRef.current = instance ?? null;
      }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {polyline.length > 0 && (
        <Polyline positions={polyline} pathOptions={{ color: '#2563eb', weight: 4 }} />
      )}
      {samples.map((s, i) => (
        <Marker
          key={i}
          position={[s.lat, s.lon]}
          icon={makeWeatherIcon(s, i === selectedIndex)}
          ref={(instance) => {
            if (instance) markerRefs.current.set(i, instance);
            else markerRefs.current.delete(i);
          }}
          eventHandlers={{
            click: () => onSelect(i),
            popupclose: () => {
              onSelect(null);
            },
          }}
        >
          <Popup className="weather-popup" minWidth={220} maxWidth={260}>
            <WeatherDetails sample={s} />
          </Popup>
        </Marker>
      ))}
      <FitBounds route={route} />
      <InvalidateOnResize />
    </MapContainer>
  );
}
