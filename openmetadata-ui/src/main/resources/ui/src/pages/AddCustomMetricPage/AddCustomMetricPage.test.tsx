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
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MOCK_TABLE } from '../../mocks/TableData.mock';
import { getTableDetailsByFQN } from '../../rest/tableAPI';
import AddCustomMetricPage from './AddCustomMetricPage';
const mockUseParams = {
  fqn: 'sample_data.ecommerce_db.shopify.dim_address',
  dashboardType: 'table',
};
jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => {
    return jest.fn().mockImplementation(() => <div>TitleBreadcrumb</div>);
  }
);
jest.mock(
  '../../components/DataQuality/CustomMetricForm/CustomMetricForm.component',
  () => {
    return jest.fn().mockImplementation(() => <div>CustomMetricForm</div>);
  }
);
jest.mock(
  '../../components/Database/Profiler/TableProfiler/SingleColumnProfile',
  () => {
    return jest.fn().mockImplementation(() => <div>SingleColumnProfile</div>);
  }
);
jest.mock(
  '../../components/Database/Profiler/TableProfiler/TableProfilerChart/TableProfilerChart',
  () => {
    return jest.fn().mockImplementation(() => <div>TableProfilerChart</div>);
  }
);
jest.mock('../../components/common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader</div>);
});
jest.mock('../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({ search: '' }));
});
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn().mockImplementation(() => mockUseParams),
}));
jest.mock('../../rest/tableAPI', () => ({
  getTableDetailsByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_TABLE)),
}));
jest.mock('../../rest/customMetricAPI', () => ({
  putCustomMetric: jest.fn(),
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

const mockProps = {
  pageTitle: 'add-custom-metric',
};

describe('AddCustomMetricPage', () => {
  it('should render component', async () => {
    render(<AddCustomMetricPage {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    expect(getTableDetailsByFQN).toHaveBeenCalled();

    expect(
      await screen.findByTestId('add-custom-metric-page-container')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('heading')).toBeInTheDocument();
    expect(await screen.findByTestId('cancel-button')).toBeInTheDocument();
    expect(await screen.findByTestId('submit-button')).toBeInTheDocument();
    expect(await screen.findByText('TitleBreadcrumb')).toBeInTheDocument();
    expect(await screen.findByText('CustomMetricForm')).toBeInTheDocument();
    expect(await screen.findByText('TableProfilerChart')).toBeInTheDocument();
  });

  it("should render column profiler if dashboardType is 'column'", async () => {
    mockUseParams.dashboardType = 'column';
    render(<AddCustomMetricPage {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    expect(await screen.findByText('SingleColumnProfile')).toBeInTheDocument();
  });
});
