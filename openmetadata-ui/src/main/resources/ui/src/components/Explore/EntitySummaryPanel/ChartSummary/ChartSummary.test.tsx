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
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { MOCK_CHART_DATA } from '../../../../mocks/Chart.mock';
import ChartSummary from './ChartSummary.component';

jest.mock('../SummaryList/SummaryList.component', () =>
  jest.fn().mockImplementation(() => <p>SummaryList</p>)
);

jest.mock('../CommonEntitySummaryInfo/CommonEntitySummaryInfo', () =>
  jest.fn().mockImplementation(() => <p>testCommonEntitySummaryInfo</p>)
);

jest.mock(
  '../../../common/SummaryTagsDescription/SummaryTagsDescription.component',
  () => jest.fn().mockImplementation(() => <p>SummaryTagsDescription</p>)
);

jest.mock('../../../../utils/EntityUtils', () => ({
  getEntityOverview: jest.fn(),
  DRAWER_NAVIGATION_OPTIONS: {
    explore: 'explore',
  },
}));

jest.mock('../../../../utils/EntitySummaryPanelUtils', () => ({
  getSortedTagsWithHighlight: jest.fn(),
  getFormattedEntityData: jest.fn(),
}));

describe('ChartSummary component tests', () => {
  it('Component should render properly', async () => {
    await act(async () => {
      render(<ChartSummary entityDetails={MOCK_CHART_DATA} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByTestId('charts-header')).toBeInTheDocument();
    expect(screen.getByText('SummaryList')).toBeInTheDocument();
    expect(screen.getByText('SummaryTagsDescription')).toBeInTheDocument();
    expect(screen.getByText('testCommonEntitySummaryInfo')).toBeInTheDocument();
  });
});
