import { describe, it, expect } from 'vitest';
import { bearingDegrees, lerpAngle } from './bearing';

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

describe('lerpAngle', () => {
  it('interpolates across the 0° wrap', () => {
    expect(lerpAngle(350, 10, 0.5)).toBeCloseTo(0, 5);
  });

  it('returns from at t=0 and to at t=1', () => {
    expect(lerpAngle(10, 40, 0)).toBeCloseTo(10, 5);
    expect(lerpAngle(10, 40, 1)).toBeCloseTo(40, 5);
  });
});
