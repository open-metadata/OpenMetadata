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

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildBarOption,
  buildComposedOption,
  buildLineOption,
} from './options/cartesian';
import { buildPieOption } from './options/pie';
import { buildChartTheme } from './theme';

// The Collate email renderer builds chart options in Node (echarts SSR), with
// no DOM. These builders must keep working there.
describe('option builders in a Node environment', () => {
  const data = [
    { day: 'Mon', a: 1, b: 2 },
    { day: 'Tue', a: 3, b: 1 },
  ];
  const series = [
    { key: 'a', name: 'A' },
    { key: 'b', name: 'B', type: 'bar' as const },
  ];
  const theme = buildChartTheme();

  it('has no DOM globals available', () => {
    expect(typeof document).toBe('undefined');
    expect(typeof window).toBe('undefined');
  });

  it('builds cartesian and pie options without a DOM', () => {
    const input = { data, xKey: 'day' as const, series, ariaLabel: 'Chart' };

    expect(buildLineOption(input, theme).series).toHaveLength(2);
    expect(buildBarOption(input, theme).series).toHaveLength(2);
    expect(buildComposedOption(input, theme).series).toHaveLength(2);
    expect(
      buildPieOption(
        { data: [{ name: 'A', value: 1 }], ariaLabel: 'Pie' },
        theme
      ).series
    ).toHaveLength(1);
  });
});
