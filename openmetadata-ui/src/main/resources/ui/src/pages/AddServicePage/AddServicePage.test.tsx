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

import { fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useAirflowStatus } from '../../context/AirflowStatusProvider/AirflowStatusProvider';
import { EntityType } from '../../enums/entity.enum';
import { triggerOnDemandApp } from '../../rest/applicationAPI';
import { getServiceByFQN, postService } from '../../rest/serviceAPI';
import { getServiceLogo } from '../../utils/EntityDisplayUtils';
import { getEntityTypeFromServiceCategory } from '../../utils/ServicePureUtils';
import * as serviceUtilClassBaseModule from '../../utils/ServiceUtilClassBase';
import AddServicePage from './AddServicePage.component';

const EXISTING_SERVICE = 'existing-service' as const;
const SERVICE_NAME_ERROR = 'service-name-error' as const;
const MODAL_LEAVE = 'modal-leave' as const;
const TRIGGER_ADDITIONAL_VALIDATION = 'trigger-additional-validation' as const;
const LABEL_ADD_NEW_ENTITY = 'label.add-new-entity' as const;
const SELECT_MY_SQL = 'Select MySQL' as const;
const SET_SERVICE_NAME = 'Set Service Name' as const;
const SAVE_CONNECTION = 'Save Connection' as const;
const SAVE_FILTERS = 'Save Filters' as const;

const mockParam = {
  serviceCategory: 'databaseServices',
};

const mockNavigate = jest.fn();

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    currentUser: { id: '1', name: 'test-user' },
    setInlineAlertDetails: jest.fn(),
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
  return jest
    .fn()
    .mockImplementation(({ activeField }) => (
      <div data-testid="service-doc-panel">ServiceDocPanel:{activeField}</div>
    ));
});

jest.mock(
  '../../components/Settings/Services/AddService/ServiceNameCard/ServiceNameCard',
  () => {
    return jest
      .fn()
      .mockImplementation(
        ({ nameError, onDescriptionChange, onFocus, onNameChange }) => (
          <div>
            {/* eslint-disable-next-line sonarjs/no-duplicate-string */}
            <button onClick={() => onNameChange('test-service')}>
              Set Service Name
            </button>
            <button onClick={() => onNameChange('existing-service')}>
              Set Existing Service Name
            </button>
            <button onClick={() => onDescriptionChange('description')}>
              Set Description
            </button>
            <button onClick={() => onFocus('')}>Focus Empty Field</button>
            <button onClick={() => onFocus('account')}>Focus Account</button>
            {nameError && (
              <div data-testid="service-name-error">{nameError}</div>
            )}
          </div>
        )
      );
  }
);

jest.mock(
  '../../components/Settings/Services/AddService/Steps/SelectServiceType',
  () => {
    return jest
      .fn()
      .mockImplementation(
        ({ handleServiceTypeClick, serviceCategoryHandler }) => (
          <div>
            <button onClick={() => handleServiceTypeClick('mysql')}>
              Select MySQL
            </button>
            <button onClick={() => serviceCategoryHandler('messagingServices')}>
              Change Category
            </button>
          </div>
        )
      );
  }
);

jest.mock(
  '../../components/Settings/Services/Ingestion/IngestionStepper/IngestionStepper.component',
  () => {
    return jest.fn().mockImplementation(() => <div>IngestionStepper</div>);
  }
);

jest.mock(
  '../../components/common/NavigationGuardModal/NavigationGuardModal',
  () => ({
    NavigationGuardModal: jest.fn().mockImplementation(({ isOpen, onLeave }) =>
      isOpen ? (
        <button data-testid="modal-leave" onClick={onLeave}>
          Leave
        </button>
      ) : null
    ),
  })
);

const mockConnectionConfigFormProps = jest.fn();

jest.mock(
  '../../components/Settings/Services/ServiceConfig/ConnectionConfigForm',
  () => {
    return jest
      .fn()
      .mockImplementation(
        ({
          isAdditionalValidationPending,
          onSave,
          onValidateAdditionalRequiredFields,
        }) => {
          mockConnectionConfigFormProps({
            isAdditionalValidationPending,
            onSave,
            onValidateAdditionalRequiredFields,
          });

          return (
            <div>
              <button
                onClick={() => onSave({ formData: { host: 'localhost' } })}>
                Save Connection
              </button>
              <button
                data-testid="trigger-additional-validation"
                onClick={() => onValidateAdditionalRequiredFields?.()}>
                Validate Additional Fields
              </button>
            </div>
          );
        }
      );
  }
);

