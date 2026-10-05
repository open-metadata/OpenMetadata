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
import { MemoryRouter } from 'react-router-dom';
import {
  DEFAULT_CHART_OPACITY,
  HOVER_CHART_OPACITY,
} from '../../constants/constants';
import { SystemChartType } from '../../enums/DataInsight.enum';
import { DataInsightChartCard } from './DataInsightChartCard';

jest.mock('../../pages/DataInsightPage/DataInsightProvider', () => ({
  useDataInsightProvider: jest.fn().mockReturnValue({
    chartFilter: { startTs: 1, endTs: 2 },
    selectedDaysFilter: 7,
    kpi: { isLoading: false, data: [] },
    entitiesSummary: {},
  }),
}));

jest.mock('../../rest/DataInsightAPI', () => ({
  getChartPreviewByName: jest.fn().mockResolvedValue({
    results: [
      { day: 1, group: 'table', count: 9 },
      { day: 1, group: 'topic', count: 5 },
      { day: 2, group: 'table', count: 10 },
      { day: 2, group: 'topic', count: 6 },
    ],
  }),
}));

jest.mock('../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: {
    getTabsInfo: jest.fn().mockReturnValue({ table: { path: 'tables' } }),
  },
}));

jest.mock('../common/SearchBarComponent/SearchBar.component', () =>
  jest
    .fn()
    .mockImplementation(({ onSearch }) => (
      <input
        aria-label="search"
        data-testid="searchbar"
        onChange={(e) => onSearch(e.target.value)}
      />
    ))
);

jest.mock('./DataInsightProgressBar', () =>
  jest.fn().mockReturnValue(<div data-testid="progress-bar" />)
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

const props = {
  type: SystemChartType.TotalDataAssets,
  header: 'Total Data Assets',
  subHeader: 'sub header',
};

const lastLineProps = () =>
  (LineChart as unknown as jest.Mock).mock.calls.at(-1)[0];

const renderCard = (cardProps = props) =>
  act(async () => {
    render(<DataInsightChartCard {...cardProps} />, {
      wrapper: MemoryRouter,
    });
  });

describe('DataInsightChartCard', () => {
  it('draws one line per entity, colours matching the side panel', async () => {
    await renderCard();

    const { series, xKey } = lastLineProps();

    expect(xKey).toBe('day');
    expect(series.map((s: ChartSeries) => s.key)).toEqual(['table', 'topic']);
    expect(screen.getByTestId('summary-Table')).toHaveAttribute(
      'data-color',
      series[0].color
    );
    expect(screen.getByTestId('summary-Topic')).toHaveAttribute(
      'data-color',
      series[1].color
    );
  });

  it('toggles a line from the side panel and clears it', async () => {
    await renderCard();
    fireEvent.click(screen.getByTestId('summary-Topic'));

    expect(lastLineProps().series.map((s: ChartSeries) => s.key)).toEqual([
      'topic',
    ]);

    fireEvent.click(screen.getByText('label.clear'));

    expect(lastLineProps().series).toHaveLength(2);
  });

  it('dims the other lines while an entity is hovered', async () => {
    await renderCard();
    fireEvent.mouseEnter(
      screen.getByTestId('summary-Topic').parentElement as HTMLElement
    );

    expect(lastLineProps().series[0].seriesOption).toEqual({
      lineStyle: { opacity: HOVER_CHART_OPACITY },
    });
    expect(lastLineProps().series[1].seriesOption).toEqual({
      lineStyle: { opacity: DEFAULT_CHART_OPACITY },
    });
  });

  it('restores every line to full opacity when the hover ends', async () => {
    await renderCard();
    const row = screen.getByTestId('summary-Topic')
      .parentElement as HTMLElement;
    fireEvent.mouseEnter(row);
    fireEvent.mouseLeave(row);

    expect(
      lastLineProps().series.map((s: ChartSeries) => s.seriesOption)
    ).toEqual([
      { lineStyle: { opacity: DEFAULT_CHART_OPACITY } },
      { lineStyle: { opacity: DEFAULT_CHART_OPACITY } },
    ]);
  });

  it('keeps colours when a search hides entities', async () => {
    await renderCard();
    const topicColour = lastLineProps().series[1].color;
    fireEvent.change(screen.getByTestId('searchbar'), {
      target: { value: 'top' },
    });

    expect(lastLineProps().series).toEqual([
      expect.objectContaining({ key: 'topic', color: topicColour }),
    ]);
  });

  it('formats percentage cards with % on the y axis', async () => {
    await renderCard({
      ...props,
      type: SystemChartType.PercentageOfDataAssetWithOwner,
    });

    expect(lastLineProps().yAxis.formatter(40)).toBe('40%');
  });
});
