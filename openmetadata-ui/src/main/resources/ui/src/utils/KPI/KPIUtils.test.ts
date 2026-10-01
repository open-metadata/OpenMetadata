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
import { buildKpiChartRows } from './KPIUtils';

describe('buildKpiChartRows', () => {
  it('merges KPIs by day, sorted numerically, gaps as null', () => {
    expect(
      buildKpiChartRows({
        a: [
          { day: 900, count: 1 },
          { day: 1000, count: 2 },
        ],
        b: [{ day: 1000, count: 5 }],
      })
    ).toEqual([
      { day: 900, a: 1, b: null },
      { day: 1000, a: 2, b: 5 },
    ]);
  });

  it('keeps a real zero', () => {
    expect(buildKpiChartRows({ a: [{ day: 1, count: 0 }] })).toEqual([
      { day: 1, a: 0 },
    ]);
  });

  it('returns no rows for no results', () => {
    expect(buildKpiChartRows({})).toEqual([]);
  });
});
