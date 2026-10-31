import { useCallback, useState } from 'react';
import { RouteForm, type RouteFormValues } from './components/RouteForm';
import { RouteMap } from './components/RouteMap';
import { WeatherTimeline } from './components/WeatherTimeline';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { geocode } from './api/geocoding';
import { getRoute } from './api/routing';
import { getWeatherAtPoints } from './api/weather';
import { sampleRouteByTime } from './lib/sampleRoute';
import { getCurrentPlace } from './lib/geolocation';
import { useI18n, I18nError, type TFunction } from './i18n';
import type { Place, Route, Waypoint, WeatherSample } from './types';
import './App.css';

function formatDuration(t: TFunction, sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0
    ? t('route_info.duration_h_m', { h, m })
    : t('route_info.duration_m', { m });
}

async function resolveWaypoint(wp: Waypoint, isFirst: boolean): Promise<Place> {
  if (wp.place) return wp.place;
  if (wp.query) return geocode(wp.query);
  if (isFirst) return getCurrentPlace();
  throw new I18nError('errors.waypoint_empty');
}

function App() {
  const { t } = useI18n();
  const [route, setRoute] = useState<Route | null>(null);
  const [samples, setSamples] = useState<WeatherSample[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedPlaces, setResolvedPlaces] = useState<Place[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [navError, setNavError] = useState<string | null>(null);

  function stopNavigation() {
    setNavigating(false);
    setNavError(null);
  }

  function startNavigation() {
    setNavError(null);
    setSelectedIndex(null);
    setSidebarCollapsed(true);
    setNavigating(true);
  }

  const handleNavigationError = useCallback((msg: string) => {
    setNavError(msg);
  }, []);

  async function handleSubmit(values: RouteFormValues) {
    setLoading(true);
    setError(null);
    setNavError(null);
    setSamples([]);
    setRoute(null);
    setResolvedPlaces([]);
    setSelectedIndex(null);
    setNavigating(false);
    try {
      const places = await Promise.all(
        values.waypoints.map((wp, i) => resolveWaypoint(wp, i === 0)),
      );
      const r = await getRoute(places);
      setRoute(r);
      setResolvedPlaces(places);

      const queries = sampleRouteByTime(r, values.departure);
      const lastEta = queries[queries.length - 1].eta;
      const daysAhead = (lastEta.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysAhead > 16) {
        setError(t('app.error_too_far'));
        return;
      }
      const weather = await getWeatherAtPoints(queries);
      setSamples(weather);
    } catch (e) {
      if (e instanceof I18nError) {
        setError(t(e.key, e.params));
      } else {
        setError(e instanceof Error ? e.message : t('app.error_generic'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`app${sidebarCollapsed ? ' sidebar-collapsed' : ''}${navigating ? ' navigating' : ''}`}>
      <aside className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
        {sidebarCollapsed ? (
          <button
            type="button"
            className="sidebar-expand"
            onClick={() => setSidebarCollapsed(false)}
            aria-label={t('app.expand_sidebar')}
            title={t('app.expand_sidebar')}
          >
            <span className="chevron chevron-h" aria-hidden="true">»</span>
            <span className="chevron chevron-v" aria-hidden="true">▼</span>
          </button>
        ) : (
          <>
            <div className="sidebar-header">
              <h1>{t('app.title')}</h1>
              <div className="sidebar-header-actions">
                <LanguageSwitcher />
                <button
                  type="button"
                  className="sidebar-toggle"
                  onClick={() => setSidebarCollapsed(true)}
                  aria-label={t('app.collapse_sidebar')}
                  title={t('app.collapse_sidebar')}
                >
                  <span className="chevron chevron-h" aria-hidden="true">«</span>
                  <span className="chevron chevron-v" aria-hidden="true">▲</span>
                </button>
              </div>
            </div>
            <RouteForm onSubmit={handleSubmit} loading={loading} />
            {error && <div className="error">{error}</div>}
            {navError && <div className="error">{navError}</div>}
            {route && resolvedPlaces.length > 0 && (
              <div className="route-info">
                <ol className="route-points">
                  {resolvedPlaces.map((p, i) => (
                    <li key={i}>{p.displayName}</li>
                  ))}
                </ol>
                <div>
                  <strong>{t('route_info.distance')}</strong>{' '}
                  {t('route_info.distance_km', { km: (route.totalDistanceM / 1000).toFixed(0) })}
                </div>
                <div>
                  <strong>{t('route_info.duration')}</strong>{' '}
                  {formatDuration(t, route.totalDurationSec)}
                </div>
                {navigating ? (
                  <button type="button" className="nav-stop-btn" onClick={stopNavigation}>
                    {t('nav.stop')}
                  </button>
                ) : (
                  <button type="button" className="nav-start-btn" onClick={startNavigation}>
                    {t('nav.start')}
                  </button>
                )}
              </div>
            )}
            <WeatherTimeline
              samples={samples}
              selectedIndex={selectedIndex}
              onSelect={navigating ? () => {} : setSelectedIndex}
            />
          </>
        )}
      </aside>
      <main className="map-pane">
        {navigating && (
          <button type="button" className="nav-stop-fab" onClick={stopNavigation}>
            {t('nav.stop')}
          </button>
        )}
        <RouteMap
          route={route}
          samples={samples}
          selectedIndex={navigating ? null : selectedIndex}
          onSelect={navigating ? () => {} : setSelectedIndex}
          navigating={navigating}
          onNavigationError={handleNavigationError}
        />
      </main>
    </div>
  );
}

export default App;
