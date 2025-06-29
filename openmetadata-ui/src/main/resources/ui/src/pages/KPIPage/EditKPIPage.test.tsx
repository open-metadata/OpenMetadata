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
import { MemoryRouter } from 'react-router-dom';
import EditKPIPage from './EditKPIPage';
import { KPI_DATA } from './KPIMock.mock';

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({ useParams: 'description-kpi' }),
  useNavigate: jest.fn(),
}));

jest.mock('../../components/common/RichTextEditor/RichTextEditor', () =>
  jest.fn().mockReturnValue(<div data-testid="editor">Editor</div>)
);

jest.mock('../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation((Component) => Component),
}));

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () =>
    jest.fn().mockReturnValue(<div data-testid="breadcrumb">BreadCrumb</div>)
);

jest.mock('../../components/common/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div data-testid="loader">Loader</div>)
);

jest.mock('../../rest/KpiAPI', () => ({
  getKPIByName: jest.fn().mockImplementation(() => Promise.resolve(KPI_DATA)),
  patchKPI: jest.fn().mockImplementation(() => Promise.resolve(KPI_DATA)),
}));

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: true }),
}));

jest.mock('../../utils/DataInsightUtils', () => ({
  ...jest.requireActual('../../utils/DataInsightUtils'),
  getKpiTargetValueByMetricType: jest.fn().mockReturnValue(10),
  getDisabledDates: jest.fn().mockReturnValue(true),
  getDataInsightPathWithFqn: jest.fn().mockReturnValue(''),
}));

jest.mock('../../components/common/ResizablePanels/ResizablePanels', () =>
  jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <>
      <div>{firstPanel.children}</div>
      <div>{secondPanel.children}</div>
    </>
  ))
);

jest.mock('../../constants/DataInsight.constants', () => ({
  KPI_DATE_PICKER_FORMAT: 'YYY-MM-DD',
}));

jest.mock('../../components/common/DatePicker/DatePicker', () =>
  jest.fn().mockImplementation((props) => <input type="text" {...props} />)
);

const mockProps = {
  pageTitle: 'edit-kpi',
};

describe('Edit KPI page', () => {
  it('Should render all the components', async () => {
    render(<EditKPIPage {...mockProps} />, { wrapper: MemoryRouter });

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
    render(<EditKPIPage {...mockProps} />, { wrapper: MemoryRouter });

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

  it('Chart input and Metric type input should be disable for edit form', async () => {
    render(<EditKPIPage {...mockProps} />, { wrapper: MemoryRouter });

    const chart = await screen.findByTestId('chartType');

    const metricType = await screen.findByTestId('metricType');

    expect(chart).toHaveClass('ant-select-disabled');

    expect(metricType).toHaveClass('ant-select-disabled');
  });
});
