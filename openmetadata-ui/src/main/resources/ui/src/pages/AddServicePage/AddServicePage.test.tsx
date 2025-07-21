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
import { ServiceCategory } from '../../enums/service.enum';
import { postService } from '../../rest/serviceAPI';
import { getServiceLogo } from '../../utils/CommonUtils';
import { getSettingPath } from '../../utils/RouterUtils';
import * as serviceUtilClassBaseModule from '../../utils/ServiceUtilClassBase';
import { getServiceRouteFromServiceType } from '../../utils/ServiceUtils';
import AddServicePage from './AddServicePage.component';

const mockParam = {
  serviceCategory: 'databaseServices',
};

const mockNavigate = jest.fn();

const mockSetInlineAlertDetails = jest.fn();

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    currentUser: { id: '1', name: 'test-user' },
    setInlineAlertDetails: mockSetInlineAlertDetails,
  }),
}));

jest.mock('../../context/AirflowStatusProvider/AirflowStatusProvider', () => ({
  useAirflowStatus: jest.fn().mockImplementation(() => ({
    platform: 'Argo',
  })),
}));

jest.mock('../../utils/ServiceUtilClassBase', () => ({
  getExtraInfo: jest.fn(),
  getServiceConfigData: jest.fn(),
}));

jest.mock('../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation((Component) => Component),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
  useParams: jest.fn().mockImplementation(() => mockParam),
}));

jest.mock('../../components/common/ResizablePanels/ResizablePanels', () => {
  return jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <div>
      <div>{firstPanel?.children}</div>
      <div>{secondPanel?.children}</div>
    </div>
  ));
});

jest.mock('../../components/common/ServiceDocPanel/ServiceDocPanel', () => {
  return jest.fn().mockImplementation(() => <div>ServiceDocPanel</div>);
});

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => {
    return jest.fn().mockImplementation(() => <div>TitleBreadcrumb</div>);
  }
);

jest.mock(
  '../../components/Settings/Services/AddService/Steps/ConfigureService',
  () => {
    return jest.fn().mockImplementation(({ onNext }) => (
      <div>
        <button
          onClick={() =>
            onNext({ name: 'test-service', description: 'test description' })
          }>
          Configure Service
        </button>
      </div>
    ));
  }
);

jest.mock(
  '../../components/Settings/Services/AddService/Steps/SelectServiceType',
  () => {
    return jest
      .fn()
      .mockImplementation(({ handleServiceTypeClick, onNext, onCancel }) => (
        <div>
          <button onClick={() => handleServiceTypeClick('mysql')}>
            Select MySQL
          </button>
          <button onClick={onNext}>Next</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      ));
  }
);

jest.mock(
  '../../components/Settings/Services/Ingestion/IngestionStepper/IngestionStepper.component',
  () => {
    return jest.fn().mockImplementation(() => <div>IngestionStepper</div>);
  }
);

jest.mock(
  '../../components/Settings/Services/ServiceConfig/ConnectionConfigForm',
  () => {
    return jest.fn().mockImplementation(({ onSave, onCancel }) => (
      <div>
        <button onClick={() => onSave({ formData: { host: 'localhost' } })}>
          Save Connection
        </button>
        <button onClick={onCancel}>Back</button>
      </div>
    ));
  }
);

jest.mock(
  '../../components/Settings/Services/ServiceConfig/FiltersConfigForm',
  () => {
    return jest.fn().mockImplementation(({ onSave, onCancel }) => (
      <div>
        <button onClick={() => onSave({ formData: { filterPattern: {} } })}>
          Save Filters
        </button>
        <button onClick={onCancel}>Back</button>
      </div>
    ));
  }
);

jest.mock('../../rest/serviceAPI', () => ({
  postService: jest.fn().mockImplementation(() =>
    Promise.resolve({
      name: 'test-service',
      fullyQualifiedName: 'test-service',
    })
  ),
}));

jest.mock('../../rest/applicationAPI', () => ({
  triggerOnDemandApp: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../utils/CommonUtils', () => ({
  getServiceLogo: jest.fn(),
}));

jest.mock('../../utils/RouterUtils', () => ({
  getSettingPath: jest.fn(),
  getAddServicePath: jest.fn(),
  getServiceDetailsPath: jest
    .fn()
    .mockImplementation(() => '/service/details/path'),
}));

