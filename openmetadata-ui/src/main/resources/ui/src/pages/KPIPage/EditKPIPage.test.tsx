/*
 *  Copyright 2022 Collate.
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

import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import EditKPIPage from './EditKPIPage';
import { DESCRIPTION_CHART, KPI_DATA } from './KPIMock.mock';

const mockPush = jest.fn();

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockReturnValue({
    push: mockPush,
  }),
  useParams: jest.fn().mockReturnValue({ useParams: 'description-kpi' }),
}));

jest.mock('rest/DataInsightAPI', () => ({
  getChartById: jest
    .fn()
    .mockImplementation(() => Promise.resolve(DESCRIPTION_CHART)),
}));

jest.mock('components/common/rich-text-editor/RichTextEditor', () =>
  jest.fn().mockReturnValue(<div data-testid="editor">Editor</div>)
);

jest.mock('components/common/title-breadcrumb/title-breadcrumb.component', () =>
  jest.fn().mockReturnValue(<div data-testid="breadcrumb">BreadCrumb</div>)
);

jest.mock('components/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div data-testid="loader">Loader</div>)
);

jest.mock('rest/KpiAPI', () => ({
  getKPIByName: jest.fn().mockImplementation(() => Promise.resolve(KPI_DATA)),
  patchKPI: jest.fn().mockImplementation(() => Promise.resolve(KPI_DATA)),
}));

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: true }),
}));

jest.mock('../../utils/DataInsightUtils', () => ({
  getKpiTargetValueByMetricType: jest.fn().mockReturnValue(10),
  getKPIFormattedDates: jest.fn().mockReturnValue({
    startDate: `2022-12-08 00:00`,
    endDate: `2022-12-28 23:59`,
  }),
  getDisabledDates: jest.fn().mockReturnValue(true),
  getKpiDateFormatByTimeStamp: jest.fn().mockReturnValue('2022-12-08'),
}));

describe('Edit KPI page', () => {
  it('Should render all the components', async () => {
    render(<EditKPIPage />, { wrapper: MemoryRouter });

    const container = await screen.findByTestId('edit-kpi-container');
    const breadCrumb = await screen.findByTestId('breadcrumb');
    const formTitle = await screen.findByTestId('form-title');
    const rightPanel = await screen.findByTestId('right-panel');

    expect(container).toBeInTheDocument();

    expect(breadCrumb).toBeInTheDocument();

    expect(formTitle).toBeInTheDocument();

    expect(formTitle.textContent).toContain('label.edit-entity');

    const formContainer = await screen.findByTestId('kpi-form');

    expect(formContainer).toBeInTheDocument();

    expect(rightPanel).toBeInTheDocument();
  });

  it('Should render all the form fields', async () => {
    render(<EditKPIPage />, { wrapper: MemoryRouter });

    const formContainer = await screen.findByTestId('kpi-form');

    const chart = await screen.findByTestId('dataInsightChart');
    const displayName = await screen.findByTestId('displayName');
    const metricType = await screen.findByTestId('metricType');
    const startDate = await screen.findByTestId('start-date');
    const endDate = await screen.findByTestId('end-date');
    const editor = await screen.findByTestId('editor');
    const cancelButton = await screen.findByTestId('cancel-btn');
    const submitButton = await screen.findByTestId('submit-btn');

    expect(formContainer).toBeInTheDocument();
    expect(chart).toBeInTheDocument();
    expect(displayName).toBeInTheDocument();
    expect(metricType).toBeInTheDocument();
    expect(startDate).toBeInTheDocument();
    expect(endDate).toBeInTheDocument();
    expect(editor).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();
    expect(submitButton).toBeInTheDocument();
  });

  it('Chart input and Metric type input should be disable for edit form', async () => {
    render(<EditKPIPage />, { wrapper: MemoryRouter });

    const chart = await screen.findByTestId('dataInsightChart');

    const metricType = await screen.findByTestId('metricType');

    expect(chart).toHaveClass('ant-input-disabled');

    expect(metricType).toHaveClass('ant-input-disabled');
  });
});
