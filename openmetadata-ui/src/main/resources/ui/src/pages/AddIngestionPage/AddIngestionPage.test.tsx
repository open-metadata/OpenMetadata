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
import {
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAirflowStatus } from '../../context/AirflowStatusProvider/AirflowStatusProvider';
import { useFqn } from '../../hooks/useFqn';
import AddIngestionPage from './AddIngestionPage.component';
const mockShowErrorToast = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn().mockImplementation(() => ({
    ingestionType: 'fqn',
    serviceCategory: 'databaseServices',
  })),
}));

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockImplementation(() => ({ fqn: 'testFqn' })),
}));

jest.mock('../../context/AirflowStatusProvider/AirflowStatusProvider', () => ({
  useAirflowStatus: jest.fn().mockImplementation(() => ({
    fetchAirflowStatus: jest.fn().mockImplementation(() => Promise.resolve()),
  })),
}));

jest.mock('../../rest/serviceAPI', () => ({
  getServiceByFQN: jest.fn().mockImplementation(() =>
    Promise.resolve({
      deleted: false,
      fullyQualifiedName: 'sample_data',
      href: 'http://localhost:8585/api/v1/services/databaseServices/0f74bba0-b34b-48e9-a68e-19f165adbeb6',
      id: '0f74bba0-b34b-48e9-a68e-19f165adbeb6',
      name: 'sample_data',
      serviceType: 'BigQuery',
      updatedAt: 1706852930787,
      updatedBy: 'admin',
      version: 0.1,
    })
  ),
}));

jest.mock('../../components/common/ServiceDocPanel/ServiceDocPanel', () =>
  jest.fn().mockImplementation(() => <div>ServiceDocPanel</div>)
);

jest.mock('../../utils/ServiceUtils', () => ({
  getServiceType: jest.fn(),
}));

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn().mockImplementation(() => <div>TitleBreadcrumb</div>)
);

jest.mock(
  '../../components/Settings/Services/AddIngestion/AddIngestion.component',
  () => jest.fn().mockImplementation(() => <div>AddIngestion</div>)
);

jest.mock('../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation((Component) => Component),
}));

jest.mock('../../rest/ingestionPipelineAPI', () => ({
  addIngestionPipeline: jest.fn().mockReturnValue(() => Promise.resolve({})),
  deployIngestionPipelineById: jest
    .fn()
    .mockReturnValue(() => Promise.resolve({})),
  getIngestionPipelineByFqn: jest
    .fn()
    .mockReturnValue(() => Promise.resolve({})),
}));

jest.mock('../../utils/IngestionUtils', () => ({
  getBreadCrumbsArray: jest.fn().mockImplementation(() => [{ name: '' }]),
  getIngestionHeadingName: jest.fn().mockImplementation(() => 'Ingestion'),
  getSettingsPathFromPipelineType: jest.fn().mockImplementation(() => ''),
}));

jest.mock('../../utils/CommonUtils', () => ({
  getEntityMissingError: jest.fn().mockImplementation(() => <div>Error</div>),
}));

jest.mock('../../components/common/ResizablePanels/ResizablePanels', () =>
  jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <>
      <div>{firstPanel.children}</div>
      <div>{secondPanel.children}</div>
    </>
  ))
);
jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn().mockImplementation(() => mockShowErrorToast),
}));

const mockProps = {
  pageTitle: 'add-ingestion',
};

describe('Test AddIngestionPage component', () => {
  beforeEach(() => {
    (useAirflowStatus as jest.Mock).mockReturnValue({
      fetchAirflowStatus: jest
        .fn()
        .mockImplementation(() => Promise.resolve({})),
    });

    (useFqn as jest.Mock).mockReturnValue({
      fqn: 'testFqn',
    });
  });

  it('AddIngestionPage component should render', async () => {
    render(
      <MemoryRouter
        initialEntries={['/addIngestion/databaseServices/testIngestionType']}>
        <Routes>
          <Route
            element={<AddIngestionPage {...mockProps} />}
            path="/addIngestion/:serviceCategory/:ingestionType"
          />
        </Routes>
      </MemoryRouter>
    );

    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    expect(screen.getByText('TitleBreadcrumb')).toBeInTheDocument();
    expect(screen.getByText('AddIngestion')).toBeInTheDocument();
    expect(screen.getByText('ServiceDocPanel')).toBeInTheDocument();
  });
});