jest.mock(
  '../../components/Settings/Services/ServiceConfig/FiltersConfigForm',
  () => {
    return jest.fn().mockImplementation(({ onSave }) => (
      <div>
        <button onClick={() => onSave({ formData: { filterPattern: {} } })}>
          Save Filters
        </button>
      </div>
    ));
  }
);

jest.mock('../../rest/serviceAPI', () => ({
  getServiceByFQN: jest.fn().mockRejectedValue({
    response: {
      status: 404,
    },
  }),
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

jest.mock('../../utils/EntityDisplayUtils', () => ({
  getServiceLogo: jest.fn(),
}));

jest.mock('../../utils/RouterUtils', () => ({
  getSettingPath: jest.fn(),
  getAddServicePath: jest.fn(),
  getServiceDetailsPath: jest
    .fn()
    // eslint-disable-next-line sonarjs/no-duplicate-string
    .mockImplementation(() => '/service/details/path'),
}));

jest.mock('../../utils/ConnectionsRouterClassBase', () => ({
  __esModule: true,
  default: {
    getAddServicePath: jest
      .fn()
      .mockImplementation((category) => `/add-service/${category}`),
    getServiceDetailsPath: jest
      .fn()
      .mockImplementation(() => '/service/details/path'),
  },
}));

jest.mock('../../utils/ServicePureUtils', () => ({
  getEntityTypeFromServiceCategory: jest.fn(),
  getServiceRouteFromServiceType: jest.fn(),
  getServiceType: jest.fn(),
}));

jest.mock('../../utils/ServiceUtils', () => ({
  getAddServiceEntityBreadcrumb: jest.fn().mockReturnValue([]),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const baseAirflowMock = {
  isFetchingStatus: false,
  isAirflowAvailable: true,
  error: undefined,
  reason: '',
  fetchAirflowStatus: jest.fn(),
};

const mockProps = {
  pageTitle: 'add-service',
};

describe('AddServicePage', () => {
  beforeEach(() => {
    (getServiceByFQN as jest.Mock).mockRejectedValue({
      response: {
        status: 404,
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should render the component', async () => {
    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    expect(screen.getByTestId('add-new-service-container')).toBeInTheDocument();
    expect(screen.getByTestId('header')).toHaveTextContent(
      LABEL_ADD_NEW_ENTITY
    );
  });

  it('should handle service type selection', async () => {
    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    const selectMySQLButton = screen.getByText(SELECT_MY_SQL);
    await act(async () => {
      fireEvent.click(selectMySQLButton);
    });

    expect(screen.getByTestId('header')).toHaveTextContent(
      'mysql label.service'
    );
    expect(getServiceLogo).toHaveBeenCalledWith(
      'mysql',
      'tw:size-10 tw:max-w-10 tw:max-h-10 tw:object-contain'
    );
  });

  it('should handle service category changes from connector picker', async () => {
    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Change Category'));
    });

    expect(mockNavigate).toHaveBeenCalledWith('/add-service/messagingServices');
  });

  it('should reset selected connector from add service breadcrumb', async () => {
    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SELECT_MY_SQL));
    });

    expect(screen.getByTestId('header')).toHaveTextContent(
      'mysql label.service'
    );
    expect(screen.queryByText(SELECT_MY_SQL)).not.toBeInTheDocument();

    // Clicking the breadcrumb shows a confirmation modal (activeServiceStep > 1)
    await act(async () => {
      fireEvent.click(screen.getByText(LABEL_ADD_NEW_ENTITY));
    });

    // Confirm leaving to reset the selected connector
    await act(async () => {
      fireEvent.click(screen.getByTestId(MODAL_LEAVE));
    });

    expect(screen.getByTestId('header')).toHaveTextContent(
      LABEL_ADD_NEW_ENTITY
    );
    expect(screen.getByText(SELECT_MY_SQL)).toBeInTheDocument();
  });

  it('should handle connection configuration', async () => {
    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    const selectMySQLButton = screen.getByText(SELECT_MY_SQL);
    await act(async () => {
      fireEvent.click(selectMySQLButton);
    });

    const setNameButton = screen.getByText(SET_SERVICE_NAME);
    await act(async () => {
      fireEvent.click(setNameButton);
    });

    const saveConnectionButton = screen.getByText(SAVE_CONNECTION);
    await act(async () => {
      fireEvent.click(saveConnectionButton);
    });

    expect(await screen.findByText(SAVE_FILTERS)).toBeInTheDocument();
  });

  it('updates description and focused docs field from the connection step', async () => {
    jest.useFakeTimers();

    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SELECT_MY_SQL));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Set Description'));
      fireEvent.click(screen.getByText('Focus Empty Field'));
    });

    expect(screen.getByTestId('service-doc-panel')).toHaveTextContent(
      'ServiceDocPanel:'
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Focus Account'));
      jest.advanceTimersByTime(50);
    });

    expect(screen.getByTestId('service-doc-panel')).toHaveTextContent(
      'ServiceDocPanel:account'
    );
  });

  it('requires a service name before moving to filters', async () => {
    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SELECT_MY_SQL));
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SAVE_CONNECTION));
    });

    expect(await screen.findByTestId(SERVICE_NAME_ERROR)).toHaveTextContent(
      'message.field-text-is-required'
    );
    expect(screen.queryByText(SAVE_FILTERS)).not.toBeInTheDocument();
  });

  it('should flag duplicate service names before moving to filters', async () => {
    (getServiceByFQN as jest.Mock).mockResolvedValueOnce({
      name: EXISTING_SERVICE,
    });

    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SELECT_MY_SQL));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Set Existing Service Name'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SAVE_CONNECTION));
    });

    expect(await screen.findByTestId(SERVICE_NAME_ERROR)).toHaveTextContent(
      'message.service-name-already-exists-with-suggestion'
    );
    expect(screen.queryByText(SAVE_FILTERS)).not.toBeInTheDocument();
    expect(
      serviceUtilClassBaseModule.default.getServiceConfigData
    ).not.toHaveBeenCalled();
  });

  it('should flag duplicate service names while editing the connection form', async () => {
    jest.useFakeTimers();
    (getServiceByFQN as jest.Mock).mockResolvedValue({
      name: EXISTING_SERVICE,
    });

    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SELECT_MY_SQL));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Set Existing Service Name'));
    });

    await act(async () => {
      jest.advanceTimersByTime(400);
      await Promise.resolve();
    });

    expect(screen.getByTestId(SERVICE_NAME_ERROR)).toHaveTextContent(
      'message.service-name-already-exists-with-suggestion'
    );
    expect(getServiceByFQN).toHaveBeenCalledWith(
      'databaseServices',
      EXISTING_SERVICE
    );
  });

  it('should handle service creation success', async () => {
    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    const selectMySQLButton = screen.getByText(SELECT_MY_SQL);
    await act(async () => {
      fireEvent.click(selectMySQLButton);
    });

    const setNameButton = screen.getByText(SET_SERVICE_NAME);
    await act(async () => {
      fireEvent.click(setNameButton);
    });

    const saveConnectionButton = screen.getByText(SAVE_CONNECTION);
    await act(async () => {
      fireEvent.click(saveConnectionButton);
    });

    const saveFiltersButton = await screen.findByText(SAVE_FILTERS);
    await act(async () => {
      fireEvent.click(saveFiltersButton);
    });

    expect(postService).toHaveBeenCalled();
    expect(triggerOnDemandApp).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/service/details/path');
  });

  it('should still navigate after service creation error', async () => {
    (postService as jest.Mock).mockRejectedValueOnce(new Error('failed'));

    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SELECT_MY_SQL));
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SET_SERVICE_NAME));
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SAVE_CONNECTION));
    });

    await act(async () => {
      fireEvent.click(await screen.findByText(SAVE_FILTERS));
    });

    expect(mockNavigate).toHaveBeenCalledWith('/service/details/path');
  });

  it('should handle auto pilot trigger errors without blocking navigation', async () => {
    (triggerOnDemandApp as jest.Mock).mockRejectedValueOnce(
      new Error('autopilot failed')
    );

    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SELECT_MY_SQL));
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SET_SERVICE_NAME));
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SAVE_CONNECTION));
    });

    await act(async () => {
      fireEvent.click(await screen.findByText(SAVE_FILTERS));
    });

    expect(triggerOnDemandApp).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/service/details/path');
  });

  it('returns to the connection step from filters', async () => {
    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SELECT_MY_SQL));
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SET_SERVICE_NAME));
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SAVE_CONNECTION));
    });

    // Footer Back button shows a confirmation modal before going back
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'label.back' }));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId(MODAL_LEAVE));
    });

    expect(screen.getByText(SAVE_CONNECTION)).toBeInTheDocument();
  });

  it('should handle back navigation in connection configuration', async () => {
    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    const selectMySQLButton = screen.getByText(SELECT_MY_SQL);
    await act(async () => {
      fireEvent.click(selectMySQLButton);
    });

    // Footer Back button shows a confirmation modal before going back to step 1
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'label.back' }));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId(MODAL_LEAVE));
    });

    expect(screen.getByText(SELECT_MY_SQL)).toBeInTheDocument();
  });

  it('should not trigger auto pilot application for security service', async () => {
    (getEntityTypeFromServiceCategory as jest.Mock).mockReturnValue(
      EntityType.SECURITY_SERVICE
    );
    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    const selectMySQLButton = screen.getByText(SELECT_MY_SQL);
    await act(async () => {
      fireEvent.click(selectMySQLButton);
    });

    const setNameButton = screen.getByText(SET_SERVICE_NAME);
    await act(async () => {
      fireEvent.click(setNameButton);
    });

    const saveConnectionButton = screen.getByText(SAVE_CONNECTION);
    await act(async () => {
      fireEvent.click(saveConnectionButton);
    });

    const saveFiltersButton = await screen.findByText(SAVE_FILTERS);
    await act(async () => {
      fireEvent.click(saveFiltersButton);
    });

    expect(postService).toHaveBeenCalled();
    expect(triggerOnDemandApp).not.toHaveBeenCalled();
  });

  it('calls getExtraInfo', () => {
    (useAirflowStatus as jest.Mock).mockReturnValue({
      ...baseAirflowMock,
    });

    const mockGetExtraInfo = serviceUtilClassBaseModule.default
      .getExtraInfo as jest.Mock;
    render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });

    expect(mockGetExtraInfo).toHaveBeenCalled();
  });

  it('should set name error and block test connection when service name is empty', async () => {
    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SELECT_MY_SQL));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId(TRIGGER_ADDITIONAL_VALIDATION));
    });

    expect(await screen.findByTestId(SERVICE_NAME_ERROR)).toHaveTextContent(
      'message.field-text-is-required'
    );
  });

  it('should not set name error when service name is filled before test connection', async () => {
    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SELECT_MY_SQL));
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SET_SERVICE_NAME));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId(TRIGGER_ADDITIONAL_VALIDATION));
    });

    expect(screen.queryByTestId(SERVICE_NAME_ERROR)).not.toBeInTheDocument();
  });

  it('should pass onValidateAdditionalRequiredFields to ConnectionConfigForm', async () => {
    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SELECT_MY_SQL));
    });

    const lastProps = mockConnectionConfigFormProps.mock.calls.at(-1)?.[0];

    expect(typeof lastProps.onValidateAdditionalRequiredFields).toBe(
      'function'
    );
  });

  it('should mark additional validation pending while checking a service name', async () => {
    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SELECT_MY_SQL));
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SET_SERVICE_NAME));
    });

    const lastProps = mockConnectionConfigFormProps.mock.calls.at(-1)?.[0];

    expect(lastProps.isAdditionalValidationPending).toBe(true);
  });

  it('should focus the service name input when additional validation fails on empty name', async () => {
    const mockFocus = jest.fn();
    jest
      .spyOn(document, 'getElementById')
      .mockReturnValue({ focus: mockFocus } as unknown as HTMLElement);

    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SELECT_MY_SQL));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId(TRIGGER_ADDITIONAL_VALIDATION));
    });

    expect(document.getElementById).toHaveBeenCalledWith('service-name');
    expect(mockFocus).toHaveBeenCalled();
  });

  it('should focus the service name input when next is clicked with empty name via Save Connection', async () => {
    const mockFocus = jest.fn();
    jest
      .spyOn(document, 'getElementById')
      .mockReturnValue({ focus: mockFocus } as unknown as HTMLElement);

    await act(async () => {
      render(<AddServicePage {...mockProps} />, { wrapper: MemoryRouter });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SELECT_MY_SQL));
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SAVE_CONNECTION));
    });

    expect(document.getElementById).toHaveBeenCalledWith('service-name');
    expect(mockFocus).toHaveBeenCalled();
  });
});
