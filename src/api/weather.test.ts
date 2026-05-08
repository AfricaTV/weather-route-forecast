import { describe, it, expect } from 'vitest';
import { weatherEmoji } from './weather';

describe('weatherEmoji', () => {
  it('известные коды WMO имеют свои эмодзи', () => {
    expect(weatherEmoji(0)).toBe('☀️');
    expect(weatherEmoji(3)).toBe('☁️');
    expect(weatherEmoji(63)).toBe('🌧️');
    expect(weatherEmoji(73)).toBe('🌨️');
    expect(weatherEmoji(95)).toBe('⛈️');
  });

  it('неизвестный код возвращает знак вопроса', () => {
    expect(weatherEmoji(999)).toBe('❔');
    expect(weatherEmoji(-1)).toBe('❔');
  });
});
