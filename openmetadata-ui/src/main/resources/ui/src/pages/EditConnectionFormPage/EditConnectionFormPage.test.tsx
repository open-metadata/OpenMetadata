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
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { getServiceByFQN, patchService } from '../../rest/serviceAPI';
import EditConnectionFormPage from './EditConnectionFormPage.component';

const mockServiceData = {
  id: 'a831deb9-143e-4832-9eb2-82f635b6964b',
  name: 'mySQL',
  fullyQualifiedName: 'mySQL',
  serviceType: 'Mysql',
  connection: {
    config: {
      type: 'Mysql',
      scheme: 'mysql+pymysql',
      username: 'openmetadata_user',
      authType: {
        password: '*********',
      },
      hostPort: 'host.docker.internal:3306',
      supportsMetadataExtraction: true,
      supportsDBTExtraction: true,
      supportsProfiler: true,
      supportsQueryComment: true,
    },
  },
};

const ERROR = 'Error';

const mockNavigate = jest.fn();

jest.mock('../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn(() => <div>ErrorPlaceHolder</div>)
);

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

jest.mock('../../components/common/ServiceDocPanel/ServiceDocPanel', () =>
  jest.fn().mockImplementation(({ activeField }) => (
    <div data-testid="service-doc-panel">
      <div>ServiceDocPanel</div>
      <div data-testid="active-field">{activeField}</div>
    </div>
  ))
);

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn(() => <div>TitleBreadcrumb</div>)
);

jest.mock('../../components/common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);

jest.mock(
  '../../components/Settings/Services/ServiceConfig/ConnectionConfigForm',
  () =>
    jest.fn().mockImplementation(({ onSave, onCancel, onFocus }) => (
      <div>
        <div>ConnectionConfigForm</div>
        <button
          data-testid="next-button"
          onClick={() => onSave({ formData: { testData: 'test' } })}>
          label.next
        </button>
        <button data-testid="cancel-button" onClick={onCancel}>
          label.back
        </button>
        <input
          data-testid="connection-field"
          type="text"
          onFocus={() => onFocus('testField')}
        />
      </div>
    ))
);

jest.mock(
  '../../components/Settings/Services/ServiceConfig/FiltersConfigForm',
  () =>
    jest.fn().mockImplementation(({ onSave, onCancel }) => (
      <div>
        <div>FiltersConfigForm</div>
        <button onClick={() => onSave({ formData: { testData: 'test' } })}>
          label.save
        </button>
        <button onClick={onCancel}>label.back</button>
      </div>
    ))
);

jest.mock(
  '../../components/Settings/Services/Ingestion/IngestionStepper/IngestionStepper.component',
  () => jest.fn().mockImplementation(() => <div>IngestionStepper</div>)
);

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockImplementation(() => ({ fqn: '' })),
}));

jest.mock('../../rest/serviceAPI', () => ({
  getServiceByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockServiceData)),
  patchService: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockServiceData)),
}));

jest.mock('../../utils/CommonUtils', () => ({
  getEntityMissingError: jest.fn(),
  getServiceLogo: jest.fn().mockReturnValue(''),
}));

jest.mock('../../utils/EntityUtils', () => ({
  getEntityName: jest.fn(),
}));

jest.mock('../../utils/RouterUtils', () => ({
  getPathByServiceFQN: jest.fn(),
  getSettingPath: jest.fn(),
}));

jest.mock('../../utils/ServiceUtilClassBase', () => ({
  getEditConfigData: jest.fn().mockReturnValue({}),
  setEditServiceDetails: jest.fn(),
}));

const mockGetServiceType = jest.fn().mockReturnValue('database');

jest.mock('../../utils/ServiceUtils', () => ({
  getServiceRouteFromServiceType: jest.fn(),
  getServiceType: jest.fn((category) => mockGetServiceType(category)),
}));

const mockShowErrorToast = jest.fn();

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn((...args) => mockShowErrorToast(...args)),
}));

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({ serviceCategory: 'databaseServices' }),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

const mockProps = {
  pageTitle: 'edit-connection',
};

