import { describe, it, expect } from 'vitest';
import { bearingDegrees } from './bearing';

describe('bearingDegrees', () => {
  it('returns ~0 for due north', () => {
    expect(bearingDegrees({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(0, 0);
  });

  it('returns ~90 for due east', () => {
    expect(bearingDegrees({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(90, 0);
  });

  it('returns ~180 for due south', () => {
    expect(bearingDegrees({ lat: 1, lon: 0 }, { lat: 0, lon: 0 })).toBeCloseTo(180, 0);
  });

  it('returns ~270 for due west', () => {
    expect(bearingDegrees({ lat: 0, lon: 1 }, { lat: 0, lon: 0 })).toBeCloseTo(270, 0);
  });
});
