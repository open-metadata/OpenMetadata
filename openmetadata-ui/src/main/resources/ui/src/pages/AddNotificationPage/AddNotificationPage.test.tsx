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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AddNotificationPage from './AddNotificationPage';

const mockNavigate = jest.fn();
const mockHandleAlertSave = jest.fn();
const mockGetModifiedAlertDataForForm = jest.fn();

jest.mock('../../utils/AlertsClassBase', () => ({
  __esModule: true,
  default: {
    handleAlertSave: (...args: unknown[]) => mockHandleAlertSave(...args),
    getModifiedAlertDataForForm: (...args: unknown[]) =>
      mockGetModifiedAlertDataForForm(...args),
    getAddAlertFormExtraWidgets: jest.fn().mockReturnValue({}),
    getAddAlertFormExtraButtons: jest.fn().mockReturnValue({}),
  },
}));

jest.mock('../../rest/alertsAPI', () => ({
  getAlertsFromName: jest.fn().mockImplementation(() =>
    Promise.resolve({
      name: 'ActivityFeedAlert',
    })
  ),
  getResourceFunctions: jest.fn(),
  updateNotificationAlert: jest.fn().mockImplementation(() =>
    Promise.resolve({
      id: 'ActivityFeedAlert',
      data: [],
    })
  ),
  createNotificationAlert: jest.fn().mockImplementation(() =>
    Promise.resolve({
      alert: 'Notification',
    })
  ),
}));

jest.mock('../../utils/RouterUtils', () => ({
  getNotificationAlertDetailsPath: jest.fn(),
  getSettingPath: jest.fn(),
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

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: '' }),
}));

jest.mock(
  '../../components/Alerts/AlertFormSourceItem/AlertFormSourceItem',
  () =>
    jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="source-select">Source Select</div>
      ))
);

jest.mock(
  '../../components/Alerts/DestinationFormItem/DestinationFormItem.component',
  () =>
    jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="destination-category-select">Destination Select</div>
      ))
);

jest.mock(
  '../../components/Alerts/ObservabilityFormFiltersItem/ObservabilityFormFiltersItem',
  () => jest.fn().mockImplementation(() => <div>Filters</div>)
);

const mockProps = {
  pageTitle: 'add-notifications',
};

describe('AddNotificationPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render Add Notification Page', async () => {
    await act(async () => {
      render(<AddNotificationPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(
      await screen.findByText('label.notification-plural')
    ).toBeInTheDocument();
  });

  it('should display the correct breadcrumb', async () => {
    await act(async () => {
      render(<AddNotificationPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });
    const breadcrumbLinks = screen.getAllByTestId('breadcrumb-link');

    expect(breadcrumbLinks[0]).toHaveTextContent('label.setting-plural');
    expect(breadcrumbLinks[1]).toHaveTextContent('label.notification-plural');
    expect(breadcrumbLinks[2]).toHaveTextContent('label.alert-plural');
    expect(breadcrumbLinks[3]).toHaveTextContent('label.create-entity');
  });

  it('should display SubTitle', async () => {
    await act(async () => {
      render(<AddNotificationPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(
      await screen.findByText(/message.alerts-description/)
    ).toBeInTheDocument();
  });

  it('should render Add alert button', async () => {
    await act(async () => {
      render(<AddNotificationPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(await screen.findByText(/label.create-entity/)).toBeInTheDocument();
  });

  it('should navigate back when the cancel button is clicked', async () => {
    await act(async () => {
      render(<AddNotificationPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const cancelButton = screen.getByTestId('cancel-button');

    await act(async () => {
      fireEvent.click(cancelButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('should render form field for name', async () => {
    await act(async () => {
      render(<AddNotificationPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await screen.findByText('label.notification-plural');

    expect(screen.getByPlaceholderText('label.name')).toBeInTheDocument();
  });

  it('should render save button', async () => {
    await act(async () => {
      render(<AddNotificationPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await screen.findByText('label.notification-plural');

    const saveButton = screen.getByTestId('save-button');

    expect(saveButton).toBeInTheDocument();
    expect(saveButton).toHaveTextContent('label.save');
  });

  it('should render AlertFormSourceItem component', async () => {
    await act(async () => {
      render(<AddNotificationPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await screen.findByText('label.notification-plural');

    expect(screen.getByTestId('source-select')).toBeInTheDocument();
  });

  it('should render DestinationFormItem component', async () => {
    await act(async () => {
      render(<AddNotificationPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await screen.findByText('label.notification-plural');

    expect(
      screen.getByTestId('destination-category-select')
    ).toBeInTheDocument();
  });

  it('should call getAddAlertFormExtraWidgets from alertsClassBase', async () => {
    const { default: alertsClassBase } = await import(
      '../../utils/AlertsClassBase'
    );

    await act(async () => {
      render(<AddNotificationPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await screen.findByText('label.notification-plural');

    expect(alertsClassBase.getAddAlertFormExtraWidgets).toHaveBeenCalled();
  });

  it('should call getAddAlertFormExtraButtons from alertsClassBase', async () => {
    const { default: alertsClassBase } = await import(
      '../../utils/AlertsClassBase'
    );

    await act(async () => {
      render(<AddNotificationPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    await screen.findByText('label.notification-plural');

    expect(alertsClassBase.getAddAlertFormExtraButtons).toHaveBeenCalled();
  });
});
