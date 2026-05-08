import { describe, it, expect } from 'vitest';
import { sampleRouteByTime } from './sampleRoute';
import type { Route } from '../types';

function makeLinearRoute(totalHours: number, totalKm: number, numPoints = 100): Route {
  const totalSec = totalHours * 3600;
  const totalM = totalKm * 1000;
  const points = Array.from({ length: numPoints }, (_, i) => {
    const t = i / (numPoints - 1);
    return {
      lat: 50 + t * 5,
      lon: 20 + t * 5,
      cumulativeDurationSec: t * totalSec,
      cumulativeDistanceM: t * totalM,
    };
  });
  return { points, totalDurationSec: totalSec, totalDistanceM: totalM };
}

describe('sampleRouteByTime', () => {
  const departure = new Date('2026-05-08T12:00:00Z');

  it('первая точка start, последняя finish', () => {
    const route = makeLinearRoute(5, 500);
    const samples = sampleRouteByTime(route, departure);
    expect(samples[0].position).toBe('start');
    expect(samples[samples.length - 1].position).toBe('finish');
    samples.slice(1, -1).forEach((s) => expect(s.position).toBe('middle'));
  });

  it('ETA первой точки совпадает с временем выезда', () => {
    const route = makeLinearRoute(3, 300);
    const samples = sampleRouteByTime(route, departure);
    expect(samples[0].eta.getTime()).toBe(departure.getTime());
  });

  it('ETA последней точки = выезд + длительность маршрута', () => {
    const route = makeLinearRoute(4, 400);
    const samples = sampleRouteByTime(route, departure);
    const expectedFinish = departure.getTime() + 4 * 3600 * 1000;
    expect(samples[samples.length - 1].eta.getTime()).toBe(expectedFinish);
  });

  it('минимум 3 точки даже для коротких маршрутов', () => {
    const route = makeLinearRoute(0.5, 30);
    const samples = sampleRouteByTime(route, departure);
    expect(samples.length).toBeGreaterThanOrEqual(3);
  });

  it('максимум 12 точек даже для очень длинных маршрутов', () => {
    const route = makeLinearRoute(50, 5000);
    const samples = sampleRouteByTime(route, departure);
    expect(samples.length).toBeLessThanOrEqual(12);
  });

  it('ETA монотонно возрастает', () => {
    const route = makeLinearRoute(8, 800);
    const samples = sampleRouteByTime(route, departure);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i].eta.getTime()).toBeGreaterThan(samples[i - 1].eta.getTime());
    }
  });

  it('distanceKm возрастает от 0 до полной дистанции', () => {
    const route = makeLinearRoute(5, 500);
    const samples = sampleRouteByTime(route, departure);
    expect(samples[0].distanceKm).toBe(0);
    expect(samples[samples.length - 1].distanceKm).toBe(500);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i].distanceKm).toBeGreaterThanOrEqual(samples[i - 1].distanceKm);
    }
  });
});
