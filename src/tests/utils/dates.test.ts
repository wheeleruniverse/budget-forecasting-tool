import {
  addDays,
  addMonths,
  daysInMonth,
  diffDays,
  fileTimestamp,
  formatDisplayDate,
  isValidDate,
} from '@/utils/dates';
import { describe, expect, it } from 'vitest';

describe('addDays', () => {
  it('adds within a month', () => {
    expect(addDays('2026-07-10', 5)).toBe('2026-07-15');
  });

  it('rolls over month and year boundaries', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('subtracts with negative values', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('handles leap years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('addMonths', () => {
  it('keeps the day when possible', () => {
    expect(addMonths('2026-07-15', 1)).toBe('2026-08-15');
  });

  it('clamps to shorter months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  });

  it('uses an explicit dayOfMonth', () => {
    expect(addMonths('2026-07-01', 1, 15)).toBe('2026-08-15');
  });

  it('supports last day of month', () => {
    expect(addMonths('2026-01-31', 1, 'last')).toBe('2026-02-28');
    expect(addMonths('2026-03-01', 1, 'last')).toBe('2026-04-30');
  });

  it('crosses year boundaries', () => {
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
  });
});

describe('daysInMonth', () => {
  it('knows leap February', () => {
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
  });
});

describe('diffDays', () => {
  it('is positive when b is later', () => {
    expect(diffDays('2026-07-01', '2026-07-11')).toBe(10);
    expect(diffDays('2026-07-11', '2026-07-01')).toBe(-10);
  });
});

describe('isValidDate', () => {
  it('accepts real dates and rejects malformed ones', () => {
    expect(isValidDate('2026-07-11')).toBe(true);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('2026-13-01')).toBe(false);
    expect(isValidDate('07/11/2026')).toBe(false);
  });
});

describe('formatDisplayDate', () => {
  it('formats without timezone drift', () => {
    expect(formatDisplayDate('2026-07-11')).toBe('Sat, Jul 11, 2026');
  });
});

describe('fileTimestamp', () => {
  it('produces a sortable YYYYMMDD-HHMMSS stamp', () => {
    expect(fileTimestamp()).toMatch(/^\d{8}-\d{6}$/);
  });
});
