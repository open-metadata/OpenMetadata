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
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { useFqn } from '../../hooks/useFqn';
import {
  mockAlertDetails,
  mockAlertEventDiagnosticCounts,
} from '../../mocks/Alerts.mock';
import { ENTITY_PERMISSIONS } from '../../mocks/Permissions.mock';
import * as AlertsAPIs from '../../rest/alertsAPI';
import * as ObservabilityAPIs from '../../rest/observabilityAPI';
import AlertDetailsPage from './AlertDetailsPage';

const mockNavigate = jest.fn();
const mockUpdateNotificationAlert = jest.fn();
const mockUpdateObservabilityAlert = jest.fn();

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'testAlert' }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
  useParams: jest.fn().mockReturnValue({
    tab: 'container',
  }),
}));

jest.mock('../../rest/observabilityAPI', () => ({
  getObservabilityAlertByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockAlertDetails)),
  updateObservabilityAlert: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockAlertDetails)),
  getAlertEventsDiagnosticsInfo: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockAlertEventDiagnosticCounts)),
}));

jest.mock('../../rest/alertsAPI', () => ({
  updateNotificationAlert: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockAlertDetails)),
}));

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    getEntityPermissionByFqn: jest
      .fn()
      .mockImplementation(() => Promise.resolve(ENTITY_PERMISSIONS)),
  }),
}));

jest.mock('../../utils/RouterUtils', () => ({
  getNotificationAlertDetailsPath: jest.fn().mockReturnValue(''),
  getNotificationAlertsEditPath: jest
    .fn()
    .mockReturnValue('notification-alert-edit-path'),
  getObservabilityAlertDetailsPath: jest.fn().mockReturnValue(''),
  getObservabilityAlertsEditPath: jest
    .fn()
    .mockReturnValue('observability-alert-edit-path'),
  getSettingPath: jest.fn().mockReturnValue(''),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation((Component) => Component),
}));

jest.mock(
  '../../components/Alerts/AlertDetails/AlertConfigDetails/AlertConfigDetails',
  () => jest.fn().mockImplementation(() => <div>AlertConfigDetails</div>)
);

jest.mock(
  '../../components/Alerts/AlertDetails/AlertRecentEventsTab/AlertRecentEventsTab',
  () => jest.fn().mockImplementation(() => <div>AlertRecentEventsTab</div>)
);

jest.mock('../../components/common/DeleteWidget/DeleteWidgetModal', () =>
  jest.fn().mockImplementation(() => <div>DeleteWidgetModal</div>)
);

jest.mock('../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockImplementation(() => <div>ErrorPlaceHolder</div>)
);

jest.mock('../../components/common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);

jest.mock('../../components/common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest
    .fn()
    .mockImplementation(({ onUpdate }) => (
      <div onClick={() => onUpdate({})}>OwnerLabel</div>
    )),
}));

jest.mock('../../utils/DataAssetsHeader.utils', () => ({
  ExtraInfoLabel: jest.fn().mockImplementation(() => <div>ExtraInfoLabel</div>),
}));

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);

jest.mock(
  '../../components/common/RichTextEditor/RichTextEditorPreviewerV1',
  () => jest.fn().mockImplementation(() => <div>RichTextEditorPreviewer</div>)
);

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn().mockImplementation(() => <div>TitleBreadcrumb</div>)
);

jest.mock(
  '../../components/Entity/EntityHeaderTitle/EntityHeaderTitle.component',
  () => jest.fn().mockImplementation(() => <div>EntityHeaderTitle</div>)
);

describe('AlertDetailsPage', () => {
  it('should render ErrorPlaceholder if no fqn is present', async () => {
    (useFqn as jest.Mock).mockImplementationOnce(() => ({
      fqn: '',
    }));

    await act(async () => {
      render(<AlertDetailsPage isNotificationAlert />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByText('ErrorPlaceHolder')).toBeInTheDocument();
  });

  it('should render alert details page properly if fqn is present', async () => {
    await act(async () => {
      render(<AlertDetailsPage isNotificationAlert />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByText('TitleBreadcrumb')).toBeInTheDocument();
    expect(screen.getByText('EntityHeaderTitle')).toBeInTheDocument();
    expect(screen.getByText('OwnerLabel')).toBeInTheDocument();
    expect(screen.getAllByText('ExtraInfoLabel')).toHaveLength(3);
    expect(screen.getByTestId('edit-button')).toBeInTheDocument();
    expect(screen.getByTestId('delete-button')).toBeInTheDocument();
    expect(screen.getByText('label.configuration')).toBeInTheDocument();
    expect(screen.getByText('label.recent-event-plural')).toBeInTheDocument();
    expect(screen.getByText('DeleteWidgetModal')).toBeInTheDocument();
  });

  it('should render the description if alert description is present', async () => {
    await act(async () => {
      render(<AlertDetailsPage isNotificationAlert />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByText('RichTextEditorPreviewer')).toBeInTheDocument();
  });

  it('should redirect to notification alert edit path on click of edit button if isNotificationAlert is true', async () => {
    render(<AlertDetailsPage isNotificationAlert />, {
      wrapper: MemoryRouter,
    });

    const editButton = await screen.findByTestId('edit-button');
    fireEvent.click(editButton);

    expect(mockNavigate).toHaveBeenCalledWith('notification-alert-edit-path');
  });

  it('should redirect to observability alert edit path on click of edit button if isNotificationAlert is false', async () => {
    render(<AlertDetailsPage isNotificationAlert={false} />, {
      wrapper: MemoryRouter,
    });

    const editButton = await screen.findByTestId('edit-button');

    fireEvent.click(editButton);

    expect(mockNavigate).toHaveBeenCalledWith('observability-alert-edit-path');
  });

  it('should call mockUpdateNotificationAlert on owner update if isNotificationAlert is true', async () => {
    jest
      .spyOn(AlertsAPIs, 'updateNotificationAlert')
      .mockImplementation(mockUpdateNotificationAlert);

    render(<AlertDetailsPage isNotificationAlert />, {
      wrapper: MemoryRouter,
    });

    const ownerLabel = await screen.findByText('OwnerLabel');

    fireEvent.click(ownerLabel);

    expect(mockUpdateNotificationAlert).toHaveBeenCalledTimes(1);
  });

  it('should call mockUpdateObservabilityAlert on owner update if isNotificationAlert is false', async () => {
    jest
      .spyOn(ObservabilityAPIs, 'updateObservabilityAlert')
      .mockImplementation(mockUpdateObservabilityAlert);

    render(<AlertDetailsPage isNotificationAlert={false} />, {
      wrapper: MemoryRouter,
    });

    const ownerLabel = await screen.findByText('OwnerLabel');

    fireEvent.click(ownerLabel);

    expect(mockUpdateObservabilityAlert).toHaveBeenCalledTimes(1);
  });

  it('should not render the edit and delete button if no edit and delete permission', async () => {
    (usePermissionProvider as jest.Mock).mockImplementation(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementation(() =>
        Promise.resolve({
          ...ENTITY_PERMISSIONS,
          EditAll: false,
          Delete: false,
        })
      ),
    }));

    render(<AlertDetailsPage isNotificationAlert />, {
      wrapper: MemoryRouter,
    });

    expect(screen.queryByTestId('edit-button')).toBeNull();
    expect(screen.queryByTestId('delete-button')).toBeNull();
  });
});
