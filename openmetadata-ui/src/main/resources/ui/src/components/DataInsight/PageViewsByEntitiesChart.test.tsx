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
import {
  ChartSeries,
  LineChart,
} from '@openmetadata/ui-core-components/charts';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ChartFilter } from '../../interface/data-insight.interface';
import PageViewsByEntitiesChart from './PageViewsByEntitiesChart';

jest.mock('../../rest/DataInsightAPI', () => ({
  getAggregateChartData: jest.fn().mockResolvedValue({
    data: [
      { timestamp: 1, entityType: 'table', pageViews: 3 },
      { timestamp: 1, entityType: 'topic', pageViews: 9 },
    ],
  }),
}));

jest.mock('../common/SearchBarComponent/SearchBar.component', () =>
  jest.fn().mockReturnValue(<div data-testid="searchbar" />)
);

jest.mock('./EntitySummaryProgressBar.component', () =>
  jest
    .fn()
    .mockImplementation(({ entity, strokeColor, isActive }) => (
      <div
        data-active={String(isActive)}
        data-color={strokeColor}
        data-testid={'summary-' + entity}
      />
    ))
);

const filter = { startTs: 1, endTs: 2 } as ChartFilter;

const lastLineProps = () =>
  (LineChart as unknown as jest.Mock).mock.calls.at(-1)[0];

const renderChart = () =>
  act(async () => {
    render(<PageViewsByEntitiesChart chartFilter={filter} selectedDays={7} />);
  });

describe('PageViewsByEntitiesChart', () => {
  it('colours each line like its entry in the summary, ranked by latest value', async () => {
    await renderChart();

    const { series, xKey, tooltip } = lastLineProps();

    expect(xKey).toBe('timestamp');
    expect(series.map((s: ChartSeries) => s.key)).toEqual(['topic', 'table']);
    expect(screen.getByTestId('summary-Topic')).toHaveAttribute(
      'data-color',
      series[0].color
    );
    expect(screen.getByTestId('summary-Table')).toHaveAttribute(
      'data-color',
      series[1].color
    );
    expect(tooltip.render).toEqual(expect.any(Function));
  });

  it('toggles a line from the summary', async () => {
    await renderChart();
    fireEvent.click(screen.getByTestId('summary-Table'));

    expect(lastLineProps().series.map((s: ChartSeries) => s.key)).toEqual([
      'table',
    ]);
  });
});
