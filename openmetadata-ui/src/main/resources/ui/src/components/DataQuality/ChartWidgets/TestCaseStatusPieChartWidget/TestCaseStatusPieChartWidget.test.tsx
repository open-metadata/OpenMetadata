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
import { fetchTestCaseSummary } from '../../../../rest/dataQualityDashboardAPI';
import TestCaseStatusPieChartWidget from './TestCaseStatusPieChartWidget.component';

jest.mock('../../../../utils/DataQuality/DataQualityUtils', () => ({
  transformToTestCaseStatusObject: jest.fn().mockReturnValue({
    success: 4,
    failed: 3,
    aborted: 1,
    total: 8,
  }),
}));
jest.mock('../../../Visualisations/Chart/CustomPieChart.component', () =>
  jest.fn().mockImplementation(() => <div>CustomPieChart.component</div>)
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
    await act(async () => {
      await render(<TestCaseStatusPieChartWidget />);
    });

    expect(fetchTestCaseSummary).toHaveBeenCalledTimes(1);
  });

  it('fetchEntityCoveredWithDQ should be called with filter if provided via props', async () => {
    const filters = {
      tier: ['tier'],
      tags: ['tag1', 'tag2'],
      ownerFqn: 'ownerFqn',
    };
    await act(async () => {
      await render(<TestCaseStatusPieChartWidget chartFilter={filters} />);
    });

    expect(fetchTestCaseSummary).toHaveBeenCalledWith(filters);
  });
});