jest.mock('../../utils/ServiceUtils', () => ({
  getServiceRouteFromServiceType: jest.fn(),
  getAddServiceEntityBreadcrumb: jest.fn().mockReturnValue([]),
  getEntityTypeFromServiceCategory: jest.fn(),
  getServiceType: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockProps = {
  pageTitle: 'add-service',
};

describe('AddServicePage', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the component', async () => {
    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    expect(screen.getByTestId('add-new-service-container')).toBeInTheDocument();
    expect(screen.getByTestId('header')).toHaveTextContent(
      'label.add-new-entity'
    );
  });

  it('should handle service type selection', async () => {
    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    const selectMySQLButton = screen.getByText('Select MySQL');
    await act(async () => {
      fireEvent.click(selectMySQLButton);
    });

    expect(screen.getByTestId('header')).toHaveTextContent(
      'mysql label.service'
    );
    expect(getServiceLogo).toHaveBeenCalledWith('mysql', 'h-6');
  });

  it('should handle service type selection cancel', async () => {
    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    const cancelButton = screen.getByText('Cancel');
    await act(async () => {
      fireEvent.click(cancelButton);
    });

    expect(getSettingPath).toHaveBeenCalled();
    expect(getServiceRouteFromServiceType).toHaveBeenCalledWith(
      ServiceCategory.DATABASE_SERVICES
    );
    expect(mockNavigate).toHaveBeenCalled();
  });

  it('should show error when trying to proceed without selecting service type', async () => {
    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    const nextButton = screen.getByText('Next');
    await act(async () => {
      fireEvent.click(nextButton);
    });

    expect(screen.getByTestId('add-new-service-container')).toBeInTheDocument();
  });

  it('should handle connection configuration', async () => {
    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    // First select a service type
    const selectMySQLButton = screen.getByText('Select MySQL');
    await act(async () => {
      fireEvent.click(selectMySQLButton);
    });

    // Move to next step
    const nextButton = screen.getByText('Next');
    await act(async () => {
      fireEvent.click(nextButton);
    });

    // Configure service
    const configureButton = screen.getByText('Configure Service');
    await act(async () => {
      fireEvent.click(configureButton);
    });

    // Save connection
    const saveConnectionButton = screen.getByText('Save Connection');
    await act(async () => {
      fireEvent.click(saveConnectionButton);
    });

    expect(screen.getByText('Save Filters')).toBeInTheDocument();
  });

  it('should handle service creation success', async () => {
    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    // Select service type
    const selectMySQLButton = screen.getByText('Select MySQL');
    await act(async () => {
      fireEvent.click(selectMySQLButton);
    });

    // Move through the steps
    const nextButton = screen.getByText('Next');
    await act(async () => {
      fireEvent.click(nextButton);
    });

    // Configure service
    const configureButton = screen.getByText('Configure Service');
    await act(async () => {
      fireEvent.click(configureButton);
    });

    // Save connection
    const saveConnectionButton = screen.getByText('Save Connection');
    await act(async () => {
      fireEvent.click(saveConnectionButton);
    });

    // Save filters
    const saveFiltersButton = screen.getByText('Save Filters');
    await act(async () => {
      fireEvent.click(saveFiltersButton);
    });

    expect(postService).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/service/details/path');
  });

  it('should handle back navigation in connection configuration', async () => {
    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    // Select service type
    const selectMySQLButton = screen.getByText('Select MySQL');
    await act(async () => {
      fireEvent.click(selectMySQLButton);
    });

    // Move to next step
    const nextButton = screen.getByText('Next');
    await act(async () => {
      fireEvent.click(nextButton);
    });

    // Configure service
    const configureButton = screen.getByText('Configure Service');
    await act(async () => {
      fireEvent.click(configureButton);
    });

    // Click back in connection config
    const backButton = screen.getByText('Back');
    await act(async () => {
      fireEvent.click(backButton);
    });

    expect(screen.getByText('Configure Service')).toBeInTheDocument();
  });

  it.skip('should handle service creation failure', async () => {
    (postService as jest.Mock).mockImplementation(() =>
      Promise.reject('Some error')
    );

    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    // Select service type
    const selectMySQLButton = screen.getByText('Select MySQL');
    await act(async () => {
      fireEvent.click(selectMySQLButton);
    });

    // Move through the steps
    const nextButton = screen.getByText('Next');
    await act(async () => {
      fireEvent.click(nextButton);
    });

    // Configure service
    const configureButton = screen.getByText('Configure Service');
    await act(async () => {
      fireEvent.click(configureButton);
    });

    // Save connection
    const saveConnectionButton = screen.getByText('Save Connection');
    await act(async () => {
      fireEvent.click(saveConnectionButton);
    });

    // Save filters
    const saveFiltersButton = screen.getByText('Save Filters');
    await act(async () => {
      fireEvent.click(saveFiltersButton);
    });

    expect(postService).toHaveBeenCalled();
    expect(mockSetInlineAlertDetails).toHaveBeenCalled();
  });

  it('calls getExtraInfo', () => {
    const mockGetExtraInfo = serviceUtilClassBaseModule.default
      .getExtraInfo as jest.Mock;
    render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });

    expect(mockGetExtraInfo).toHaveBeenCalled();
  });
});
