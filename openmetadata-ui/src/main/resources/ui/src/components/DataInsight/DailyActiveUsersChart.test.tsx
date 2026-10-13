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
import { LineChart } from '@openmetadata/ui-core-components/charts';
import { act, render } from '@testing-library/react';
import { ChartFilter } from '../../interface/data-insight.interface';
import DailyActiveUsersChart from './DailyActiveUsersChart';

jest.mock('../../rest/DataInsightAPI', () => ({
  getAggregateChartData: jest.fn().mockResolvedValue({
    data: [{ timestamp: 1696118400000, activeUsers: 4 }],
  }),
}));

const filter = { startTs: 1, endTs: 2 } as ChartFilter;

const lastLineProps = () =>
  (LineChart as unknown as jest.Mock).mock.calls.at(-1)[0];

describe('DailyActiveUsersChart', () => {
  it('draws the active users line with no legend', async () => {
    await act(async () => {
      render(<DailyActiveUsersChart chartFilter={filter} selectedDays={7} />);
    });

    expect(lastLineProps()).toEqual(
      expect.objectContaining({
        xKey: 'timestamp',
        series: [expect.objectContaining({ key: 'activeUsers' })],
        legend: { show: false },
      })
    );
  });
});
