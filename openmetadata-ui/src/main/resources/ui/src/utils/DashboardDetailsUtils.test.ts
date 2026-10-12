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
import { getChartById } from '../rest/chartAPI';
import { BULK_ACTION_CONCURRENCY } from './AsyncUtils';
import { fetchCharts } from './DashboardDetailsUtils';

jest.mock('../rest/chartAPI', () => ({
  getChartById: jest.fn(),
}));

const chartRefs = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `chart-${index}`,
    type: 'chart',
  }));

describe('fetchCharts', () => {
  it('leaves out a chart that fails to load and keeps the order of the rest', async () => {
    (getChartById as jest.Mock).mockImplementation(async (id: string) => {
      if (id === 'chart-1') {
        throw new Error('not found');
      }

      return { id };
    });

    await expect(fetchCharts(chartRefs(3))).resolves.toEqual([
      { id: 'chart-0' },
      { id: 'chart-2' },
    ]);
  });

  it('keeps at most BULK_ACTION_CONCURRENCY chart requests in flight', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    (getChartById as jest.Mock).mockImplementation(async (id: string) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;

      return { id };
    });

    await expect(fetchCharts(chartRefs(20))).resolves.toHaveLength(20);
    expect(maxInFlight).toBe(BULK_ACTION_CONCURRENCY);
  });
});
