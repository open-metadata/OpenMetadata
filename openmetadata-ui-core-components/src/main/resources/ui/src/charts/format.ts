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

const TICK_SIGNIFICANT_DIGITS = 2;
const MAX_TICK_DECIMALS = 6;
const TOOLTIP_DECIMALS = 2;

const withSuffix = (value: number, divisor: number, suffix: string): string =>
  `${(value / divisor).toFixed(1).replace(/\.0$/, '')}${suffix}`;

/**
 * Value-axis tick label: K/M/B suffix from 1000 up, bounded precision below.
 * Below 1 the leading zeros are not significant, so the decimals shift to keep
 * two real digits — a 0.0017 axis must not collapse to a column of "0".
 */
export const formatYAxisTick = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return withSuffix(value, 1_000_000_000, 'B');
  }
  if (abs >= 1_000_000) {
    return withSuffix(value, 1_000_000, 'M');
  }
  if (abs >= 1_000) {
    return withSuffix(value, 1_000, 'K');
  }
  if (Number.isInteger(value) || !Number.isFinite(value)) {
    return String(value);
  }
  const magnitude = Math.floor(Math.log10(abs));
  const decimals =
    magnitude >= 0
      ? TICK_SIGNIFICANT_DIGITS
      : Math.min(MAX_TICK_DECIMALS, TICK_SIGNIFICANT_DIGITS - 1 - magnitude);

  return String(Number.parseFloat(value.toFixed(decimals)));
};

/** Default tooltip value: non-integers rounded to 2 decimals, missing → ''. */
export const formatTooltipValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number' && !Number.isInteger(value)) {
    return String(Number.parseFloat(value.toFixed(TOOLTIP_DECIMALS)));
  }

  return String(value);
};
