/*
 *  Copyright 2023 Collate.
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
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  mockDashboardEntityDetails,
  mockFetchChartsResponse,
} from '../mocks/DashboardSummary.mock';
import DashboardSummary from './DashboardSummary.component';

jest.mock(
  '../../../common/table-data-card-v2/TableDataCardTitle.component',
  () =>
    jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="TableDataCardTitle">TableDataCardTitle</div>
      ))
);

jest.mock('../SummaryList/SummaryList.component', () =>
  jest
    .fn()
    .mockImplementation(() => <div data-testid="SummaryList">SummaryList</div>)
);

jest.mock('../../../../utils/DashboardDetailsUtils', () => ({
  fetchCharts: jest.fn().mockImplementation(() => mockFetchChartsResponse),
}));

describe('DashboardSummary component tests', () => {
  it('Component should render properly', async () => {
    await act(async () => {
      render(<DashboardSummary entityDetails={mockDashboardEntityDetails} />, {
        wrapper: MemoryRouter,
      });
    });

    const dashboardTitle = screen.getByTestId('TableDataCardTitle');
    const dashboardUrlLabel = screen.getByTestId('dashboard-url-label');
    const dashboardUrlValue = screen.getByTestId('dashboard-link-name');
    const chartsHeader = screen.getByTestId('charts-header');
    const summaryList = screen.getByTestId('SummaryList');

    expect(dashboardTitle).toBeInTheDocument();
    expect(dashboardUrlLabel).toBeInTheDocument();
    expect(dashboardUrlValue).toContainHTML(mockDashboardEntityDetails.name);
    expect(chartsHeader).toBeInTheDocument();
    expect(summaryList).toBeInTheDocument();
  });

  it('If the dashboard url is not present in dashboard details, "-" should be displayed as dashboard url value', async () => {
    await act(async () => {
      render(
        <DashboardSummary
          entityDetails={{
            ...mockDashboardEntityDetails,
            dashboardUrl: undefined,
          }}
        />,
        {
          wrapper: MemoryRouter,
        }
      );

      const dashboardUrlValue = screen.getByTestId('dashboard-url-value');

      expect(dashboardUrlValue).toContainHTML('-');
    });
  });
});
