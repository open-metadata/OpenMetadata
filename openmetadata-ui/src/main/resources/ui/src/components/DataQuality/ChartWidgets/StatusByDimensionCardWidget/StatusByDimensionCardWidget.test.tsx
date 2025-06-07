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
import { render, screen, waitFor } from '@testing-library/react';
import { DataQualityDimensions } from '../../../../generated/tests/testDefinition';
import { DataQualityDashboardChartFilters } from '../../../../pages/DataQuality/DataQualityPage.interface';
import {
  fetchTestCaseSummaryByDimension,
  fetchTestCaseSummaryByNoDimension,
} from '../../../../rest/dataQualityDashboardAPI';
import StatusByDimensionCardWidget from './StatusByDimensionCardWidget.component';

jest.mock('../../../../rest/dataQualityDashboardAPI', () => ({
  fetchTestCaseSummaryByDimension: jest.fn(),
  fetchTestCaseSummaryByNoDimension: jest.fn(),
}));

jest.mock('../../../../utils/DataQuality/DataQualityUtils', () => ({
  getDimensionIcon: jest.fn((dimension) => `icon-${dimension}`),
  transformToTestCaseStatusByDimension: jest.fn((data) => data),
}));

jest.mock('../StatusCardWidget/StatusCardWidget.component', () =>
  jest
    .fn()
    .mockImplementation(() => <div>StatusByDimensionWidget.component</div>)
);
jest.mock('../../../../constants/profiler.constant', () => ({
  DIMENSIONS_DATA: [
    'Accuracy',
    'Completeness',
    'Consistency',
    'Integrity',
    'SQL',
    'Uniqueness',
    'Validity',
    'No Dimension',
  ],
  NO_DIMENSION: 'No Dimension',
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
};

describe('StatusByDimensionCardWidget', () => {
  it('renders dimensions with data after loading', async () => {
    const mockData = {
      data: [
        {
          title: DataQualityDimensions.Accuracy,
          success: 5,
          failed: 1,
          aborted: 0,
          total: 6,
        },
        {
          title: DataQualityDimensions.Completeness,
          success: 3,
          failed: 2,
          aborted: 1,
          total: 6,
        },
      ],
    };

    (fetchTestCaseSummaryByDimension as jest.Mock).mockResolvedValue(mockData);
    (fetchTestCaseSummaryByNoDimension as jest.Mock).mockResolvedValue({
      data: [],
    });

    render(<StatusByDimensionCardWidget chartFilter={chartFilter} />);

    await waitFor(() =>
      expect(fetchTestCaseSummaryByDimension).toHaveBeenCalledWith(chartFilter)
    );

    expect(
      await screen.findAllByText('StatusByDimensionWidget.component')
    ).toHaveLength(2);
  });

  it('handles API error gracefully', async () => {
    (fetchTestCaseSummaryByDimension as jest.Mock).mockRejectedValue(
      new Error('API Error')
    );

    render(<StatusByDimensionCardWidget chartFilter={chartFilter} />);

    await waitFor(() =>
      expect(fetchTestCaseSummaryByDimension).toHaveBeenCalledWith(chartFilter)
    );

    expect(
      await screen.findAllByText('StatusByDimensionWidget.component')
    ).toHaveLength(8);
  });
});