describe('EditConnectionFormPage component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all necessary elements', async () => {
    const mockGetServiceByFQN = getServiceByFQN as jest.Mock;
    await act(async () => {
      render(<EditConnectionFormPage {...mockProps} />);
    });

    expect(mockGetServiceByFQN).toHaveBeenCalled();
    expect(screen.getByText('TitleBreadcrumb')).toBeInTheDocument();
    expect(
      screen.getByText('message.edit-service-entity-connection')
    ).toBeInTheDocument();
    expect(screen.getByText('ServiceDocPanel')).toBeInTheDocument();
  });

  it('should show ErrorPlaceHolder if get 404 error during service fetch', async () => {
    (getServiceByFQN as jest.Mock).mockRejectedValueOnce({
      response: {
        status: 404,
      },
    });

    await act(async () => {
      render(<EditConnectionFormPage {...mockProps} />);
    });

    expect(screen.getByText('ErrorPlaceHolder')).toBeInTheDocument();
  });

  it('showErrorTost should be call when GetServiceByFQN fails', async () => {
    (getServiceByFQN as jest.Mock).mockRejectedValueOnce(ERROR);

    await act(async () => {
      render(<EditConnectionFormPage {...mockProps} />);
    });

    expect(mockShowErrorToast).toHaveBeenCalledTimes(1);
  });

  it('should handle form submission in step 1', async () => {
    await act(async () => {
      render(<EditConnectionFormPage {...mockProps} />);
    });

    const nextButton = screen.getByText('label.next');
    await act(async () => {
      fireEvent.click(nextButton);
    });

    expect(screen.getByText('FiltersConfigForm')).toBeInTheDocument();
  });

  it('should handle back navigation from step 2 to step 1', async () => {
    await act(async () => {
      render(<EditConnectionFormPage {...mockProps} />);
    });

    // Move to step 2
    const nextButton = screen.getByText('label.next');
    await act(async () => {
      fireEvent.click(nextButton);
    });

    // Click back button
    const backButton = screen.getByText('label.back');
    await act(async () => {
      fireEvent.click(backButton);
    });

    expect(screen.getByText('ConnectionConfigForm')).toBeInTheDocument();
  });

  it('should handle service update in step 2', async () => {
    const mockPatchService = patchService as jest.Mock;

    await act(async () => {
      render(<EditConnectionFormPage {...mockProps} />);
    });

    // Move to step 2
    const nextButton = screen.getByText('label.next');
    await act(async () => {
      fireEvent.click(nextButton);
    });

    // Submit form in step 2
    const saveButton = screen.getByText('label.save');
    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(mockPatchService).toHaveBeenCalled();
  });

  it('should handle service update error in step 2', async () => {
    const mockPatchService = patchService as jest.Mock;
    mockPatchService.mockRejectedValueOnce(new Error('Update failed'));

    await act(async () => {
      render(<EditConnectionFormPage {...mockProps} />);
    });

    // Move to step 2
    const nextButton = screen.getByText('label.next');
    await act(async () => {
      fireEvent.click(nextButton);
    });

    // Submit form in step 2
    const saveButton = screen.getByText('label.save');
    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(mockShowErrorToast).toHaveBeenCalled();
  });

  it('should handle field focus', async () => {
    render(<EditConnectionFormPage {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('connection-field')).toBeInTheDocument();
    });

    const inputField = screen.getByTestId('connection-field');
    fireEvent.focus(inputField);

    await waitFor(() => {
      const activeFieldElement = screen.getByTestId('active-field');

      expect(activeFieldElement).toHaveTextContent('testField');
    });
  });

  it('should handle cancel button click', async () => {
    render(<EditConnectionFormPage {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
    });

    const cancelButton = screen.getByTestId('cancel-button');
    fireEvent.click(cancelButton);

    expect(mockNavigate).toHaveBeenCalled();
  });

  it('should show loader while fetching service details', async () => {
    const mockGetServiceByFQN = getServiceByFQN as jest.Mock;
    mockGetServiceByFQN.mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(mockServiceData), 100)
        )
    );

    render(<EditConnectionFormPage {...mockProps} />);

    expect(screen.getByText('Loader')).toBeInTheDocument();
  });
});
