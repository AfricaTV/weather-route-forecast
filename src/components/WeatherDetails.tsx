import type { WeatherSample } from '../types';
import { weatherEmoji } from '../api/weather';
import { compassDirection } from '../lib/compass';
import { useI18n, type TFunction } from '../i18n';

interface Props {
  sample: WeatherSample;
}

function formatDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function positionLabel(t: TFunction, s: WeatherSample): string {
  if (s.position === 'start') return t('sample.start');
  if (s.position === 'finish') return t('sample.finish');
  return t('sample.km', { km: s.distanceKm });
}

function weatherDescription(t: TFunction, code: number): string {
  const key = `weather.code_${code}`;
  const value = t(key);
  return value === key ? t('weather.unknown') : value;
}

export function WeatherDetails({ sample }: Props) {
  const { t } = useI18n();
  return (
    <div className="weather-details">
      <div className="details-header">
        <span className="details-time">{formatDateTime(sample.eta)}</span>
        <span className="details-position">{positionLabel(t, sample)}</span>
      </div>
      <div className="details-main">
        <span className="details-emoji">{weatherEmoji(sample.weatherCode)}</span>
        <div>
          <div className="details-temp">{Math.round(sample.temperatureC)}°C</div>
          <div className="details-desc">{weatherDescription(t, sample.weatherCode)}</div>
        </div>
      </div>
      <dl className="details-grid">
        <dt>{t('details.feels_like')}</dt>
        <dd>{Math.round(sample.apparentTemperatureC)}°C</dd>

        <dt>{t('details.wind')}</dt>
        <dd>
          {Math.round(sample.windSpeedKmh)} km/h{' '}
          {t(`compass.${compassDirection(sample.windDirectionDeg)}`)}
        </dd>

        <dt>{t('details.humidity')}</dt>
        <dd>{Math.round(sample.humidity)}%</dd>

        <dt>{t('details.cloud_cover')}</dt>
        <dd>{Math.round(sample.cloudCover)}%</dd>

        {sample.precipitationMm > 0 && (
          <>
            <dt>{t('details.precipitation')}</dt>
            <dd>{sample.precipitationMm.toFixed(1)} mm</dd>
          </>
        )}

        <dt>{t('details.coords')}</dt>
        <dd>
          {sample.lat.toFixed(4)}, {sample.lon.toFixed(4)}
        </dd>
      </dl>
    </div>
  );
}
