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
import { DRAWER_NAVIGATION_OPTIONS } from '../../../../utils/EntityUtils';
import {
  mockDashboardEntityDetails,
  mockFetchChartsResponse,
} from '../mocks/DashboardSummary.mock';
import DashboardSummary from './DashboardSummary.component';

jest.mock('../SummaryList/SummaryList.component', () =>
  jest
    .fn()
    .mockImplementation(() => <div data-testid="SummaryList">SummaryList</div>)
);

jest.mock('../CommonEntitySummaryInfo/CommonEntitySummaryInfo', () =>
  jest.fn().mockImplementation(() => <div>testCommonEntitySummaryInfo</div>)
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

    const commonEntitySummaryInfo = screen.getByText(
      'testCommonEntitySummaryInfo'
    );
    const chartsHeader = screen.getByTestId('charts-header');
    const summaryList = screen.getAllByTestId('SummaryList');

    expect(commonEntitySummaryInfo).toBeInTheDocument();
    expect(chartsHeader).toBeInTheDocument();
    expect(summaryList).toHaveLength(2);
  });

  it('Component should render properly, when loaded in the Lineage page.', async () => {
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

    const ownerLabel = screen.queryByTestId('label.owner-label');
    const commonEntitySummaryInfo = screen.getByText(
      'testCommonEntitySummaryInfo'
    );
    const tags = screen.getByText('label.tag-plural');
    const description = screen.getByText('label.description');
    const noDataFound = screen.getByText('label.no-data-found');

    expect(ownerLabel).not.toBeInTheDocument();

    expect(commonEntitySummaryInfo).toBeInTheDocument();

    expect(tags).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(noDataFound).toBeInTheDocument();
  });
});
