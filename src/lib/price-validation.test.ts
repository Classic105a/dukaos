import { describe, it, expect } from 'vitest';
import { priceError, marginInfo } from './price-validation';

describe('price validation', () => {
  it('blocks buying price above selling price', () => {
    expect(priceError(100, 150)).not.toBeNull();
  });
  it('allows buying price equal to or below selling price', () => {
    expect(priceError(100, 100)).toBeNull();
    expect(priceError(100, 80)).toBeNull();
  });
  it('allows missing buying price', () => {
    expect(priceError(100, null)).toBeNull();
  });
  it('computes margin', () => {
    expect(marginInfo(200, 150)).toEqual({ profit: 50, percent: 25 });
  });
});
