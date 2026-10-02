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
import { CHART_PALETTE, getSeriesColor } from './palette';

describe('CHART_PALETTE', () => {
  // AI charts persist the colours they were painted with, so changing an entry
  // (or the order) silently recolours new charts. Pin the exact list.
  it('keeps the 15 series colours in order', () => {
    expect(CHART_PALETTE).toEqual([
      '#1570ef',
      '#7a5af8',
      '#067647',
      '#b54708',
      '#5925dc',
      '#15b79e',
      '#f04438',
      '#ee46bc',
      '#ef6820',
      '#175cd3',
      '#875bf7',
      '#6172f3',
      '#17b26a',
      '#f79009',
      '#cb5a50',
    ]);
  });
});

describe('getSeriesColor', () => {
  it('returns the palette colour at the series index', () => {
    expect(getSeriesColor(0)).toBe('#1570ef');
    expect(getSeriesColor(14)).toBe('#cb5a50');
  });

  it('cycles back to the start past the last colour', () => {
    expect(getSeriesColor(15)).toBe('#1570ef');
    expect(getSeriesColor(31)).toBe('#7a5af8');
  });
});
