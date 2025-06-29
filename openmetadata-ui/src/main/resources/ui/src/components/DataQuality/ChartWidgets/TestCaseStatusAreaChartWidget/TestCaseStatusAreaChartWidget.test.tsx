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
import { TestCaseStatus } from '../../../../generated/tests/testCase';
import { fetchTestCaseStatusMetricsByDays } from '../../../../rest/dataQualityDashboardAPI';
import { TestCaseStatusAreaChartWidgetProps } from '../../DataQuality.interface';
import TestCaseStatusAreaChartWidget from './TestCaseStatusAreaChartWidget.component';

jest.mock('../../../../rest/dataQualityDashboardAPI', () => ({
  fetchTestCaseStatusMetricsByDays: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: [
        { timestamp: 1625097600000, 'testCase.fullyQualifiedName': 5 },
        { timestamp: 1625184000000, 'testCase.fullyQualifiedName': 10 },
      ],
    })
  ),
}));
jest.mock('../../../Visualisations/Chart/CustomAreaChart.component', () =>
  jest.fn().mockImplementation(() => <div>CustomAreaChart.component</div>)
);

const defaultProps: TestCaseStatusAreaChartWidgetProps = {
  testCaseStatus: TestCaseStatus.Success,
  name: 'Test Case Status',
  title: 'Test Case Status Over Time',
};

describe('TestCaseStatusAreaChartWidget', () => {
  it('should render the component', async () => {
    render(<TestCaseStatusAreaChartWidget {...defaultProps} />);

    expect(await screen.findByText(defaultProps.title)).toBeInTheDocument();
    expect(
      await screen.findByText('CustomAreaChart.component')
    ).toBeInTheDocument();
    expect((await screen.findByTestId('total-value')).textContent).toEqual(
      '10'
    );
  });

  it('should call fetchTestCaseStatusMetricsByDays function', async () => {
    render(<TestCaseStatusAreaChartWidget {...defaultProps} />);

    expect(fetchTestCaseStatusMetricsByDays).toHaveBeenCalledWith(
      defaultProps.testCaseStatus,
      undefined
    );
  });

  it('should call fetchTestCaseStatusMetricsByDays with filters provided via props', async () => {
    const filters = {
      endTs: 1625097600000,
      startTs: 1625097600000,
      ownerFqn: 'ownerFqn',
      tags: ['tag1', 'tag2'],
      tier: ['tier1'],
    };
    const status = TestCaseStatus.Failed;
    render(
      <TestCaseStatusAreaChartWidget
        {...defaultProps}
        chartFilter={filters}
        testCaseStatus={status}
      />
    );

    expect(fetchTestCaseStatusMetricsByDays).toHaveBeenCalledWith(
      status,
      filters
    );
  });

  it('should handle API errors gracefully', async () => {
    (fetchTestCaseStatusMetricsByDays as jest.Mock).mockRejectedValue(
      new Error('API Error')
    );
    render(<TestCaseStatusAreaChartWidget {...defaultProps} />);
    await waitFor(() =>
      expect(fetchTestCaseStatusMetricsByDays).toHaveBeenCalled()
    );

    expect(await screen.findByText(defaultProps.title)).toBeInTheDocument();
    expect(
      await screen.findByText('CustomAreaChart.component')
    ).toBeInTheDocument();
    expect((await screen.findByTestId('total-value')).textContent).toEqual('0');
  });
});
