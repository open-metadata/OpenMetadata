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

import { act, render, screen, waitFor } from '@testing-library/react';
import { EventSubscription } from '../../../../../../generated/events/eventSubscription';
import NotificationAlertConfigView from './NotificationAlertConfigView';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  Box: jest
    .fn()
    .mockImplementation(({ children, ...props }) => (
      <div {...props}>{children}</div>
    )),
  Card: Object.assign(
    jest
      .fn()
      .mockImplementation(({ children, ...props }) => (
        <div {...props}>{children}</div>
      )),
    {
      Content: jest
        .fn()
        .mockImplementation(({ children }) => <div>{children}</div>),
    }
  ),
  Toggle: jest
    .fn()
    .mockImplementation((props) => <input type="checkbox" {...props} />),
  Typography: jest
    .fn()
    .mockImplementation(({ children }) => <span>{children}</span>),
}));

jest.mock('../../../../../../rest/alertsAPI', () => ({
  getResourceFunctions: jest.fn().mockResolvedValue({
    data: [
      {
        name: 'table',
        supportedFilters: [],
        supportedActions: [],
        containerEntities: [],
      },
    ],
  }),
}));

jest.mock('../../../../../../rest/notificationtemplateAPI', () => ({
  getAllNotificationTemplates: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock(
  '../../../../../../context/PermissionProvider/PermissionProvider',
  () => ({
    usePermissionProvider: jest.fn().mockReturnValue({
      getResourcePermission: jest.fn().mockResolvedValue({}),
    }),
  })
);

jest.mock('../../../../../../utils/AlertsClassBase', () => ({
  __esModule: true,
  default: {
    getModifiedAlertDataForForm: jest.fn().mockReturnValue({
      destinations: [],
      timeout: 10,
      readTimeout: 30,
      filteringRules: { resources: ['table'] },
    }),
    getAddAlertFormExtraWidgets: jest.fn().mockReturnValue({}),
  },
}));

jest.mock('../../../../../../utils/PermissionDerivation', () => ({
  getDerivedPermissionFlags: jest
    .fn()
    .mockReturnValue({ canViewAll: false }),
}));

jest.mock('../../../../../../utils/PermissionsUtils', () => ({
  DEFAULT_ENTITY_PERMISSION: {},
}));

jest.mock('../../../../../../utils/EntityNameUtils', () => ({
  getEntityName: (entity: { name?: string; displayName?: string }) =>
    entity?.displayName ?? entity?.name ?? '',
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../../../common/Loader/Loader', () =>
  jest.fn(() => <div data-testid="loader" />)
);

jest.mock('./NotificationSourceSelect', () =>
  jest.fn(() => <div data-testid="source-select" />)
);

jest.mock('./NotificationFiltersEditor', () =>
  jest.fn(() => <div data-testid="filters-editor" />)
);

jest.mock('./NotificationDestinationBridge', () =>
  jest.fn(() => <div data-testid="destination-bridge" />)
);

const mockAlertDetails = {
  id: 'alert-1',
  name: 'test-alert',
  filteringRules: { resources: ['table'] },
  destinations: [
    {
      timeout: 10,
      readTimeout: 30,
      type: 'email',
      category: 'External',
      config: {},
    },
  ],
  input: { filters: [], actions: [] },
} as unknown as EventSubscription;

describe('NotificationAlertConfigView', () => {
  it('should show loader initially', () => {
    render(
      <NotificationAlertConfigView alertDetails={mockAlertDetails} />
    );

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('should render source select after loading', async () => {
    await act(async () => {
      render(
        <NotificationAlertConfigView alertDetails={mockAlertDetails} />
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('source-select')).toBeInTheDocument();
    });
  });

  it('should render destination bridge after loading', async () => {
    await act(async () => {
      render(
        <NotificationAlertConfigView alertDetails={mockAlertDetails} />
      );
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('destination-bridge')
      ).toBeInTheDocument();
    });
  });

  it('should not render filters editor when alertFilters is empty', async () => {
    await act(async () => {
      render(
        <NotificationAlertConfigView alertDetails={mockAlertDetails} />
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('source-select')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('filters-editor')).not.toBeInTheDocument();
  });
});
