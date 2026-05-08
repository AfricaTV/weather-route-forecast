import { useEffect, useRef } from 'react';
import type { WeatherSample } from '../types';
import { weatherEmoji } from '../api/weather';
import { useI18n, type TFunction } from '../i18n';

interface Props {
  samples: WeatherSample[];
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
}

function formatTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
}

function positionLabel(t: TFunction, sample: WeatherSample): string {
  if (sample.position === 'start') return t('sample.start');
  if (sample.position === 'finish') return t('sample.finish');
  return t('sample.km', { km: sample.distanceKm });
}

function weatherDescription(t: TFunction, code: number): string {
  const key = `weather.code_${code}`;
  const value = t(key);
  return value === key ? t('weather.unknown') : value;
}

export function WeatherTimeline({ samples, selectedIndex, onSelect }: Props) {
  const { t } = useI18n();
  const itemRefs = useRef<Map<number, HTMLLIElement>>(new Map());

  useEffect(() => {
    if (selectedIndex == null) return;
    const el = itemRefs.current.get(selectedIndex);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedIndex]);

  if (samples.length === 0) return null;

  return (
    <div className="weather-timeline">
      <h3>{t('timeline.title')}</h3>
      <ul>
        {samples.map((s, i) => (
          <li
            key={i}
            ref={(el) => {
              if (el) itemRefs.current.set(i, el);
              else itemRefs.current.delete(i);
            }}
            className={i === selectedIndex ? 'selected' : ''}
            onClick={() => onSelect(i === selectedIndex ? null : i)}
          >
            <div className="row-time">
              <span className="time">{formatTime(s.eta)}</span>
              <span className="label">{positionLabel(t, s)}</span>
            </div>
            <div className="row-weather">
              <span className="emoji">{weatherEmoji(s.weatherCode)}</span>
              <span className="temp">{Math.round(s.temperatureC)}°C</span>
              <span className="desc">{weatherDescription(t, s.weatherCode)}</span>
            </div>
            <div className="row-meta">
              <span>💨 {Math.round(s.windSpeedKmh)} km/h</span>
              {s.precipitationMm > 0 && <span>💧 {s.precipitationMm.toFixed(1)} mm</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
