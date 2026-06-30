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
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { triggerOnDemandApp } from '../../rest/applicationAPI';
import { getServiceByFQN, postService } from '../../rest/serviceAPI';
import { getServiceLogo } from '../../utils/EntityDisplayUtils';
import * as serviceUtilClassBaseModule from '../../utils/ServiceUtilClassBase';
import EmbeddedAddServicePage from './EmbeddedAddServicePage.component';

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

jest.mock(
  '../../components/Settings/Services/ServiceConfig/ConnectionConfigForm',
  () =>
    jest.fn().mockImplementation(({ onSave, onCancel }) => (
      <div>
        <button onClick={() => onSave({ formData: { host: 'localhost' } })}>
          Save Connection
        </button>
        <button onClick={onCancel}>Back</button>
      </div>
    ))
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

jest.mock(
  '../../components/Settings/Services/ServiceConfig/FiltersConfigForm',
  () =>
    jest.fn().mockImplementation(({ onSave, onCancel }) => (
      <div>
        <button onClick={() => onSave({ formData: { filterPattern: {} } })}>
          Save Filters
        </button>
        <button onClick={onCancel}>Back</button>
      </div>
    ))
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
    getAddServicePath: jest.fn().mockReturnValue('/add-service'),
    getSettingsServicesPath: jest.fn().mockReturnValue('/services'),
    getServiceDetailsPath: jest.fn().mockReturnValue('/service/details/path'),
  },
}));

const mockProps = {
  pageTitle: 'add-service',
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
  });

  it('renders the add-new-service container', async () => {
    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByTestId('add-new-service-container')).toBeInTheDocument();
    expect(screen.getByTestId('header')).toHaveTextContent(
      'label.add-new-entity'
    );
  });

  it('shows service logo and type in header after service selection', async () => {
    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Select MySQL'));
    });

    expect(screen.getByTestId('header')).toHaveTextContent(
      'mysql label.service'
    );
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

    expect(mockNavigate).toHaveBeenCalledWith('/add-service');
  });

  it('advances through the steps to create a service', async () => {
    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Select MySQL'));
    });

    expect(screen.getByText('Save Connection')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('Set Service Name'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Save Connection'));
    });

    expect(await screen.findByText('Save Filters')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('Save Filters'));
    });

    expect(postService).toHaveBeenCalled();
    expect(triggerOnDemandApp).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/service/details/path');
  });

  it('resets the selected connector from the breadcrumb action', async () => {
    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Select MySQL'));
    });

    expect(screen.getByTestId('header')).toHaveTextContent(
      'mysql label.service'
    );
    expect(screen.queryByText('Select MySQL')).not.toBeInTheDocument();

    // Clicking the breadcrumb shows a confirmation modal (activeServiceStep > 1)
    await act(async () => {
      fireEvent.click(screen.getByText('label.add-new-entity'));
    });

    // Confirm leaving to reset the selected connector
    await act(async () => {
      fireEvent.click(screen.getByTestId('modal-leave'));
    });

    expect(screen.getByTestId('header')).toHaveTextContent(
      'label.add-new-entity'
    );
    expect(screen.getByText('Select MySQL')).toBeInTheDocument();
  });

  it('updates description and focused docs field from the embedded connection step', async () => {
    jest.useFakeTimers();

    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Select MySQL'));
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
      fireEvent.click(screen.getByText('Select MySQL'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Save Connection'));
    });

    expect(await screen.findByTestId('service-name-error')).toHaveTextContent(
      'message.field-text-is-required'
    );
    expect(screen.queryByText('Save Filters')).not.toBeInTheDocument();
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
      fireEvent.click(screen.getByText('Select MySQL'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Set Existing Service Name'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Save Connection'));
    });

    expect(await screen.findByTestId('service-name-error')).toHaveTextContent(
      'message.service-name-already-exists-with-suggestion'
    );
    expect(screen.queryByText('Save Filters')).not.toBeInTheDocument();
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
      fireEvent.click(screen.getByText('Select MySQL'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Set Service Name'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Save Connection'));
    });

    await act(async () => {
      fireEvent.click(await screen.findByText('Save Filters'));
    });

    expect(mockNavigate).toHaveBeenCalledWith('/service/details/path');
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
      fireEvent.click(screen.getByText('Select MySQL'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Set Service Name'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Save Connection'));
    });

    await act(async () => {
      fireEvent.click(await screen.findByText('Save Filters'));
    });

    expect(triggerOnDemandApp).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/service/details/path');
  });

  it('navigates back through steps via Back buttons', async () => {
    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const selectMySQLButton = screen.getByText('Select MySQL');
    await act(async () => {
      fireEvent.click(selectMySQLButton);
    });

    // Footer Back button shows a confirmation modal before going back to step 1
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'label.back' }));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('modal-leave'));
    });

    expect(screen.getByText('Select MySQL')).toBeInTheDocument();
  });

  it('returns from filters to the embedded connection step', async () => {
    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Select MySQL'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Set Service Name'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Save Connection'));
    });

    // Footer Back button shows a confirmation modal before going back
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'label.back' }));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('modal-leave'));
    });

    expect(screen.getByText('Save Connection')).toBeInTheDocument();
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
});
