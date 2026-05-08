import { useState, type FormEvent } from 'react';
import { PlaceAutocomplete } from './PlaceAutocomplete';
import { getCurrentPlace } from '../lib/geolocation';
import { useI18n, I18nError, type TFunction } from '../i18n';
import type { Place, Waypoint } from '../types';

export interface RouteFormValues {
  waypoints: Waypoint[];
  departure: Date;
}

interface Props {
  onSubmit: (values: RouteFormValues) => void;
  loading: boolean;
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY_WAYPOINT: Waypoint = { query: '', place: null };

function waypointLabel(t: TFunction, index: number, total: number): string {
  if (index === 0) return t('form.label_from');
  if (index === total - 1) return t('form.label_to');
  return t('form.label_via', { n: index });
}

export function RouteForm({ onSubmit, loading }: Props) {
  const { t } = useI18n();
  const [waypoints, setWaypoints] = useState<Waypoint[]>([
    { query: '', place: null },
    { query: 'Krakow', place: null },
  ]);
  const [departure, setDeparture] = useState(toLocalInputValue(new Date()));
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  function updateWaypoint(index: number, query: string, place: Place | null) {
    setWaypoints((prev) =>
      prev.map((wp, i) => (i === index ? { query, place } : wp)),
    );
  }

  function addStop() {
    setWaypoints((prev) => {
      const insertAt = prev.length - 1;
      return [...prev.slice(0, insertAt), { ...EMPTY_WAYPOINT }, ...prev.slice(insertAt)];
    });
  }

  function removeStop(index: number) {
    setWaypoints((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleUseMyLocation() {
    setLocating(true);
    setLocationError(null);
    try {
      const place = await getCurrentPlace();
      updateWaypoint(0, place.displayName, place);
    } catch (e) {
      if (e instanceof I18nError) {
        setLocationError(t(e.key, e.params));
      } else {
        setLocationError(e instanceof Error ? e.message : t('app.error_generic'));
      }
    } finally {
      setLocating(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const last = waypoints[waypoints.length - 1];
    if (!last.query.trim() && !last.place) return;
    onSubmit({
      waypoints: waypoints.map((wp) => ({
        query: wp.query.trim(),
        place: wp.place,
      })),
      departure: new Date(departure),
    });
  }

  return (
    <form className="route-form" onSubmit={handleSubmit}>
      {waypoints.map((wp, i) => {
        const isFirst = i === 0;
        const isLast = i === waypoints.length - 1;
        const isIntermediate = !isFirst && !isLast;
        const placeholder = isFirst
          ? t('form.placeholder_from')
          : isLast
            ? t('form.placeholder_to')
            : t('form.placeholder_via');
        return (
          <div key={i} className="waypoint-row">
            <PlaceAutocomplete
              label={waypointLabel(t, i, waypoints.length)}
              value={wp.query}
              placeholder={placeholder}
              required={isLast}
              onValueChange={(v, place) => updateWaypoint(i, v, place)}
            />
            {isIntermediate && (
              <button
                type="button"
                className="remove-btn"
                onClick={() => removeStop(i)}
                title={t('form.remove_stop')}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      <div className="form-actions">
        <button
          type="button"
          className="location-btn"
          onClick={handleUseMyLocation}
          disabled={locating || loading}
        >
          {locating ? t('form.locating') : t('form.my_location')}
        </button>
        <button type="button" className="add-stop-btn" onClick={addStop}>
          {t('form.add_stop')}
        </button>
      </div>
      {locationError && <div className="location-error">{locationError}</div>}
      <label>
        {t('form.time_label')}
        <input
          type="datetime-local"
          value={departure}
          onChange={(e) => setDeparture(e.target.value)}
          required
        />
      </label>
      <button type="submit" disabled={loading}>
        {loading ? t('form.building') : t('form.build_route')}
      </button>
    </form>
  );
}
