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
import { TestCaseStatus } from '../../../../generated/entity/feed/testCaseResult';
import { fetchEntityCoveredWithDQ } from '../../../../rest/dataQualityDashboardAPI';
import { formatDate } from '../../../../utils/date-time/DateTimeUtils';
import CustomPieChart from '../../../Visualisations/Chart/CustomPieChart.component';
import EntityHealthStatusPieChartWidget from './EntityHealthStatusPieChartWidget.component';

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
}));

jest.mock('../../../../utils/DataQuality/DataQualityUtils', () => ({
  getPieChartLabel: jest.fn().mockReturnValue(<div>Test Label</div>),
}));

jest.mock('../../../../utils/DataQuality/DataQualityPureUtils', () => {
  const actual = jest.requireActual(
    '../../../../utils/DataQuality/DataQualityPureUtils'
  ) as typeof import('../../../../utils/DataQuality/DataQualityPureUtils');

  return {
    ...actual,
    getTestCaseTabPath: jest.fn(actual.getTestCaseTabPath),
  };
});

jest.mock('../../../Visualisations/Chart/CustomPieChart.component', () =>
  jest
    .fn()
    .mockImplementation(
      (props: { onSegmentClick?: (e: unknown, i: number) => void }) => (
        <div>
          CustomPieChart.component
          <button
            aria-label="segment-0"
            data-testid="segment-0"
            onClick={() =>
              props.onSegmentClick?.({ name: 'Healthy', value: 1 }, 0)
            }
          />
          <button
            aria-label="segment-1"
            data-testid="segment-1"
            onClick={() =>
              props.onSegmentClick?.({ name: 'Unhealthy', value: 0 }, 1)
            }
          />
        </div>
      )
    )
);

describe('EntityHealthStatusPieChartWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the component', async () => {
    render(<EntityHealthStatusPieChartWidget />);

    expect(
      await screen.findByText('label.healthy-data-asset-plural')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('CustomPieChart.component')
    ).toBeInTheDocument();
  });

  it('fetchEntityCoveredWithDQ should be called', async () => {
    render(<EntityHealthStatusPieChartWidget />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchEntityCoveredWithDQ).toHaveBeenCalledTimes(2);
  });

  it('fetchEntityCoveredWithDQ should be called with filter if provided via props', async () => {
    const filters = {
      tier: ['tier'],
      tags: ['tag1', 'tag2'],
      ownerFqn: 'ownerFqn',
    };
    render(<EntityHealthStatusPieChartWidget chartFilter={filters} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchEntityCoveredWithDQ).toHaveBeenCalledWith(filters, true);
    expect(fetchEntityCoveredWithDQ).toHaveBeenCalledWith(filters, false);
  });

  it('should pass onSegmentClick to CustomPieChart and navigate on segment click', async () => {
    const { getTestCaseTabPath } = jest.requireMock(
      '../../../../utils/DataQuality/DataQualityPureUtils'
    ) as { getTestCaseTabPath: jest.Mock };
    const mockNavigate = (
      jest.requireMock('react-router-dom') as {
        __getMockNavigate: () => jest.Mock;
      }
    ).__getMockNavigate();

    render(<EntityHealthStatusPieChartWidget />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(CustomPieChart).toHaveBeenCalledWith(
      expect.objectContaining({
        onSegmentClick: expect.any(Function),
      }),
      expect.anything()
    );

    const segment0 = await screen.findByTestId('segment-0');
    await act(async () => {
      segment0.click();
    });

    expect(getTestCaseTabPath).toHaveBeenCalledWith(
      [TestCaseStatus.Success, TestCaseStatus.Queued],
      undefined
    );
    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/data-quality/test-cases',
      search:
        `testCaseStatus%5B%5D=${TestCaseStatus.Success}` +
        `&testCaseStatus%5B%5D=${TestCaseStatus.Queued}`,
    });

    mockNavigate.mockClear();
    getTestCaseTabPath.mockClear();

    const segment1 = await screen.findByTestId('segment-1');
    await act(async () => {
      segment1.click();
    });

    expect(getTestCaseTabPath).toHaveBeenCalledWith(
      [TestCaseStatus.Failed, TestCaseStatus.Aborted],
      undefined
    );
    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/data-quality/test-cases',
      search:
        `testCaseStatus%5B%5D=${TestCaseStatus.Failed}` +
        `&testCaseStatus%5B%5D=${TestCaseStatus.Aborted}`,
    });
  });

  it('should use the supplied navigate function and test cases path', async () => {
    const navigate = jest.fn();

    render(
      <EntityHealthStatusPieChartWidget
        chartFilter={{ startTs: 100, endTs: 200 }}
        navigate={navigate}
        redirectPath="/observability/data-quality/test-cases"
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    const unhealthySegment = await screen.findByTestId('segment-1');
    await act(async () => {
      unhealthySegment.click();
    });

    const expectedTitle = encodeURIComponent(
      `${formatDate(100, true)} -> ${formatDate(200, true)}`
    );

    expect(navigate).toHaveBeenCalledWith({
      pathname: '/observability/data-quality/test-cases',
      search:
        `testCaseStatus%5B%5D=${TestCaseStatus.Failed}` +
        `&testCaseStatus%5B%5D=${TestCaseStatus.Aborted}` +
        '&lastRunRange%5BstartTs%5D=100' +
        '&lastRunRange%5BendTs%5D=200' +
        '&lastRunRange%5Bkey%5D=customRange' +
        `&lastRunRange%5Btitle%5D=${expectedTitle}`,
    });

    const { getTestCaseTabPath } = jest.requireMock(
      '../../../../utils/DataQuality/DataQualityPureUtils'
    ) as { getTestCaseTabPath: jest.Mock };

    expect(getTestCaseTabPath).toHaveBeenCalledWith(
      [TestCaseStatus.Failed, TestCaseStatus.Aborted],
      {
        startTs: 100,
        endTs: 200,
      }
    );
  });
});
