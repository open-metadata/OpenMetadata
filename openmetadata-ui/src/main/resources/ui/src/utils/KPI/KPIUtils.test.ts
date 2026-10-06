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
import { Kpi, KpiTargetType } from '../../generated/dataInsight/kpi/kpi';
import { buildKpiChartRows, getKpiLatestResults } from './KPIUtils';

const makeKpi = (overrides: Partial<Kpi>): Kpi => ({
  id: 'kpi-id',
  name: 'description-kpi',
  fullyQualifiedName: 'description-kpi',
  description: '',
  dataInsightChart: { id: 'chart-id', type: 'dataInsightCustomChart' },
  metricType: KpiTargetType.Percentage,
  targetValue: 80,
  startDate: 100,
  endDate: 200,
  ...overrides,
});

const kpiResult = {
  kpiFqn: 'description-kpi',
  timestamp: 150,
  targetResult: [{ name: 'fraction', value: '42', targetMet: false }],
};

describe('getKpiLatestResults', () => {
  it('keys each KPI result by FQN with the KPI target, metric type and range', () => {
    expect(
      getKpiLatestResults([
        makeKpi({ displayName: 'Description coverage', kpiResult }),
      ])
    ).toEqual({
      'description-kpi': {
        ...kpiResult,
        target: 80,
        metricType: KpiTargetType.Percentage,
        startDate: 100,
        endDate: 200,
        displayName: 'Description coverage',
      },
    });
  });

  it('leaves out a KPI that has no result yet', () => {
    expect(getKpiLatestResults([makeKpi({ kpiResult: undefined })])).toEqual(
      {}
    );
  });

  it('falls back to the FQN when the KPI has no display name', () => {
    expect(
      getKpiLatestResults([makeKpi({ kpiResult })])['description-kpi']
        .displayName
    ).toBe('description-kpi');
  });
});

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
