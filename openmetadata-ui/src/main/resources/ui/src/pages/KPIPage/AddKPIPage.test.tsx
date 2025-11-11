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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AddKPIPage from './AddKPIPage';
import { KPI_DATA, KPI_LIST } from './KPIMock.mock';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

jest.mock('../../components/common/RichTextEditor/RichTextEditor', () =>
  jest.fn().mockReturnValue(<div data-testid="editor">Editor</div>)
);

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () =>
    jest.fn().mockReturnValue(<div data-testid="breadcrumb">BreadCrumb</div>)
);

jest.mock('../../rest/KpiAPI', () => ({
  getListKPIs: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: KPI_LIST })),
  postKPI: jest.fn().mockImplementation(() => Promise.resolve(KPI_DATA)),
}));

jest.mock('../../utils/CommonUtils', () => ({
  isUrlFriendlyName: jest.fn().mockReturnValue(true),
}));

jest.mock('../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation((Component) => Component),
}));

jest.mock('../../components/common/ResizablePanels/ResizablePanels', () =>
  jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <>
      <div>{firstPanel.children}</div>
      <div>{secondPanel.children}</div>
    </>
  ))
);

jest.mock('../../utils/DataInsightUtils', () => ({
  ...jest.requireActual('../../utils/DataInsightUtils'),
  getKpiTargetValueByMetricType: jest.fn().mockReturnValue(10),
  getDisabledDates: jest.fn().mockReturnValue(true),
}));

jest.mock('../../constants/DataInsight.constants', () => ({
  KPI_DATE_PICKER_FORMAT: 'YYY-MM-DD',
}));

const mockProps = {
  pageTitle: 'add-kpi',
};

describe('Add KPI page', () => {
  it('Should render all the components', async () => {
    render(<AddKPIPage {...mockProps} />, { wrapper: MemoryRouter });

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
    render(<AddKPIPage {...mockProps} />, { wrapper: MemoryRouter });

    const formContainer = await screen.findByTestId('kpi-form');

    const chart = await screen.findByTestId('chartType');
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

  it('should show validation error when description is empty', async () => {
    render(<AddKPIPage {...mockProps} />, { wrapper: MemoryRouter });

    const submitButton = await screen.findByTestId('submit-btn');

    await act(async () => {
      fireEvent.click(submitButton);
    });

    const validationMessages = await screen.findAllByText(
      'label.field-required'
    );
    // we have start date and end date field with the same label, hence we have 3 validation messages
    // and description is the last field in the form
    const lastValidationMessage =
      validationMessages[validationMessages.length - 1];

    expect(lastValidationMessage).toBeInTheDocument();
  });
});
