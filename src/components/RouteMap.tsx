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
import { bearingDegrees, lerpAngle } from '../lib/bearing';
import { I18nError, useI18n } from '../i18n';

const NAV_ZOOM = 17;
const HEADING_DEADZONE = 3;
const HEADING_SMOOTH = 0.12;
const NORTH_EPS = 2;

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

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function shortestDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
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
    <div class="weather-marker-billboard">
      <div class="weather-marker${isSelected ? ' selected' : ''}">
        <span class="emoji">${weatherEmoji(sample.weatherCode)}</span>
        <span class="temp">${Math.round(sample.temperatureC)}°</span>
      </div>
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
  // Rotate relative to map north; with heading-up (bearing≈heading) this points screen-up.
  return L.divIcon({
    html: `<div class="nav-arrow" style="transform: rotate(${heading}deg)"></div>`,
    className: 'nav-arrow-wrapper',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function setBillboardUpright(container: HTMLElement, heading: number | null) {
  const rotate = heading == null ? '' : `rotate(${heading}deg)`;
  container.querySelectorAll<HTMLElement>('.weather-marker-billboard').forEach((el) => {
    el.style.transform = rotate;
  });
  container.querySelectorAll<HTMLElement>('.leaflet-popup-content-wrapper').forEach((el) => {
    el.style.transform = rotate;
    el.style.transformOrigin = 'center bottom';
  });
  container.querySelectorAll<HTMLElement>('.leaflet-popup-tip-container').forEach((el) => {
    el.style.transform = rotate;
    el.style.transformOrigin = 'center top';
  });
}

function applyMapBearing(map: L.Map, bearing: number) {
  const pane = map.getPane('mapPane');
  if (!pane) return;

  const pos = (map as L.Map & { _getMapPanePos?: () => L.Point })._getMapPanePos?.()
    ?? new L.Point(0, 0);
  const size = map.getSize();
  const container = map.getContainer();

  if (Math.abs(shortestDelta(0, bearing)) < 0.05) {
    pane.style.transformOrigin = '';
    pane.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0px)`;
    container.classList.remove('map-rotated');
    container.style.removeProperty('--nav-heading');
    setBillboardUpright(container, null);
    return;
  }

  pane.style.transformOrigin = `${-pos.x + size.x / 2}px ${-pos.y + size.y / 2}px`;
  pane.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0px) rotate(${-bearing}deg)`;
  container.classList.add('map-rotated');
  container.style.setProperty('--nav-heading', `${bearing}deg`);
  setBillboardUpright(container, bearing);
}

function clearMapBearing(map: L.Map) {
  const pane = map.getPane('mapPane');
  if (!pane) return;
  pane.style.transformOrigin = '';
  const pos = (map as L.Map & { _getMapPanePos?: () => L.Point })._getMapPanePos?.();
  pane.style.transform = pos ? `translate3d(${pos.x}px, ${pos.y}px, 0px)` : '';
  const container = map.getContainer();
  container.classList.remove('map-rotated');
  container.style.removeProperty('--nav-heading');
  setBillboardUpright(container, null);
}

function screenOffsetToMapOffset(offset: L.Point, headingDeg: number): L.Point {
  const h = (headingDeg * Math.PI) / 180;
  const cos = Math.cos(h);
  const sin = Math.sin(h);
  return new L.Point(
    offset.x * cos - offset.y * sin,
    offset.x * sin + offset.y * cos,
  );
}

type LeafletDraggable = L.Draggable & {
  _onMove: (e: Event) => void;
  _element: HTMLElement;
  _startPoint: L.Point;
  _startPos: L.Point;
  _newPos: L.Point;
  _moved: boolean;
  _moving: boolean;
  _enabled: boolean;
  _animRequest: number;
  _lastEvent: Event;
  _lastTarget: EventTarget | null;
  _updatePosition: () => void;
  options: { clickTolerance: number };
};

function patchHeadingAwareDrag(
  map: L.Map,
  headingRef: { current: number },
): (() => void) | null {
  const dragging = map.dragging as L.Handler & { _draggable?: LeafletDraggable };
  const draggable = dragging?._draggable;
  if (!draggable) return null;

  const originalOnMove = draggable._onMove;
  draggable._onMove = function patchedOnMove(this: LeafletDraggable, e: Event) {
    if (!this._enabled) return;

    const touchEvent = e as TouchEvent;
    if (touchEvent.touches && touchEvent.touches.length > 1) {
      this._moved = true;
      return;
    }

    const first =
      touchEvent.touches && touchEvent.touches.length === 1
        ? touchEvent.touches[0]
        : (e as MouseEvent);
    const newPoint = new L.Point(first.clientX, first.clientY);
    let offset = newPoint.subtract(this._startPoint);

    if (!offset.x && !offset.y) return;
    if (Math.abs(offset.x) + Math.abs(offset.y) < this.options.clickTolerance) {
      return;
    }

    offset = screenOffsetToMapOffset(offset, headingRef.current);

    L.DomEvent.preventDefault(e);

    if (!this._moved) {
      this.fire('dragstart');
      this._moved = true;
      this._startPos = L.DomUtil.getPosition(this._element).subtract(offset);
      L.DomUtil.addClass(document.body, 'leaflet-dragging');
      this._lastTarget = e.target ?? null;
      if (this._lastTarget instanceof HTMLElement) {
        L.DomUtil.addClass(this._lastTarget, 'leaflet-drag-target');
      }
    }

    this._newPos = this._startPos.add(offset);
    this._moving = true;
    L.Util.cancelAnimFrame(this._animRequest);
    this._lastEvent = e;
    this._animRequest = L.Util.requestAnimFrame(this._updatePosition, this, true);
  };

  return () => {
    draggable._onMove = originalOnMove;
  };
}

function touchAngle(a: Touch, b: Touch): number {
  return (Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * 180) / Math.PI;
}

/**
 * Manual map rotation (two-finger twist / Alt+drag) + optional GPS heading-up while navigating.
 */
function MapRotationController({
  navigating,
  pose,
  route,
  autoFollowHeading,
  onAutoFollowHeadingChange,
  onBearingChange,
}: {
  navigating: boolean;
  pose: NavPose | null;
  route: Route | null;
  autoFollowHeading: boolean;
  onAutoFollowHeadingChange: (v: boolean) => void;
  onBearingChange: (bearing: number) => void;
}) {
  const map = useMap();
  const smoothBearingRef = useRef(0);
  const targetBearingRef = useRef(0);
  const poseRef = useRef(pose);
  const rafRef = useRef<number | null>(null);
  const zoomReadyRef = useRef(false);
  const userAdjustedZoomRef = useRef(false);
  const programmaticZoomRef = useRef(false);
  const userDraggingRef = useRef(false);
  const autoFollowRef = useRef(autoFollowHeading);
  const rotatingGestureRef = useRef(false);

  poseRef.current = pose;
  autoFollowRef.current = autoFollowHeading;

  const stopLoop = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const publishBearing = (bearing: number) => {
    smoothBearingRef.current = bearing;
    applyMapBearing(map, bearing);
    onBearingChange(bearing);
  };

  const startLoop = () => {
    if (rafRef.current != null) return;
    const tick = () => {
      const current = smoothBearingRef.current;
      const target = targetBearingRef.current;
      const delta = Math.abs(shortestDelta(current, target));
      if (delta < 0.2) {
        publishBearing(normalizeDeg(target));
        rafRef.current = null;
        return;
      }
      publishBearing(lerpAngle(current, target, HEADING_SMOOTH));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const setBearingImmediate = (bearing: number) => {
    const b = normalizeDeg(bearing);
    targetBearingRef.current = b;
    stopLoop();
    publishBearing(b);
  };

  const setBearingTarget = (bearing: number) => {
    targetBearingRef.current = normalizeDeg(bearing);
    startLoop();
  };

  // Core rotation plumbing: drag patch, move/zoom re-apply, gestures.
  useEffect(() => {
    const onMoveOrZoom = () => applyMapBearing(map, smoothBearingRef.current);
    map.on('move', onMoveOrZoom);
    map.on('zoom', onMoveOrZoom);
    map.on('zoomend', onMoveOrZoom);
    map.on('popupopen', onMoveOrZoom);

    const onDragStart = () => {
      userDraggingRef.current = true;
    };
    const onDragEnd = () => {
      userDraggingRef.current = false;
    };
    map.on('dragstart', onDragStart);
    map.on('dragend', onDragEnd);

    const unpatchDrag = patchHeadingAwareDrag(map, smoothBearingRef);

    const container = map.getContainer();

    // --- Two-finger rotate (real touch devices) ---
    // Note: Chrome DevTools "mobile view" on a Mac trackpad usually does NOT send
    // multi-touch events — it sends wheel events. See Shift+scroll / gesture handlers below.
    let gestureStartAngle = 0;
    let gestureStartBearing = 0;
    let pinchStartDist = 0;
    let pinchStartZoom = map.getZoom();

    const beginManualRotate = () => {
      onAutoFollowHeadingChange(false);
      rotatingGestureRef.current = true;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      beginManualRotate();
      gestureStartAngle = touchAngle(e.touches[0], e.touches[1]);
      gestureStartBearing = smoothBearingRef.current;
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      pinchStartDist = Math.hypot(dx, dy) || 1;
      pinchStartZoom = map.getZoom();
      if (map.touchZoom.enabled()) map.touchZoom.disable();
      if (map.dragging.enabled()) map.dragging.disable();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!rotatingGestureRef.current || e.touches.length !== 2) return;
      e.preventDefault();
      e.stopPropagation();
      const angle = touchAngle(e.touches[0], e.touches[1]);
      // Invert so the map turns with the fingers (natural feel on real devices).
      const delta = shortestDelta(gestureStartAngle, angle);
      setBearingImmediate(gestureStartBearing - delta);

      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.hypot(dx, dy) || 1;
      const zoomDelta = Math.log2(dist / pinchStartDist);
      const nextZoom = Math.min(
        map.getMaxZoom(),
        Math.max(map.getMinZoom(), pinchStartZoom + zoomDelta),
      );
      if (Math.abs(nextZoom - map.getZoom()) > 0.01) {
        map.setZoom(nextZoom, { animate: false });
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length >= 2) return;
      if (!rotatingGestureRef.current) return;
      rotatingGestureRef.current = false;
      if (!map.dragging.enabled()) map.dragging.enable();
      if (Math.abs(shortestDelta(0, smoothBearingRef.current)) < NORTH_EPS) {
        if (!map.touchZoom.enabled()) map.touchZoom.enable();
      }
    };

    // --- Mac trackpad / desktop: Shift + scroll to rotate ---
    // Two-finger scroll on a Mac trackpad fires wheel events, not TouchEvent.
    const onWheel = (e: WheelEvent) => {
      if (!e.shiftKey && !e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
      beginManualRotate();
      // Prefer horizontal delta (natural for trackpad swipe); fall back to vertical.
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      setBearingImmediate(smoothBearingRef.current + delta * 0.25);
      rotatingGestureRef.current = false;
    };

    // --- Safari / WebKit trackpad rotate gesture ---
    type GestureEventLike = Event & { rotation: number; scale: number };
    let webkitStartBearing = 0;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      beginManualRotate();
      webkitStartBearing = smoothBearingRef.current;
    };
    const onGestureChange = (e: Event) => {
      const ge = e as GestureEventLike;
      e.preventDefault();
      // e.rotation is degrees cumulative for the gesture.
      setBearingImmediate(webkitStartBearing + ge.rotation);
    };
    const onGestureEnd = (e: Event) => {
      e.preventDefault();
      rotatingGestureRef.current = false;
    };

    // --- Desktop: Alt + drag horizontally to rotate ---
    let altDragging = false;
    let altStartX = 0;
    let altStartBearing = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (!e.altKey || e.button !== 0) return;
      altDragging = true;
      altStartX = e.clientX;
      altStartBearing = smoothBearingRef.current;
      e.preventDefault();
      e.stopPropagation();
      map.dragging.disable();
      beginManualRotate();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!altDragging) return;
      e.preventDefault();
      const dx = e.clientX - altStartX;
      setBearingImmediate(altStartBearing - dx * 0.4);
    };

    const onMouseUp = () => {
      if (!altDragging) return;
      altDragging = false;
      rotatingGestureRef.current = false;
      map.dragging.enable();
    };

    const onSetBearingCmd = (e: Event) => {
      const detail = (e as CustomEvent<{ bearing: number; autoFollow?: boolean }>).detail;
      if (!detail || typeof detail.bearing !== 'number') return;
      if (detail.autoFollow === false) onAutoFollowHeadingChange(false);
      if (detail.autoFollow === true) onAutoFollowHeadingChange(true);
      setBearingImmediate(detail.bearing);
    };

    const onRotateStepCmd = (e: Event) => {
      const detail = (e as CustomEvent<{ delta: number }>).detail;
      if (!detail || typeof detail.delta !== 'number') return;
      beginManualRotate();
      setBearingImmediate(smoothBearingRef.current + detail.delta);
      rotatingGestureRef.current = false;
    };

    // Capture phase so we win against Leaflet for two-finger / wheel.
    container.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    container.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    container.addEventListener('touchend', onTouchEnd, true);
    container.addEventListener('touchcancel', onTouchEnd, true);
    container.addEventListener('wheel', onWheel, { capture: true, passive: false });
    container.addEventListener('gesturestart', onGestureStart, { passive: false } as AddEventListenerOptions);
    container.addEventListener('gesturechange', onGestureChange, { passive: false } as AddEventListenerOptions);
    container.addEventListener('gestureend', onGestureEnd, { passive: false } as AddEventListenerOptions);
    container.addEventListener('mousedown', onMouseDown, true);
    container.addEventListener('map:set-bearing', onSetBearingCmd as EventListener);
    container.addEventListener('map:rotate-step', onRotateStepCmd as EventListener);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      map.off('move', onMoveOrZoom);
      map.off('zoom', onMoveOrZoom);
      map.off('zoomend', onMoveOrZoom);
      map.off('popupopen', onMoveOrZoom);
      map.off('dragstart', onDragStart);
      map.off('dragend', onDragEnd);
      unpatchDrag?.();
      container.removeEventListener('touchstart', onTouchStart, true);
      container.removeEventListener('touchmove', onTouchMove, true);
      container.removeEventListener('touchend', onTouchEnd, true);
      container.removeEventListener('touchcancel', onTouchEnd, true);
      container.removeEventListener('wheel', onWheel, true);
      container.removeEventListener('gesturestart', onGestureStart);
      container.removeEventListener('gesturechange', onGestureChange);
      container.removeEventListener('gestureend', onGestureEnd);
      container.removeEventListener('mousedown', onMouseDown, true);
      container.removeEventListener('map:set-bearing', onSetBearingCmd as EventListener);
      container.removeEventListener('map:rotate-step', onRotateStepCmd as EventListener);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      stopLoop();
      clearMapBearing(map);
      if (!map.dragging.enabled()) map.dragging.enable();
      if (!map.touchZoom.enabled()) map.touchZoom.enable();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Enter / leave navigation: street zoom + default heading-up follow.
  useEffect(() => {
    if (!navigating) {
      zoomReadyRef.current = false;
      userAdjustedZoomRef.current = false;
      // Overview is easier north-up after Stop.
      onAutoFollowHeadingChange(true);
      setBearingImmediate(0);
      return;
    }

    userAdjustedZoomRef.current = false;
    onAutoFollowHeadingChange(true);
    if (route && route.points.length >= 2) {
      const initial = bearingDegrees(route.points[0], route.points[1]);
      setBearingImmediate(initial);
    }

    const onZoomEnd = () => {
      // Any zoom that wasn't our initial setView is a user (or gesture) change — keep it.
      if (!programmaticZoomRef.current) {
        userAdjustedZoomRef.current = true;
      }
    };
    map.on('zoomend', onZoomEnd);

    const start = route?.points[0];
    const zoomToNav = () => {
      // Don't yank zoom back if the user already pinched.
      if (userAdjustedZoomRef.current) return;
      map.invalidateSize({ animate: false });
      const p = poseRef.current;
      const lat = p?.lat ?? start?.lat;
      const lon = p?.lon ?? start?.lon;
      if (lat == null || lon == null) return;
      programmaticZoomRef.current = true;
      map.setView([lat, lon], NAV_ZOOM, { animate: false });
      programmaticZoomRef.current = false;
      applyMapBearing(map, smoothBearingRef.current);
      zoomReadyRef.current = true;
    };

    zoomToNav();
    const timers = [80, 200, 450].map((ms) => window.setTimeout(zoomToNav, ms));
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      map.off('zoomend', onZoomEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigating, map, route]);

  // GPS follow while navigating: pan only — never re-force NAV_ZOOM after user pinches out.
  useEffect(() => {
    if (!navigating || !pose) return;

    if (autoFollowRef.current) {
      setBearingTarget(pose.heading);
    }

    if (userDraggingRef.current || rotatingGestureRef.current) return;

    if (!zoomReadyRef.current && !userAdjustedZoomRef.current) {
      programmaticZoomRef.current = true;
      map.setView([pose.lat, pose.lon], NAV_ZOOM, { animate: false });
      programmaticZoomRef.current = false;
      applyMapBearing(map, smoothBearingRef.current);
      zoomReadyRef.current = true;
      return;
    }

    // Keep the user's current zoom level; only follow position.
    map.panTo([pose.lat, pose.lon], { animate: false });
    applyMapBearing(map, smoothBearingRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigating, pose, map, autoFollowHeading]);

  // When auto-follow turns back on, snap target to current GPS/route heading.
  useEffect(() => {
    if (!autoFollowHeading || !navigating) return;
    if (pose) setBearingTarget(pose.heading);
  }, [autoFollowHeading, navigating, pose]);

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
  const [bearing, setBearing] = useState(0);
  const [autoFollowHeading, setAutoFollowHeading] = useState(true);

  useEffect(() => {
    if (selectedIndex == null) return;
    const sample = samples[selectedIndex];
    const marker = markerRefs.current.get(selectedIndex);
    if (!navigating && sample && mapRef.current) {
      mapRef.current.panTo([sample.lat, sample.lon]);
    }
    if (marker) marker.openPopup();
  }, [selectedIndex, samples, navigating]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const headingVar = map.getContainer().style.getPropertyValue('--nav-heading');
    const heading = headingVar ? parseFloat(headingVar) : bearing;
    if (!Number.isFinite(heading) || Math.abs(shortestDelta(0, heading)) < 0.05) return;
    setBillboardUpright(map.getContainer(), heading);
  }, [samples, selectedIndex, pose, bearing]);

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
          (Math.abs(fix.lat - prev.lat) > 1e-5 || Math.abs(fix.lon - prev.lon) > 1e-5);
        if ((heading == null || (fix.speed != null && fix.speed < 1.5)) && moving && prev) {
          heading = bearingDegrees(
            { lat: prev.lat, lon: prev.lon },
            { lat: fix.lat, lon: fix.lon },
          );
        }
        if (heading == null) heading = lastHeadingRef.current;

        const delta = Math.abs(shortestDelta(lastHeadingRef.current, heading));
        if (delta < HEADING_DEADZONE && (fix.speed == null || fix.speed < 1)) {
          heading = lastHeadingRef.current;
        }

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
  const showCompass = Math.abs(shortestDelta(0, bearing)) > NORTH_EPS || (navigating && !autoFollowHeading);

  function handleCompassClick() {
    const map = mapRef.current;
    if (navigating && !autoFollowHeading) {
      // Resume GPS heading-up like Google/Waze recenter.
      setAutoFollowHeading(true);
      if (pose) {
        map?.getContainer().dispatchEvent(
          new CustomEvent('map:set-bearing', {
            detail: { bearing: pose.heading, autoFollow: true },
          }),
        );
      }
      return;
    }
    // Reset to north-up.
    map?.getContainer().dispatchEvent(
      new CustomEvent('map:set-bearing', { detail: { bearing: 0, autoFollow: false } }),
    );
    setBearing(0);
  }

  return (
    <div className="route-map-shell">
      <MapContainer
        center={[55, 22]}
        zoom={5}
        className="route-map"
        scrollWheelZoom
        zoomControl
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
            zIndexOffset={navigating ? 200 : 0}
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
        <MapRotationController
          navigating={navigating}
          pose={pose}
          route={route}
          autoFollowHeading={autoFollowHeading}
          onAutoFollowHeadingChange={setAutoFollowHeading}
          onBearingChange={setBearing}
        />
        <InvalidateOnResize active={!hasRoute || navigating} />
      </MapContainer>

      <div className="map-rotate-controls">
        <button
          type="button"
          className="map-rotate-btn"
          title={t('nav.rotate_left')}
          aria-label={t('nav.rotate_left')}
          onClick={() => {
            mapRef.current?.getContainer().dispatchEvent(
              new CustomEvent('map:rotate-step', { detail: { delta: -15 } }),
            );
          }}
        >
          ↺
        </button>
        {showCompass ? (
          <button
            type="button"
            className="map-compass-fab"
            onClick={handleCompassClick}
            title={
              navigating && !autoFollowHeading
                ? t('nav.resume_heading')
                : t('nav.reset_north')
            }
            aria-label={
              navigating && !autoFollowHeading
                ? t('nav.resume_heading')
                : t('nav.reset_north')
            }
          >
            <span
              className="map-compass-needle"
              style={{ transform: `rotate(${-bearing}deg)` }}
              aria-hidden="true"
            >
              N
            </span>
          </button>
        ) : (
          <button
            type="button"
            className="map-compass-fab map-compass-fab--idle"
            onClick={handleCompassClick}
            title={t('nav.reset_north')}
            aria-label={t('nav.reset_north')}
          >
            <span className="map-compass-needle" aria-hidden="true">
              N
            </span>
          </button>
        )}
        <button
          type="button"
          className="map-rotate-btn"
          title={t('nav.rotate_right')}
          aria-label={t('nav.rotate_right')}
          onClick={() => {
            mapRef.current?.getContainer().dispatchEvent(
              new CustomEvent('map:rotate-step', { detail: { delta: 15 } }),
            );
          }}
        >
          ↻
        </button>
      </div>
    </div>
  );
}
