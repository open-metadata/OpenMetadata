/*
 *  Copyright 2024 Collate.
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
import '@testing-library/jest-dom/extend-expect';
import { act, render, screen, waitFor } from '@testing-library/react';
import { DataQualityDimensions } from '../../../../generated/tests/testDefinition';
import { DataQualityDashboardChartFilters } from '../../../../pages/DataQuality/DataQualityPage.interface';
import {
  fetchTestCaseSummaryByDimension,
  fetchTestCaseSummaryByNoDimension,
} from '../../../../rest/dataQualityDashboardAPI';
import StatusByDimensionCardWidget from './StatusByDimensionCardWidget.component';

const mockStatusByDimensionWidgetTestId = 'status-by-dimension-widget';

jest.mock('../../../../rest/dataQualityDashboardAPI', () => ({
  fetchTestCaseSummaryByDimension: jest.fn(),
  fetchTestCaseSummaryByNoDimension: jest.fn(),
}));

jest.mock('../../../../utils/DataQuality/DataQualityPureUtils', () => ({
  ...jest.requireActual('../../../../utils/DataQuality/DataQualityPureUtils'),
  getDimensionIcon: jest.fn((dimension) => `icon-${dimension}`),
}));

jest.mock('../StatusCardWidget/StatusCardWidget.component', () =>
  jest
    .fn()
    .mockImplementation(({ redirectPath, statusData }) => (
      <div
        data-redirect-search={redirectPath.search}
        data-testid={mockStatusByDimensionWidgetTestId}
        data-total={statusData.total}
      />
    ))
);
jest.mock('../../../../constants/DataQuality.constants', () => ({
  ...jest.requireActual('../../../../constants/DataQuality.constants'),
  DIMENSIONS_DATA: [
    DataQualityDimensions.Accuracy,
    DataQualityDimensions.Completeness,
    DataQualityDimensions.Consistency,
    DataQualityDimensions.Integrity,
    DataQualityDimensions.SQL,
    DataQualityDimensions.Uniqueness,
    DataQualityDimensions.Validity,
    DataQualityDimensions.NoDimension,
  ],
  NO_DIMENSION: DataQualityDimensions.NoDimension,
  DEFAULT_DIMENSIONS_DATA: {
    [DataQualityDimensions.Accuracy]: {
      title: DataQualityDimensions.Accuracy,
      success: 0,
      failed: 0,
      aborted: 0,
      total: 0,
    },
    [DataQualityDimensions.Completeness]: {
      title: DataQualityDimensions.Completeness,
      success: 0,
      failed: 0,
      aborted: 0,
      total: 0,
    },
    [DataQualityDimensions.Consistency]: {
      title: DataQualityDimensions.Consistency,
      success: 0,
      failed: 0,
      aborted: 0,
      total: 0,
    },
    [DataQualityDimensions.Integrity]: {
      title: DataQualityDimensions.Integrity,
      success: 0,
      failed: 0,
      aborted: 0,
      total: 0,
    },
    [DataQualityDimensions.SQL]: {
      title: DataQualityDimensions.SQL,
      success: 0,
      failed: 0,
      aborted: 0,
      total: 0,
    },
    [DataQualityDimensions.Uniqueness]: {
      title: DataQualityDimensions.Uniqueness,
      success: 0,
      failed: 0,
      aborted: 0,
      total: 0,
    },
    [DataQualityDimensions.Validity]: {
      title: DataQualityDimensions.Validity,
      success: 0,
      failed: 0,
      aborted: 0,
      total: 0,
    },
    [DataQualityDimensions.NoDimension]: {
      title: DataQualityDimensions.NoDimension,
      success: 0,
      failed: 0,
      aborted: 0,
      total: 0,
    },
  },
}));
jest.mock('../../../../utils/RouterUtils', () => {
  return {
    getDataQualityPagePath: jest.fn(),
  };
});

const chartFilter: DataQualityDashboardChartFilters = {
  ownerFqn: 'ownerFqn',
  tags: ['tag1', 'tag2'],
  tier: ['tier1', 'tier2'],
  startTs: 100,
  endTs: 200,
};

describe('StatusByDimensionCardWidget', () => {
  it('renders dimensions with data after loading', async () => {
    const mockData = {
      data: [
        {
          dataQualityDimension: DataQualityDimensions.Accuracy,
          document_count: '6',
          'testCaseResult.testCaseStatus': 'success',
        },
        {
          dataQualityDimension: DataQualityDimensions.Completeness,
          document_count: '6',
          'testCaseResult.testCaseStatus': 'success',
        },
      ],
    };

    (fetchTestCaseSummaryByDimension as jest.Mock).mockResolvedValue(mockData);
    (fetchTestCaseSummaryByNoDimension as jest.Mock).mockResolvedValue({
      data: [],
    });

    await act(async () => {
      render(<StatusByDimensionCardWidget chartFilter={chartFilter} />);
    });

    await waitFor(() =>
      expect(fetchTestCaseSummaryByDimension).toHaveBeenCalledWith(chartFilter)
    );

    expect(
      await screen.findAllByTestId(mockStatusByDimensionWidgetTestId)
    ).toHaveLength(8);
  });

  it('starts dimension and no-dimension requests together', async () => {
    let resolveDimension!: (value: { data: [] }) => void;
    (fetchTestCaseSummaryByDimension as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveDimension = resolve;
      })
    );
    (fetchTestCaseSummaryByNoDimension as jest.Mock).mockResolvedValue({
      data: [],
    });

    render(<StatusByDimensionCardWidget chartFilter={chartFilter} />);

    await waitFor(() =>
      expect(fetchTestCaseSummaryByNoDimension).toHaveBeenCalledWith(
        chartFilter
      )
    );

    await act(async () => {
      resolveDimension({ data: [] });
    });
  });

  it('preserves active chart filters in dimension links', async () => {
    (fetchTestCaseSummaryByDimension as jest.Mock).mockResolvedValue({
      data: [],
    });
    (fetchTestCaseSummaryByNoDimension as jest.Mock).mockResolvedValue({
      data: [],
    });

    render(<StatusByDimensionCardWidget chartFilter={chartFilter} />);

    const firstDimension = (
      await screen.findAllByTestId(mockStatusByDimensionWidgetTestId)
    )[0];

    expect(firstDimension).toHaveAttribute(
      'data-redirect-search',
      expect.stringContaining('tags%5B%5D=tag1')
    );
    expect(firstDimension).toHaveAttribute(
      'data-redirect-search',
      expect.stringContaining('tier=tier1')
    );
    expect(firstDimension).toHaveAttribute(
      'data-redirect-search',
      expect.stringContaining('dataQualityDimension=Accuracy')
    );
    expect(firstDimension).toHaveAttribute(
      'data-redirect-search',
      expect.stringContaining('lastRunRange%5BstartTs%5D=100')
    );
    expect(firstDimension).toHaveAttribute(
      'data-redirect-search',
      expect.stringContaining('lastRunRange%5BendTs%5D=200')
    );
  });

  it('handles API error gracefully', async () => {
    (fetchTestCaseSummaryByDimension as jest.Mock).mockRejectedValue(
      new Error('API Error')
    );

    await act(async () => {
      render(<StatusByDimensionCardWidget chartFilter={chartFilter} />);
    });

    await waitFor(() =>
      expect(fetchTestCaseSummaryByDimension).toHaveBeenCalledWith(chartFilter)
    );

    expect(
      await screen.findAllByTestId(mockStatusByDimensionWidgetTestId)
    ).toHaveLength(8);
  });

  it('ignores stale responses when chart filters change', async () => {
    const createDeferredResponse = () => {
      let resolve!: (value: { data: Record<string, string>[] }) => void;
      const promise = new Promise<{ data: Record<string, string>[] }>(
        (promiseResolve) => {
          resolve = promiseResolve;
        }
      );

      return { promise, resolve };
    };
    const olderResponse = createDeferredResponse();
    const newerResponse = createDeferredResponse();
    const newerChartFilter = { ...chartFilter, ownerFqn: 'newOwnerFqn' };

    (fetchTestCaseSummaryByDimension as jest.Mock)
      .mockReturnValueOnce(olderResponse.promise)
      .mockReturnValueOnce(newerResponse.promise);
    (fetchTestCaseSummaryByNoDimension as jest.Mock).mockResolvedValue({
      data: [],
    });

    const { rerender } = render(
      <StatusByDimensionCardWidget chartFilter={chartFilter} />
    );

    rerender(<StatusByDimensionCardWidget chartFilter={newerChartFilter} />);

    await act(async () => {
      newerResponse.resolve({
        data: [
          {
            dataQualityDimension: DataQualityDimensions.Accuracy,
            document_count: '2',
            'testCaseResult.testCaseStatus': 'success',
          },
        ],
      });
    });

    await waitFor(() =>
      expect(
        screen.getAllByTestId(mockStatusByDimensionWidgetTestId)[0]
      ).toHaveAttribute('data-total', '2')
    );

    await act(async () => {
      olderResponse.resolve({
        data: [
          {
            dataQualityDimension: DataQualityDimensions.Accuracy,
            document_count: '1',
            'testCaseResult.testCaseStatus': 'success',
          },
        ],
      });
    });

    await waitFor(() =>
      expect(
        screen.getAllByTestId(mockStatusByDimensionWidgetTestId)[0]
      ).toHaveAttribute('data-total', '2')
    );
  });

  it('uses only two, four, or eight responsive columns', async () => {
    (fetchTestCaseSummaryByDimension as jest.Mock).mockResolvedValue({
      data: [],
    });
    (fetchTestCaseSummaryByNoDimension as jest.Mock).mockResolvedValue({
      data: [],
    });

    const { container } = render(
      <StatusByDimensionCardWidget chartFilter={chartFilter} />
    );

    await waitFor(() =>
      expect(fetchTestCaseSummaryByDimension).toHaveBeenCalledWith(chartFilter)
    );

    const responsiveContainer = container.firstElementChild;
    const grid = responsiveContainer?.firstElementChild;

    expect(responsiveContainer).toHaveClass('tw:@container');
    expect(grid).toHaveClass(
      'tw:grid-cols-[repeat(2,minmax(0,20rem))]',
      'tw:@3xl:grid-cols-[repeat(4,minmax(0,20rem))]',
      'tw:@8xl:grid-cols-[repeat(8,minmax(0,20rem))]',
      'tw:@8xl:gap-x-8'
    );
    expect(grid).not.toHaveClass(
      'tw:@7xl:grid-cols-[repeat(8,minmax(0,20rem))]',
      'tw:@7xl:gap-x-8'
    );
  });
});
