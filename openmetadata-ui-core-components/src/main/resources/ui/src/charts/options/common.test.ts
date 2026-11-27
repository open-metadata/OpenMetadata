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
import { areaGradient, withAlpha } from './common';

describe('withAlpha', () => {
  it.each([
    ['#1570ef', 0.2, 'rgba(21, 112, 239, 0.2)'],
    ['#fff', 0.5, 'rgba(255, 255, 255, 0.5)'],
    ['rgb(21, 112, 239)', 0.2, 'rgba(21, 112, 239, 0.2)'],
    ['rgba(21, 112, 239, 0.5)', 0.2, 'rgba(21, 112, 239, 0.1)'],
    ['rgb(21 112 239 / 50%)', 0.2, 'rgba(21, 112, 239, 0.1)'],
  ])('%s at %s → %s', (color, alpha, expected) => {
    expect(withAlpha(color, alpha)).toBe(expected);
  });

  it('returns a colour it cannot parse unchanged', () => {
    expect(withAlpha('tomato', 0.2)).toBe('tomato');
  });
});

describe('areaGradient', () => {
  it('fades an rgba series colour instead of mis-reading it as hex', () => {
    expect(areaGradient('rgba(0, 0, 255, 1)').colorStops).toEqual([
      { offset: 0, color: 'rgba(0, 0, 255, 0.2)' },
      { offset: 1, color: 'rgba(0, 0, 255, 0)' },
    ]);
  });
});
