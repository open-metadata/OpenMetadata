/*
 *  Copyright 2026 Collate.
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
import type { ForwardedRef } from 'react';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { triggerOnDemandApp } from '../../rest/applicationAPI';
import { getServiceByFQN, postService } from '../../rest/serviceAPI';
import { getServiceLogo } from '../../utils/EntityDisplayUtils';
import * as serviceUtilClassBaseModule from '../../utils/ServiceUtilClassBase';
import EmbeddedAddServicePage from './EmbeddedAddServicePage.component';

const MOCK_TEST_SERVICE = 'test-service';
const MOCK_SERVICE_NAME_ERROR = 'service-name-error';
const MOCK_TRIGGER_ADDITIONAL_VALIDATION = 'trigger-additional-validation';
const MOCK_MODAL_LEAVE = 'modal-leave';
const MOCK_ADD_SERVICE = '/add-service';
const MOCK_SERVICE_DETAILS_PATH = '/service/details/path';
const LABEL_ADD_NEW_ENTITY = 'label.add-new-entity';
const SELECT_MY_SQL = 'Select MySQL';
const MYSQL_LABEL_SERVICE = 'mysql label.service';
const SAVE_CONNECTION = 'Save Connection';
const SET_SERVICE_NAME = 'Set Service Name';
const SAVE_FILTERS = 'Save Filters';
const LABEL_BACK = 'label.back';

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

jest.mock('../../utils/ServiceUtilClassBase', () => ({
  getExtraInfo: jest.fn(),
  getServiceConfigData: jest.fn(),
  getProperties: jest.fn(),
  getSupportedServiceFromList: jest
    .fn()
    .mockReturnValue({ databaseServices: ['mysql'] }),
}));

jest.mock('../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation((Component) => Component),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
  useParams: jest.fn().mockImplementation(() => mockParam),
}));

jest.mock('../../components/common/ResizablePanels/ResizablePanels', () =>
  jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <div>
      <div>{firstPanel?.children}</div>
      <div>{secondPanel?.children}</div>
    </div>
  ))
);

jest.mock('../../components/common/ServiceDocPanel/ServiceDocPanel', () =>
  jest
    .fn()
    .mockImplementation(({ activeField }) => (
      <div data-testid="service-doc-panel">ServiceDocPanel:{activeField}</div>
    ))
);

jest.mock(
  '../../components/Settings/Services/AddService/ServiceNameCard/ServiceNameCard',
  () =>
    jest
      .fn()
      .mockImplementation(
        ({ nameError, onDescriptionChange, onFocus, onNameChange }) => (
          <div>
            <button onClick={() => onNameChange(MOCK_TEST_SERVICE)}>
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
              <div data-testid={MOCK_SERVICE_NAME_ERROR}>{nameError}</div>
            )}
          </div>
        )
      )
);

jest.mock(
  '../../components/Settings/Services/AddService/Steps/SelectServiceType',
  () =>
    jest
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
      )
);

jest.mock(
  '../../components/Settings/Services/Ingestion/IngestionStepper/IngestionStepper.component',
  () => jest.fn().mockImplementation(() => <div>IngestionStepper</div>)
);

const mockConnectionConfigFormProps = jest.fn();

jest.mock(
  '../../components/Settings/Services/ServiceConfig/ConnectionConfigForm',
  () => {
    const React = jest.requireActual<typeof import('react')>('react');

    return React.forwardRef(function MockConnectionConfigForm(
      {
        isAdditionalValidationPending,
        onSave,
        onCancel,
        onValidateAdditionalRequiredFields,
      }: MockConnectionConfigFormProps,
      ref: ForwardedRef<MockConnectionConfigFormHandle>
    ) {
      const handleSave = () => onSave({ formData: { host: 'localhost' } });

      React.useImperativeHandle(ref, () => ({
        isSubmitDisabled: false,
        submit: handleSave,
      }));

      mockConnectionConfigFormProps({
        isAdditionalValidationPending,
        onSave,
        onCancel,
        onValidateAdditionalRequiredFields,
      });

      return (
        <div>
          <button onClick={handleSave}>Save Connection</button>
          <button onClick={onCancel}>Back</button>
          <button
            data-testid={MOCK_TRIGGER_ADDITIONAL_VALIDATION}
            onClick={() => onValidateAdditionalRequiredFields?.()}>
            Validate Additional Fields
          </button>
        </div>
      );
    });
  }
);

jest.mock(
  '../../components/common/NavigationGuardModal/NavigationGuardModal',
  () => ({
    NavigationGuardModal: jest.fn().mockImplementation(({ isOpen, onLeave }) =>
      isOpen ? (
        <button data-testid={MOCK_MODAL_LEAVE} onClick={onLeave}>
          Leave
        </button>
      ) : null
    ),
  })
);

jest.mock(
  '../../components/Settings/Services/ServiceConfig/FiltersConfigForm',
  () => {
    const React = jest.requireActual<typeof import('react')>('react');

    return React.forwardRef(function MockFiltersConfigForm(
      { onSave, onCancel }: MockFiltersConfigFormProps,
      ref: ForwardedRef<MockFiltersConfigFormHandle>
    ) {
      const handleSave = () => onSave({ formData: { filterPattern: {} } });

      React.useImperativeHandle(ref, () => ({
        submit: handleSave,
      }));

      return (
        <div>
          <button onClick={handleSave}>Save Filters</button>
          <button onClick={onCancel}>Back</button>
        </div>
      );
    });
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
      name: MOCK_TEST_SERVICE,
      fullyQualifiedName: MOCK_TEST_SERVICE,
    })
  ),
}));

jest.mock('../../rest/applicationAPI', () => ({
  triggerOnDemandApp: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../utils/EntityDisplayUtils', () => ({
  getServiceLogo: jest.fn(),
}));

jest.mock('../../utils/ServiceUtils', () => ({
  getAddServiceEntityBreadcrumb: jest.fn().mockReturnValue([]),
  getEntityTypeFromServiceCategory: jest.fn(),
  getServiceType: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../utils/ConnectionsRouterClassBase', () => ({
  __esModule: true,
  default: {
    getAddServicePath: jest.fn().mockReturnValue(MOCK_ADD_SERVICE),
    getSettingsServicesPath: jest.fn().mockReturnValue('/services'),
    getServiceDetailsPath: jest.fn().mockReturnValue(MOCK_SERVICE_DETAILS_PATH),
  },
}));

const mockProps = {
  pageTitle: 'add-service',
};

type MockConnectionConfigFormProps = {
  isAdditionalValidationPending?: boolean;
  onCancel?: () => void;
  onSave: (event: { formData: { host: string } }) => void;
  onValidateAdditionalRequiredFields?: () => boolean;
};

type MockConnectionConfigFormHandle = {
  isSubmitDisabled: boolean;
  submit: () => void;
};

type MockFiltersConfigFormProps = {
  onCancel?: () => void;
  onSave: (event: {
    formData: { filterPattern: Record<string, never> };
  }) => void;
};

type MockFiltersConfigFormHandle = {
  submit: () => void;
};

describe('EmbeddedAddServicePage', () => {
  beforeEach(() => {
    (getServiceByFQN as jest.Mock).mockRejectedValue({
      response: {
        status: 404,
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('renders the add-new-service container', async () => {
    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByTestId('add-new-service-container')).toBeInTheDocument();
    expect(screen.getByTestId('header')).toHaveTextContent(
      LABEL_ADD_NEW_ENTITY
    );
  });

  it('shows service logo and type in header after service selection', async () => {
    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SELECT_MY_SQL));
    });

    expect(screen.getByTestId('header')).toHaveTextContent(MYSQL_LABEL_SERVICE);
    expect(getServiceLogo).toHaveBeenCalledWith(
      'mysql',
      'tw:size-10 tw:max-w-10 tw:max-h-10 tw:object-contain'
    );
  });

  it('handles service category changes from connector picker', async () => {
    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Change Category'));
    });

    expect(mockNavigate).toHaveBeenCalledWith(MOCK_ADD_SERVICE);
  });

  it('advances through the steps to create a service', async () => {
    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SELECT_MY_SQL));
    });

    expect(screen.getByText(SAVE_CONNECTION)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText(SET_SERVICE_NAME));
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SAVE_CONNECTION));
    });

    expect(await screen.findByText(SAVE_FILTERS)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText(SAVE_FILTERS));
    });

    expect(postService).toHaveBeenCalled();
    expect(triggerOnDemandApp).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith(MOCK_SERVICE_DETAILS_PATH);
  });

  it('resets the selected connector from the breadcrumb action', async () => {
    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SELECT_MY_SQL));
    });

    expect(screen.getByTestId('header')).toHaveTextContent(MYSQL_LABEL_SERVICE);
    expect(screen.queryByText(SELECT_MY_SQL)).not.toBeInTheDocument();

    // Clicking the breadcrumb shows a confirmation modal (activeServiceStep > 1)
    await act(async () => {
      fireEvent.click(screen.getByText(LABEL_ADD_NEW_ENTITY));
    });

    // Confirm leaving to reset the selected connector
    await act(async () => {
      fireEvent.click(screen.getByTestId(MOCK_MODAL_LEAVE));
    });

    expect(screen.getByTestId('header')).toHaveTextContent(
      LABEL_ADD_NEW_ENTITY
    );
    expect(screen.getByText(SELECT_MY_SQL)).toBeInTheDocument();
  });

  it('updates description and focused docs field from the embedded connection step', async () => {
    jest.useFakeTimers();

    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
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
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SELECT_MY_SQL));
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SAVE_CONNECTION));
    });

    expect(
      await screen.findByTestId(MOCK_SERVICE_NAME_ERROR)
    ).toHaveTextContent('message.field-text-is-required');
    expect(screen.queryByText(SAVE_FILTERS)).not.toBeInTheDocument();
  });

  it('sets name error and blocks test connection when service name is empty', async () => {
    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SELECT_MY_SQL));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId(MOCK_TRIGGER_ADDITIONAL_VALIDATION));
    });

    expect(
      await screen.findByTestId(MOCK_SERVICE_NAME_ERROR)
    ).toHaveTextContent('message.field-text-is-required');
  });

  it('does not set name error when service name is filled before test connection', async () => {
    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SELECT_MY_SQL));
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SET_SERVICE_NAME));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId(MOCK_TRIGGER_ADDITIONAL_VALIDATION));
    });

    expect(
      screen.queryByTestId(MOCK_SERVICE_NAME_ERROR)
    ).not.toBeInTheDocument();
  });

  it('passes onValidateAdditionalRequiredFields to ConnectionConfigForm', async () => {
    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SELECT_MY_SQL));
    });

    const lastProps = mockConnectionConfigFormProps.mock.calls.at(-1)?.[0];

    expect(typeof lastProps.onValidateAdditionalRequiredFields).toBe(
      'function'
    );
  });

  it('passes pending service name validation to ConnectionConfigForm', async () => {
    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
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

  it('focuses the service name input when additional validation fails on empty name', async () => {
    const mockFocus = jest.fn();
    jest
      .spyOn(document, 'getElementById')
      .mockReturnValue({ focus: mockFocus } as unknown as HTMLElement);

    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText(SELECT_MY_SQL));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId(MOCK_TRIGGER_ADDITIONAL_VALIDATION));
    });

    expect(document.getElementById).toHaveBeenCalledWith('service-name');
    expect(mockFocus).toHaveBeenCalled();
  });

  it('focuses the service name input when next is clicked with empty name via Save Connection', async () => {
    const mockFocus = jest.fn();
    jest
      .spyOn(document, 'getElementById')
      .mockReturnValue({ focus: mockFocus } as unknown as HTMLElement);

    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
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

  it('flags duplicate service names before moving to filters', async () => {
    (getServiceByFQN as jest.Mock).mockResolvedValueOnce({
      name: 'existing-service',
    });

    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
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

    expect(
      await screen.findByTestId(MOCK_SERVICE_NAME_ERROR)
    ).toHaveTextContent('message.service-name-already-exists-with-suggestion');
    expect(screen.queryByText(SAVE_FILTERS)).not.toBeInTheDocument();
    expect(
      serviceUtilClassBaseModule.getServiceConfigData
    ).not.toHaveBeenCalled();
  });

  it('still navigates after service creation error', async () => {
    (postService as jest.Mock).mockRejectedValueOnce(new Error('failed'));

    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
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

    expect(mockNavigate).toHaveBeenCalledWith(MOCK_SERVICE_DETAILS_PATH);
  });

  it('handles auto pilot trigger errors without blocking navigation', async () => {
    (triggerOnDemandApp as jest.Mock).mockRejectedValueOnce(
      new Error('autopilot failed')
    );

    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
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
    expect(mockNavigate).toHaveBeenCalledWith(MOCK_SERVICE_DETAILS_PATH);
  });

  it('navigates back through steps via Back buttons', async () => {
    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const selectMySQLButton = screen.getByText(SELECT_MY_SQL);
    await act(async () => {
      fireEvent.click(selectMySQLButton);
    });

    // Footer Back button shows a confirmation modal before going back to step 1
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: LABEL_BACK }));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId(MOCK_MODAL_LEAVE));
    });

    expect(screen.getByText(SELECT_MY_SQL)).toBeInTheDocument();
  });

  it('returns from filters to the embedded connection step', async () => {
    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
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
      fireEvent.click(screen.getByRole('button', { name: LABEL_BACK }));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId(MOCK_MODAL_LEAVE));
    });

    expect(screen.getByText(SAVE_CONNECTION)).toBeInTheDocument();
  });

  it('calls getExtraInfo on mount', async () => {
    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const mockedModule = serviceUtilClassBaseModule as unknown as {
      getExtraInfo: jest.Mock;
    };

    expect(mockedModule.getExtraInfo).toHaveBeenCalled();
  });

  describe('with a preselected service type from navigation state', () => {
    const renderPreselected = () =>
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: ({ children }) => (
          <MemoryRouter
            initialEntries={[
              { pathname: MOCK_ADD_SERVICE, state: { serviceType: 'mysql' } },
            ]}>
            {children}
          </MemoryRouter>
        ),
      });

    it('starts on the Connect step with the connector preselected', async () => {
      await act(async () => {
        renderPreselected();
      });

      expect(screen.getByTestId('header')).toHaveTextContent(
        MYSQL_LABEL_SERVICE
      );
      expect(screen.getByText(SAVE_CONNECTION)).toBeInTheDocument();
      expect(screen.queryByText(SELECT_MY_SQL)).not.toBeInTheDocument();
    });

    it('returns to the origin on footer Back instead of the connector grid', async () => {
      await act(async () => {
        renderPreselected();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: LABEL_BACK }));
      });

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('returns to a caller-supplied backTo origin on footer Back', async () => {
      await act(async () => {
        render(<EmbeddedAddServicePage {...mockProps} />, {
          wrapper: ({ children }) => (
            <MemoryRouter
              initialEntries={[
                {
                  pathname: MOCK_ADD_SERVICE,
                  state: { serviceType: 'mysql', backTo: '/connections' },
                },
              ]}>
              {children}
            </MemoryRouter>
          ),
        });
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: LABEL_BACK }));
      });

      expect(mockNavigate).toHaveBeenCalledWith('/connections');
    });

    it('falls back to the connector grid when the preselected type is unsupported', async () => {
      await act(async () => {
        render(<EmbeddedAddServicePage {...mockProps} />, {
          wrapper: ({ children }) => (
            <MemoryRouter
              initialEntries={[
                { pathname: MOCK_ADD_SERVICE, state: { serviceType: 'bogus' } },
              ]}>
              {children}
            </MemoryRouter>
          ),
        });
      });

      expect(screen.getByText(SELECT_MY_SQL)).toBeInTheDocument();
      expect(screen.getByTestId('header')).toHaveTextContent(
        LABEL_ADD_NEW_ENTITY
      );
    });
  });
});
