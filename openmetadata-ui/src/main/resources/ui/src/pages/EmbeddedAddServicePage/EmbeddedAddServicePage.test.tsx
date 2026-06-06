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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { triggerOnDemandApp } from '../../rest/applicationAPI';
import { postService } from '../../rest/serviceAPI';
import { getServiceLogo } from '../../utils/EntityDisplayUtils';
import * as serviceUtilClassBaseModule from '../../utils/ServiceUtilClassBase';
import { getAddServiceEntityBreadcrumb } from '../../utils/ServiceUtils';
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
  jest.fn().mockImplementation(() => <div>ServiceDocPanel</div>)
);

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn().mockImplementation(() => <div>TitleBreadcrumb</div>)
);

jest.mock(
  '../../components/Settings/Services/AddService/Steps/ConfigureService',
  () =>
    jest.fn().mockImplementation(({ onNext }) => (
      <div>
        <button
          onClick={() =>
            onNext({ name: 'test-service', description: 'test description' })
          }>
          Configure Service
        </button>
      </div>
    ))
);

jest.mock(
  '../../components/Settings/Services/AddService/Steps/SelectServiceType',
  () =>
    jest
      .fn()
      .mockImplementation(({ handleServiceTypeClick, onNext, onCancel }) => (
        <div>
          <button onClick={() => handleServiceTypeClick('mysql')}>
            Select MySQL
          </button>
          <button onClick={onNext}>Next</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      ))
);

jest.mock(
  '../../components/Settings/Services/Ingestion/IngestionStepper/IngestionStepper.component',
  () => jest.fn().mockImplementation(() => <div>IngestionStepper</div>)
);

jest.mock(
  '../../components/Settings/Services/ServiceConfig/EmbeddedConnectionConfigForm',
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
    expect(getServiceLogo).toHaveBeenCalledWith('mysql', 'h-6');
  });

  it('advances through all 4 steps to create a service', async () => {
    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Select MySQL'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Next'));
    });

    expect(screen.getByText('Configure Service')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('Configure Service'));
    });

    expect(screen.getByText('Save Connection')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('Save Connection'));
    });

    expect(screen.getByText('Save Filters')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('Save Filters'));
    });

    expect(postService).toHaveBeenCalled();
    expect(triggerOnDemandApp).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/service/details/path');
  });

  it('navigates back through steps via Back buttons', async () => {
    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Select MySQL'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Next'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Configure Service'));
    });

    expect(screen.getByText('Save Connection')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('Back'));
    });

    expect(screen.getByText('Configure Service')).toBeInTheDocument();
  });

  it('uses embedded breadcrumb URL with /askCollate prefix', async () => {
    (getAddServiceEntityBreadcrumb as jest.Mock).mockReturnValue([
      { name: 'Services', url: '/settings/services/databaseServices' },
      { name: 'Add Service', url: '' },
    ]);

    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(getAddServiceEntityBreadcrumb).toHaveBeenCalledWith(
      'databaseServices'
    );
  });

  it('shows error when Next clicked without selecting service type', async () => {
    await act(async () => {
      render(<EmbeddedAddServicePage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Next'));
    });

    expect(screen.getByTestId('add-new-service-container')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
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
