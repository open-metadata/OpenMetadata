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
import { DRAWER_NAVIGATION_OPTIONS } from 'utils/EntityUtils';
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
    const dashboardUrlLabel = screen.getByTestId(
      'label.dashboard label.url-uppercase-label'
    );
    const dashboardUrlValue = screen.getByTestId('dashboard-url-value');
    const dashboardLinkName = screen.getByTestId('dashboard-link-name');
    const chartsHeader = screen.getByTestId('charts-header');
    const summaryList = screen.getByTestId('SummaryList');

    expect(dashboardTitle).toBeInTheDocument();
    expect(dashboardLinkName).toBeInTheDocument();
    expect(dashboardUrlLabel).toBeInTheDocument();
    expect(dashboardUrlValue).toContainHTML(mockDashboardEntityDetails.name);
    expect(chartsHeader).toBeInTheDocument();
    expect(summaryList).toBeInTheDocument();
  });

  it('Component should render properly, when loaded in the Lineage page.', async () => {
    const labels = [
      'label.dashboard label.url-uppercase-label',
      'label.service-label',
      'label.owner-label',
      'label.tier-label',
      'Superset label.url-lowercase-label',
    ];

    await act(async () => {
      const { debug } = render(
        <DashboardSummary
          componentType={DRAWER_NAVIGATION_OPTIONS.lineage}
          entityDetails={mockDashboardEntityDetails}
        />,
        {
          wrapper: MemoryRouter,
        }
      );

      debug();
    });

    const dashboardTitle = screen.queryByTestId('TableDataCardTitle');
    const dashboardUrlLabel = screen.getByTestId(
      'label.dashboard label.url-uppercase-label'
    );

    const dashboardUrl = screen.getAllByTestId('dashboard-url-value');

    const tags = screen.getByText('label.tag-plural');
    const description = screen.getByText('label.description');
    const noDataFound = screen.getByText('label.no-data-found');
    const dashboardLink = screen.getAllByTestId('dashboard-link-name');
    const dashboardValue = screen.getAllByTestId('dashboard-url-value');

    labels.forEach((label) =>
      expect(screen.getByTestId(label)).toBeInTheDocument()
    );

    expect(dashboardUrl[0]).toBeInTheDocument();
    expect(dashboardLink[0]).toBeInTheDocument();
    expect(dashboardValue[0]).toBeInTheDocument();
    expect(dashboardTitle).not.toBeInTheDocument();
    expect(tags).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(noDataFound).toBeInTheDocument();

    expect(dashboardUrlLabel).toBeInTheDocument();
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
