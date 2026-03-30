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
import { act, render, screen } from '@testing-library/react';
import {
  fetchEntityCoveredWithDQ,
  fetchTotalEntityCount,
} from '../../../../rest/dataQualityDashboardAPI';
import CustomPieChart from '../../../Visualisations/Chart/CustomPieChart.component';
import DataAssetsCoveragePieChartWidget from './DataAssetsCoveragePieChartWidget.component';

jest.mock('react-router-dom', () => {
  const actual =
    jest.requireActual<typeof import('react-router-dom')>('react-router-dom');
  const mockNavigate = jest.fn();

  return {
    ...actual,
    useNavigate: () => mockNavigate,
    __getMockNavigate: () => mockNavigate,
  };
});

jest.mock('../../../../rest/dataQualityDashboardAPI', () => ({
  fetchEntityCoveredWithDQ: jest.fn().mockResolvedValue({ data: [] }),
  fetchTotalEntityCount: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('../../../../utils/RouterUtils', () => ({
  getDataQualityPagePath: jest.fn((tab: string) => `/data-quality/${tab}`),
}));

jest.mock('../../../Visualisations/Chart/CustomPieChart.component', () =>
  jest
    .fn()
    .mockImplementation(
      (props: { onSegmentClick?: (e: unknown, i: number) => void }) => (
        <div>
          CustomPieChart.component
          <button
            data-testid="segment-covered"
            onClick={() =>
              props.onSegmentClick?.({ name: 'Covered', value: 1 }, 0)
            }
          />
          <button
            data-testid="segment-not-covered"
            onClick={() =>
              props.onSegmentClick?.({ name: 'Not covered', value: 0 }, 1)
            }
          />
        </div>
      )
    )
);

describe('DataAssetsCoveragePieChartWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the component', async () => {
    render(<DataAssetsCoveragePieChartWidget />);

    expect(
      await screen.findByText('label.data-asset-plural-coverage')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('CustomPieChart.component')
    ).toBeInTheDocument();
  });

  it('fetchEntityCoveredWithDQ & fetchTotalEntityCount should be called', async () => {
    render(<DataAssetsCoveragePieChartWidget />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchEntityCoveredWithDQ).toHaveBeenCalledTimes(1);
    expect(fetchTotalEntityCount).toHaveBeenCalledTimes(1);
  });

  it('fetchEntityCoveredWithDQ & fetchTotalEntityCount should be called with filter if provided via props', async () => {
    const filters = {
      tier: ['tier'],
      tags: ['tag1', 'tag2'],
      ownerFqn: 'ownerFqn',
    };
    render(<DataAssetsCoveragePieChartWidget chartFilter={filters} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchEntityCoveredWithDQ).toHaveBeenCalledWith(filters, false);
    expect(fetchTotalEntityCount).toHaveBeenCalledWith(filters);
  });

  it('should pass onSegmentClick to CustomPieChart and navigate to Test Suites on Covered click', async () => {
    const { getDataQualityPagePath } = jest.requireMock(
      '../../../../utils/RouterUtils'
    ) as { getDataQualityPagePath: jest.Mock };
    const mockNavigate = (
      jest.requireMock('react-router-dom') as {
        __getMockNavigate: () => jest.Mock;
      }
    ).__getMockNavigate();

    render(<DataAssetsCoveragePieChartWidget />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(CustomPieChart).toHaveBeenCalledWith(
      expect.objectContaining({
        onSegmentClick: expect.any(Function),
      }),
      expect.anything()
    );

    const segmentCovered = await screen.findByTestId('segment-covered');
    await act(async () => {
      segmentCovered.click();
    });

    expect(getDataQualityPagePath).toHaveBeenCalledWith('test-suites');
    expect(mockNavigate).toHaveBeenCalledWith('/data-quality/test-suites');
  });

  it('should navigate to Explore on Not covered segment click', async () => {
    const mockNavigate = (
      jest.requireMock('react-router-dom') as {
        __getMockNavigate: () => jest.Mock;
      }
    ).__getMockNavigate();

    render(<DataAssetsCoveragePieChartWidget />);

    await act(async () => {
      await Promise.resolve();
    });

    const segmentNotCovered = await screen.findByTestId('segment-not-covered');
    await act(async () => {
      segmentNotCovered.click();
    });

    expect(mockNavigate).toHaveBeenCalledWith('/explore');
  });
});
