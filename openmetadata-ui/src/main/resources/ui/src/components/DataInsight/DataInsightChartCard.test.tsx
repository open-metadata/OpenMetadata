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
import { act, render, screen } from '@testing-library/react';
import { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { SystemChartType } from '../../enums/DataInsight.enum';
import {
  DataInsightCustomChartResult,
  getChartPreviewByName,
} from '../../rest/DataInsightAPI';
import { DataInsightChartCard } from './DataInsightChartCard';

jest.mock('./DataInsightProvider/DataInsightProvider', () => ({
  useDataInsightProvider: jest.fn().mockReturnValue({
    chartFilter: { startTs: 1, endTs: 2 },
    selectedDaysFilter: 7,
    kpi: { isLoading: false, data: [] },
    entitiesSummary: {},
  }),
}));

const mockChartResult: DataInsightCustomChartResult = {
  results: [
    { day: 1, group: 'table', count: 9, term: '' },
    { day: 1, group: 'topic', count: 5, term: '' },
    { day: 2, group: 'table', count: 10, term: '' },
    { day: 2, group: 'topic', count: 6, term: '' },
  ],
};

jest.mock('../../rest/DataInsightAPI', () => ({
  getChartPreviewByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockChartResult)),
}));

jest.mock('../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: {
    getTabsInfo: jest.fn().mockReturnValue({ table: { path: 'tables' } }),
  },
}));

jest.mock('../common/SearchBarComponent/SearchBar.component', () =>
  jest.fn().mockReturnValue(<div data-testid="searchbar" />)
);

jest.mock('./DataInsightProgressBar', () =>
  jest.fn().mockReturnValue(<div data-testid="progress-bar" />)
);

jest.mock('./EntitySummaryProgressBar.component', () =>
  jest.fn().mockReturnValue(<div data-testid="entity-summary" />)
);

jest.mock('./EmptyGraphPlaceholder', () => ({
  EmptyGraphPlaceholder: jest
    .fn()
    .mockReturnValue(<div data-testid="no-data-placeholder" />),
}));

const props = {
  type: SystemChartType.TotalDataAssets,
  header: 'Total Data Assets',
  subHeader: 'sub header',
  totalAssets: mockChartResult,
};

const ownerType = SystemChartType.PercentageOfDataAssetWithOwner;

const renderCard = (
  cardProps: ComponentProps<typeof DataInsightChartCard> = props
) =>
  act(async () => {
    render(<DataInsightChartCard {...cardProps} />, {
      wrapper: MemoryRouter,
    });
  });

describe('DataInsightChartCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('draws the total-assets card from the shared series without a request', async () => {
    await renderCard();

    expect(getChartPreviewByName).not.toHaveBeenCalled();
    expect(
      screen.getByTestId(`${SystemChartType.TotalDataAssets}-graph`)
    ).toBeInTheDocument();
  });

  it('fetches only its own chart and absolute values, in parallel', async () => {
    let resolveOwn: (value: DataInsightCustomChartResult) => void = jest.fn();
    (getChartPreviewByName as jest.Mock).mockImplementationOnce(
      () => new Promise((resolve) => (resolveOwn = resolve))
    );

    render(<DataInsightChartCard {...props} type={ownerType} />, {
      wrapper: MemoryRouter,
    });

    // Both requests are in flight before the first one settles.
    expect(
      (getChartPreviewByName as jest.Mock).mock.calls.map(([name]) => name)
    ).toEqual([ownerType, SystemChartType.NumberOfDataAssetWithOwner]);

    await act(async () => resolveOwn(mockChartResult));
  });

  it('keeps a percentage card loading until the shared totals arrive', async () => {
    let rerender: ReturnType<typeof render>['rerender'] = jest.fn();
    await act(async () => {
      ({ rerender } = render(
        <DataInsightChartCard
          {...props}
          totalAssets={undefined}
          type={ownerType}
        />,
        { wrapper: MemoryRouter }
      ));
    });

    expect(screen.queryByTestId(`${ownerType}-graph`)).not.toBeInTheDocument();
    expect(screen.queryByTestId('no-data-placeholder')).not.toBeInTheDocument();

    rerender(<DataInsightChartCard {...props} type={ownerType} />);

    expect(screen.getByTestId(`${ownerType}-graph`)).toBeInTheDocument();
  });

  it('shows the empty state, not a change, when the shared totals failed', async () => {
    await renderCard({ ...props, type: ownerType, totalAssets: null });

    expect(screen.getByTestId('no-data-placeholder')).toBeInTheDocument();
    expect(screen.queryByTestId(`${ownerType}-graph`)).not.toBeInTheDocument();
  });
});
