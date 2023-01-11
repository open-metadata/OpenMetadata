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

import {
  act,
  findByRole,
  fireEvent,
  render,
  screen,
  waitForElement,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import AddKPIPage from './AddKPIPage';
import { KPI_CHARTS, KPI_DATA, KPI_LIST } from './KPIMock.mock';

const mockPush = jest.fn();

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockReturnValue({
    push: mockPush,
  }),
}));

jest.mock('rest/DataInsightAPI', () => ({
  getListDataInsightCharts: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: KPI_CHARTS })),
}));

jest.mock('components/common/rich-text-editor/RichTextEditor', () =>
  jest.fn().mockReturnValue(<div data-testid="editor">Editor</div>)
);

jest.mock('components/common/title-breadcrumb/title-breadcrumb.component', () =>
  jest.fn().mockReturnValue(<div data-testid="breadcrumb">BreadCrumb</div>)
);

jest.mock('rest/KpiAPI', () => ({
  getListKPIs: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: KPI_LIST })),
  postKPI: jest.fn().mockImplementation(() => Promise.resolve(KPI_DATA)),
}));

jest.mock('../../utils/CommonUtils', () => ({
  isUrlFriendlyName: jest.fn().mockReturnValue(true),
}));

jest.mock('../../utils/DataInsightUtils', () => ({
  getKpiTargetValueByMetricType: jest.fn().mockReturnValue(10),
  getKPIFormattedDates: jest.fn().mockReturnValue({
    startDate: `2022-12-08 00:00`,
    endDate: `2022-12-28 23:59`,
  }),
  getDisabledDates: jest.fn().mockReturnValue(true),
}));

describe('Add KPI page', () => {
  it('Should render all the components', async () => {
    render(<AddKPIPage />, { wrapper: MemoryRouter });

    const container = await screen.findByTestId('add-kpi-container');
    const breadCrumb = await screen.findByTestId('breadcrumb');
    const formTitle = await screen.findByTestId('form-title');
    const rightPanel = await screen.findByTestId('right-panel');

    expect(container).toBeInTheDocument();

    expect(breadCrumb).toBeInTheDocument();

    expect(formTitle).toBeInTheDocument();

    expect(formTitle.textContent).toContain('label.add-new-entity');

    const formContainer = await screen.findByTestId('kpi-form');

    expect(formContainer).toBeInTheDocument();

    expect(rightPanel).toBeInTheDocument();
  });

  it('Should render all the form fields', async () => {
    render(<AddKPIPage />, { wrapper: MemoryRouter });

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

  it('Metric type input should be disable if chart is not selected', async () => {
    render(<AddKPIPage />, { wrapper: MemoryRouter });

    const chart = await screen.findByTestId('dataInsightChart');

    const metricType = await screen.findByTestId('metricType');

    expect(chart).toBeInTheDocument();

    expect(metricType).toHaveClass('ant-select-disabled');
  });

  it('Metric type input should not be disable if chart is selected', async () => {
    render(<AddKPIPage />, { wrapper: MemoryRouter });

    const chart = await screen.findByTestId('dataInsightChart');

    const chartInput = await findByRole(chart, 'combobox');

    const metricType = await screen.findByTestId('metricType');

    act(() => {
      userEvent.click(chartInput);
    });

    await waitForElement(() =>
      screen.getByText('Percentage of Entities With Owner')
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Percentage of Entities With Owner'));
    });

    expect(chart).toBeInTheDocument();
    expect(metricType).not.toHaveClass('ant-select-disabled');
  });

  it('Should render the proper metric input based on metric type', async () => {
    render(<AddKPIPage />, { wrapper: MemoryRouter });

    const chart = await screen.findByTestId('dataInsightChart');

    const chartInput = await findByRole(chart, 'combobox');

    const metricType = await screen.findByTestId('metricType');

    const metricInput = await findByRole(metricType, 'combobox');

    act(() => {
      userEvent.click(chartInput);
    });

    await waitForElement(() =>
      screen.getByText('Percentage of Entities With Owner')
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Percentage of Entities With Owner'));
    });

    act(() => {
      userEvent.click(metricInput);
    });

    // check for percentage type
    await waitForElement(() =>
      screen.getByText('hasOwnerFraction (PERCENTAGE)')
    );

    await act(async () => {
      fireEvent.click(screen.getByText('hasOwnerFraction (PERCENTAGE)'));
    });

    expect(
      await screen.findByTestId('metric-percentage-input')
    ).toBeInTheDocument();

    // check for number type
    await waitForElement(() => screen.getByText('hasOwner (NUMBER)'));

    await act(async () => {
      fireEvent.click(screen.getByText('hasOwner (NUMBER)'));
    });

    expect(
      await screen.findByTestId('metric-number-input')
    ).toBeInTheDocument();
  });
});
