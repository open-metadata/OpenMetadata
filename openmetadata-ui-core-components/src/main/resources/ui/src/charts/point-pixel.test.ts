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

import { describe, expect, it, vi } from 'vitest';
import { pointPixel } from './point-pixel';

describe('pointPixel', () => {
  it('asks ECharts for the point centre on a time axis', () => {
    const chart = { convertToPixel: vi.fn(() => [120, 40]) };

    expect(pointPixel(chart, { ts: 1000, v: 5 }, 'ts', 'v', true)).toEqual({
      x: 120,
      y: 40,
    });
    expect(chart.convertToPixel).toHaveBeenCalledWith(
      { seriesId: 'v' },
      [1000, 5]
    );
  });

  it('uses the category name on a category axis', () => {
    const chart = { convertToPixel: vi.fn(() => [10, 20]) };
    pointPixel(chart, { day: 'Mon', v: 5 }, 'day', 'v', false);

    expect(chart.convertToPixel).toHaveBeenCalledWith({ seriesId: 'v' }, [
      'Mon',
      5,
    ]);
  });

  it('returns undefined for a point without a value or a position', () => {
    const chart = { convertToPixel: vi.fn(() => [Number.NaN, 3]) };

    expect(
      pointPixel(chart, { day: 'Mon', v: null }, 'day', 'v', false)
    ).toBeUndefined();
    expect(
      pointPixel(chart, { day: 'Mon', v: 2 }, 'day', 'v', false)
    ).toBeUndefined();
  });
});
