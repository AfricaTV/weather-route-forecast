import { useEffect, useRef, useState } from 'react';
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
import { watchPosition, clearWatch, type GeoFix } from '../lib/geolocation';
import { bearingDegrees } from '../lib/bearing';
import { I18nError, useI18n } from '../i18n';

const NAV_ZOOM = 16.5;

interface Props {
  route: Route | null;
  samples: WeatherSample[];
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  navigating?: boolean;
  onNavigationError?: (message: string) => void;
}

interface NavPose {
  lat: number;
  lon: number;
  heading: number;
}

function fitRouteToMap(map: L.Map, route: Route) {
  map.invalidateSize({ animate: false });
  const size = map.getSize();
  if (size.x < 80 || size.y < 80) return;

  const bounds = L.latLngBounds(route.points.map((p) => [p.lat, p.lon]));
  const padX = Math.max(24, Math.round(size.x * 0.1));
  const padY = Math.max(24, Math.round(size.y * 0.1));
  map.fitBounds(bounds, {
    padding: [padX, padY],
    maxZoom: 12,
    animate: false,
  });
}

function FitBounds({ route, enabled }: { route: Route | null; enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled || !route || route.points.length === 0) return;

    const fit = () => fitRouteToMap(map, route);
    fit();
    const t1 = window.setTimeout(fit, 50);
    const t2 = window.setTimeout(fit, 250);

    let debounce: number | undefined;
    const container = map.getContainer();
    const target = container.parentElement ?? container;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(fit, 80);
    });
    ro.observe(target);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(debounce);
      ro.disconnect();
    };
  }, [route, map, enabled]);
  return null;
}

function InvalidateOnResize({ active }: { active: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!active) return;
    const container = map.getContainer();
    const target = container.parentElement ?? container;
    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    ro.observe(target);
    return () => ro.disconnect();
  }, [map, active]);
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

function makeNavArrowIcon(heading: number): L.DivIcon {
  return L.divIcon({
    html: `<div class="nav-arrow" style="transform: rotate(${heading}deg)"></div>`,
    className: 'nav-arrow-wrapper',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

/** Keep map centered on the navigator and apply heading-up rotation. */
function NavigationCamera({ pose, active }: { pose: NavPose | null; active: boolean }) {
  const map = useMap();

  useEffect(() => {
    const pane = map.getPane('mapPane');
    if (!pane) return;

    if (!active) {
      pane.style.transform = '';
      pane.style.transformOrigin = '';
      return;
    }

    const applyRotation = (heading: number) => {
      const size = map.getSize();
      pane.style.transformOrigin = `${size.x / 2}px ${size.y / 2}px`;
      pane.style.transform = `rotate(${-heading}deg)`;
    };

    if (pose) {
      map.setView([pose.lat, pose.lon], NAV_ZOOM, { animate: false });
      applyRotation(pose.heading);
    }

    const onResize = () => {
      map.invalidateSize({ animate: false });
      if (pose) {
        map.setView([pose.lat, pose.lon], NAV_ZOOM, { animate: false });
        applyRotation(pose.heading);
      }
    };
    map.on('resize', onResize);
    return () => {
      map.off('resize', onResize);
      if (!active) {
        pane.style.transform = '';
        pane.style.transformOrigin = '';
      }
    };
  }, [map, pose, active]);

  useEffect(() => {
    if (active) return;
    const pane = map.getPane('mapPane');
    if (pane) {
      pane.style.transform = '';
      pane.style.transformOrigin = '';
    }
  }, [active, map]);

  return null;
}

/** Jump to route start when navigation begins, before the first GPS fix. */
function JumpToRouteStart({ route, active }: { route: Route | null; active: boolean }) {
  const map = useMap();
  const didJump = useRef(false);

  useEffect(() => {
    if (!active) {
      didJump.current = false;
      return;
    }
    if (didJump.current || !route || route.points.length === 0) return;
    const start = route.points[0];
    map.setView([start.lat, start.lon], NAV_ZOOM, { animate: false });
    didJump.current = true;
  }, [active, route, map]);

  return null;
}

export function RouteMap({
  route,
  samples,
  selectedIndex,
  onSelect,
  navigating = false,
  onNavigationError,
}: Props) {
  const { t } = useI18n();
  const polyline = route?.points.map((p) => [p.lat, p.lon] as [number, number]) ?? [];
  const markerRefs = useRef<Map<number, L.Marker>>(new Map());
  const mapRef = useRef<L.Map | null>(null);
  const lastFixRef = useRef<GeoFix | null>(null);
  const lastHeadingRef = useRef(0);
  const [pose, setPose] = useState<NavPose | null>(null);

  useEffect(() => {
    if (navigating || selectedIndex == null) return;
    const sample = samples[selectedIndex];
    const marker = markerRefs.current.get(selectedIndex);
    if (sample && mapRef.current) {
      mapRef.current.panTo([sample.lat, sample.lon]);
    }
    if (marker) marker.openPopup();
  }, [selectedIndex, samples, navigating]);

  useEffect(() => {
    if (!navigating) {
      setPose(null);
      lastFixRef.current = null;
      lastHeadingRef.current = 0;
      return;
    }

    if (route && route.points.length >= 2) {
      lastHeadingRef.current = bearingDegrees(route.points[0], route.points[1]);
    }

    const watchId = watchPosition(
      (fix) => {
        let heading = fix.heading;
        const prev = lastFixRef.current;
        const moving =
          prev &&
          (Math.abs(fix.lat - prev.lat) > 1e-6 || Math.abs(fix.lon - prev.lon) > 1e-6);
        if ((heading == null || (fix.speed != null && fix.speed < 1)) && moving && prev) {
          heading = bearingDegrees(
            { lat: prev.lat, lon: prev.lon },
            { lat: fix.lat, lon: fix.lon },
          );
        }
        if (heading == null) heading = lastHeadingRef.current;

        lastHeadingRef.current = heading;
        lastFixRef.current = fix;
        setPose({ lat: fix.lat, lon: fix.lon, heading });
      },
      (err) => {
        const message =
          err instanceof I18nError ? t(err.key, err.params) : t('errors.geolocation_unavailable');
        onNavigationError?.(message);
      },
    );

    return () => clearWatch(watchId);
  }, [navigating, route, t, onNavigationError]);

  const hasRoute = Boolean(route && route.points.length > 0);

  return (
    <MapContainer
      center={[55, 22]}
      zoom={5}
      className={`route-map${navigating ? ' navigating' : ''}`}
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
      {!navigating &&
        samples.map((s, i) => (
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
      {navigating && pose && (
        <Marker
          position={[pose.lat, pose.lon]}
          icon={makeNavArrowIcon(pose.heading)}
          zIndexOffset={1000}
        />
      )}
      <FitBounds route={route} enabled={hasRoute && !navigating} />
      <JumpToRouteStart route={route} active={navigating && !pose} />
      <NavigationCamera pose={pose} active={navigating} />
      <InvalidateOnResize active={!hasRoute || navigating} />
    </MapContainer>
  );
}
