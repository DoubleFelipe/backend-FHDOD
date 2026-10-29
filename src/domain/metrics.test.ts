import { describe, expect, it } from 'vitest';
import { average, calculateNps, satisfaction, shiftFor } from './metrics.js';

describe('survey metrics', () => {
  it('calculates NPS from promoters, passives, and detractors', () => {
    expect(calculateNps([10, 9, 7, 6])).toBe(25);
    expect(calculateNps([])).toBeNull();
  });
  it('calculates average and satisfaction', () => {
    expect(average([1, 3, 5])).toBe(3);
    expect(satisfaction([1, 4, 5])).toBeCloseTo(200 / 3);
    expect(average([])).toBeNull();
  });
  it('assigns shifts by Sao Paulo local time', () => {
    expect(shiftFor(new Date('2026-10-29T10:00:00Z'))).toBe('morning');
    expect(shiftFor(new Date('2026-10-29T15:00:00Z'))).toBe('afternoon');
    expect(shiftFor(new Date('2026-10-29T23:00:00Z'))).toBe('night');
  });
});
