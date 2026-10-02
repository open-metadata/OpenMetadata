/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { describe, expect, it } from 'vitest';
import { formatTooltipValue, formatYAxisTick } from './format';

describe('formatYAxisTick', () => {
  it('adds magnitude suffixes from 1000 up', () => {
    expect(formatYAxisTick(0)).toBe('0');
    expect(formatYAxisTick(42)).toBe('42');
    expect(formatYAxisTick(1756)).toBe('1.8K');
    expect(formatYAxisTick(2_500_000)).toBe('2.5M');
    expect(formatYAxisTick(3_000_000_000)).toBe('3B');
    expect(formatYAxisTick(-1756)).toBe('-1.8K');
  });

  it('never prints a raw float endpoint', () => {
    expect(formatYAxisTick(0.8064516129032258)).toBe('0.81');
    expect(formatYAxisTick(12.345678901)).toBe('12.35');
  });

  it('keeps significant digits for values far below 1', () => {
    expect(formatYAxisTick(0.0017084282460136675)).toBe('0.0017');
    expect(formatYAxisTick(0.000123456)).toBe('0.00012');
  });

  it('leaves already-clean ticks untouched', () => {
    expect(formatYAxisTick(0.25)).toBe('0.25');
    expect(formatYAxisTick(-2.5)).toBe('-2.5');
  });
});

describe('formatTooltipValue', () => {
  it('rounds non-integers to at most 2 decimals', () => {
    expect(formatTooltipValue(1.23456)).toBe('1.23');
    expect(formatTooltipValue(1.5)).toBe('1.5');
  });

  it('prints integers and strings as they are', () => {
    expect(formatTooltipValue(5)).toBe('5');
    expect(formatTooltipValue('Passed')).toBe('Passed');
  });

  it('prints nothing for missing values', () => {
    expect(formatTooltipValue(null)).toBe('');
    expect(formatTooltipValue(undefined)).toBe('');
  });
});
