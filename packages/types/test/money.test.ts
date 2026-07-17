import { describe, expect, it } from 'vitest';
import { Money, addNumberPrecision, roundHalfAwayFromZero } from '../src/money.js';

describe('Money', () => {
  it('parses decimal strings without float drift', () => {
    expect(Money.fromDecimal('12.34').minor).toBe(123400);
    expect(Money.fromDecimal('0.1').minor).toBe(1000);
    expect(Money.fromDecimal('-5.005').minor).toBe(-50050);
    expect(Money.fromDecimal('1.00005').minor).toBe(10001);
    expect(Money.fromDecimal('1.00004').minor).toBe(10000);
    expect(Money.fromDecimal('').minor).toBe(0);
    expect(Money.fromDecimal(null).minor).toBe(0);
  });

  it('round-trips the NUMERIC(19,4) storage format', () => {
    expect(Money.fromDecimal('12.34').toDbString()).toBe('12.3400');
    expect(Money.fromDecimal('-0.5').toDbString()).toBe('-0.5000');
    expect(Money.fromDb('99.9999').toDbString()).toBe('99.9999');
  });

  it('does integer arithmetic', () => {
    const a = Money.fromDecimal('10.00');
    const b = Money.fromDecimal('0.10');
    let total = Money.ZERO;
    for (let i = 0; i < 3; i++) total = total.add(b);
    expect(total.toDbString()).toBe('0.3000');
    expect(a.sub(b).toDbString()).toBe('9.9000');
    expect(b.times(3).toDbString()).toBe('0.3000');
  });

  it('rounds half away from zero like PHP', () => {
    expect(roundHalfAwayFromZero(0.5)).toBe(1);
    expect(roundHalfAwayFromZero(-0.5)).toBe(-1);
    expect(roundHalfAwayFromZero(2.5)).toBe(3);
    expect(roundHalfAwayFromZero(1.005, 2)).toBe(1.01);
    expect(Money.fromMinor(50).round(2).minor).toBe(100);
    expect(Money.fromMinor(-50).round(2).minor).toBe(-100);
  });

  it('formats at display precision', () => {
    expect(Money.fromDecimal('1.005').toFixed(2)).toBe('1.01');
    expect(Money.fromDecimal('1.2').toFixed(2)).toBe('1.20');
    expect(Money.fromDecimal('-1.005').toFixed(2)).toBe('-1.01');
    expect(Money.fromDecimal('7').toFixed(0)).toBe('7');
  });

  it('supports WC precision helpers', () => {
    expect(addNumberPrecision(1.23, 2)).toBe(123);
    expect(addNumberPrecision(0.1 + 0.2, 2)).toBe(30);
  });
});
