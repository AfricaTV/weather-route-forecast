import { describe, it, expect } from 'vitest';
import { compassDirection } from './compass';

describe('compassDirection', () => {
  it('возвращает N для 0°', () => {
    expect(compassDirection(0)).toBe('N');
  });

  it('возвращает кардинальные направления', () => {
    expect(compassDirection(90)).toBe('E');
    expect(compassDirection(180)).toBe('S');
    expect(compassDirection(270)).toBe('W');
  });

  it('возвращает диагональные направления', () => {
    expect(compassDirection(45)).toBe('NE');
    expect(compassDirection(135)).toBe('SE');
    expect(compassDirection(225)).toBe('SW');
    expect(compassDirection(315)).toBe('NW');
  });

  it('360° сворачивается в N', () => {
    expect(compassDirection(360)).toBe('N');
  });

  it('значения больше 360° нормализуются', () => {
    expect(compassDirection(720)).toBe('N');
    expect(compassDirection(450)).toBe('E');
  });

  it('отрицательные значения нормализуются', () => {
    expect(compassDirection(-90)).toBe('W');
    expect(compassDirection(-45)).toBe('NW');
  });

  it('округляет к ближайшему сектору 45°', () => {
    expect(compassDirection(22)).toBe('N');
    expect(compassDirection(23)).toBe('NE');
    expect(compassDirection(67)).toBe('NE');
    expect(compassDirection(68)).toBe('E');
  });
});
