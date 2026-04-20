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
import { ExplorePageTabs } from '../enums/Explore.enum';
import { MOCK_CHART_DATA } from '../mocks/Chart.mock';
import { MOCK_TABLE, MOCK_TIER_DATA } from '../mocks/TableData.mock';
import { getEntityOverview } from './DataAssetSummaryPanelUtils';
import { getTierTags } from './TableUtils';

jest.mock('./TableUtils', () => ({
  getTierTags: jest.fn(),
  getUsagePercentile: jest.fn().mockImplementation((value) => value + 'th'),
}));

jest.mock('./CommonUtils', () => ({
  getPartialNameFromTableFQN: jest.fn().mockImplementation((value) => value),
  getTableFQNFromColumnFQN: jest.fn().mockImplementation((value) => value),
  formatNumberWithComma: jest.fn().mockImplementation((value) => value),
}));

describe('getEntityOverview', () => {
  it('should call getChartOverview and get ChartData if ExplorePageTabs is charts', () => {
    const result = JSON.stringify(
      getEntityOverview(ExplorePageTabs.CHARTS, {
        ...MOCK_CHART_DATA,
        dataProducts: [],
      })
    );

    expect(result).toContain('label.owner-plural');
    expect(result).toContain('label.chart');
    expect(result).toContain('label.url-uppercase');
    expect(result).toContain('Are you an ethnic minority in your city?');
    expect(result).toContain(
      `http://localhost:8088/superset/explore/?form_data=%7B%22slice_id%22%3A%20127%7D`
    );
    expect(result).toContain('label.service');
    expect(result).toContain('sample_superset');
    expect(result).toContain('Other');
    expect(result).toContain('label.service-type');
    expect(result).toContain('Superset');
  });

  it('should call getChartOverview and get TableData if ExplorePageTabs is table', () => {
    const result = JSON.stringify(
      getEntityOverview(ExplorePageTabs.TABLES, {
        ...MOCK_TABLE,
        tags: [MOCK_TIER_DATA],
        dataProducts: [],
      })
    );

    expect(result).toContain('label.owner-plural');
    expect(result).toContain('label.type');
    expect(result).toContain('label.service');
    expect(result).toContain('label.database');
    expect(result).toContain('label.schema');
    expect(result).toContain('label.tier');
    expect(result).toContain('label.usage');
    expect(result).toContain('label.query-plural');
    expect(result).toContain('label.column-plural');
    expect(result).toContain('label.row-plural');
    expect(getTierTags).toHaveBeenCalledWith([MOCK_TIER_DATA]);
    expect(result).toContain('Regular');
    expect(result).toContain('sample_data');
    expect(result).toContain('ecommerce_db');
    expect(result).toContain('shopify');
    expect(result).toContain('0th');
    expect(result).toContain('4');
    expect(result).toContain('14567');
  });
});
