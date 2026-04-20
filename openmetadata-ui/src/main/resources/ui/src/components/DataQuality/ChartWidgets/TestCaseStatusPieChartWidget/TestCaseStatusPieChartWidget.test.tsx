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
import { act, render, screen } from '@testing-library/react';
import { TestCaseStatus } from '../../../../generated/entity/feed/testCaseResult';
import { fetchTestCaseSummary } from '../../../../rest/dataQualityDashboardAPI';
import CustomPieChart from '../../../Visualisations/Chart/CustomPieChart.component';
import TestCaseStatusPieChartWidget from './TestCaseStatusPieChartWidget.component';

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

jest.mock('../../../../utils/DataQuality/DataQualityUtils', () => ({
  transformToTestCaseStatusObject: jest.fn().mockReturnValue({
    success: 4,
    failed: 3,
    aborted: 1,
    total: 8,
  }),
  getPieChartLabel: jest.fn().mockReturnValue(<div>Test Label</div>),
  getTestCaseTabPath: jest.fn((status: TestCaseStatus) => ({
    pathname: '/data-quality/test-cases',
    search: `testCaseStatus=${status}`,
  })),
}));

jest.mock('../../../../constants/TestSuite.constant', () => ({
  INITIAL_TEST_SUMMARY: {
    success: 0,
    failed: 0,
    aborted: 0,
    total: 0,
  },
}));
jest.mock('../../../Visualisations/Chart/CustomPieChart.component', () =>
  jest
    .fn()
    .mockImplementation(
      (props: { onSegmentClick?: (e: unknown, i: number) => void }) => (
        <div>
          CustomPieChart.component
          <button
            data-testid="segment-0"
            onClick={() =>
              props.onSegmentClick?.({ name: 'Success', value: 4 }, 0)
            }
          />
          <button
            data-testid="segment-1"
            onClick={() =>
              props.onSegmentClick?.({ name: 'Failed', value: 3 }, 1)
            }
          />
          <button
            data-testid="segment-2"
            onClick={() =>
              props.onSegmentClick?.({ name: 'Aborted', value: 1 }, 2)
            }
          />
        </div>
      )
    )
);

jest.mock('../../../../rest/dataQualityDashboardAPI', () => ({
  fetchTestCaseSummary: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: [
        { document_count: '4', 'testCaseResult.testCaseStatus': 'success' },
        { document_count: '3', 'testCaseResult.testCaseStatus': 'failed' },
        { document_count: '1', 'testCaseResult.testCaseStatus': 'aborted' },
      ],
    })
  ),
}));

describe('TestCaseStatusPieChartWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the component', async () => {
    render(<TestCaseStatusPieChartWidget />);

    expect(
      await screen.findByText('label.test-case-result')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('CustomPieChart.component')
    ).toBeInTheDocument();
  });

  it('fetchTestCaseSummary should be called', async () => {
    render(<TestCaseStatusPieChartWidget />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchTestCaseSummary).toHaveBeenCalledTimes(1);
  });

  it('fetchTestCaseSummary should be called with filter if provided via props', async () => {
    const filters = {
      tier: ['tier'],
      tags: ['tag1', 'tag2'],
      ownerFqn: 'ownerFqn',
    };
    render(<TestCaseStatusPieChartWidget chartFilter={filters} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchTestCaseSummary).toHaveBeenCalledWith(filters);
  });

  it('should pass onSegmentClick to CustomPieChart and navigate on segment click', async () => {
    const { getTestCaseTabPath } = jest.requireMock(
      '../../../../utils/DataQuality/DataQualityUtils'
    ) as { getTestCaseTabPath: jest.Mock };
    const mockNavigate = (
      jest.requireMock('react-router-dom') as {
        __getMockNavigate: () => jest.Mock;
      }
    ).__getMockNavigate();

    render(<TestCaseStatusPieChartWidget />);

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

    expect(getTestCaseTabPath).toHaveBeenCalledWith(TestCaseStatus.Success);
    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/data-quality/test-cases',
      search: `testCaseStatus=${TestCaseStatus.Success}`,
    });

    getTestCaseTabPath.mockClear();
    mockNavigate.mockClear();

    const segment1 = await screen.findByTestId('segment-1');
    await act(async () => {
      segment1.click();
    });

    expect(getTestCaseTabPath).toHaveBeenCalledWith(TestCaseStatus.Failed);
    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/data-quality/test-cases',
      search: `testCaseStatus=${TestCaseStatus.Failed}`,
    });

    getTestCaseTabPath.mockClear();
    mockNavigate.mockClear();

    const segment2 = await screen.findByTestId('segment-2');
    await act(async () => {
      segment2.click();
    });

    expect(getTestCaseTabPath).toHaveBeenCalledWith(TestCaseStatus.Aborted);
    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: '/data-quality/test-cases',
      search: `testCaseStatus=${TestCaseStatus.Aborted}`,
    });
  });
});
