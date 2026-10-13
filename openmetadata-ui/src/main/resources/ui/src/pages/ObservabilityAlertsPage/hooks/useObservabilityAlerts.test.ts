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

import { act, renderHook, waitFor } from '@testing-library/react';
import {
  AlertType,
  EventSubscription,
  ProviderType,
} from '../../../generated/events/eventSubscription';
import { useObservabilityAlerts } from './useObservabilityAlerts';

const mockGetAllAlerts = jest.fn();
const mockGetAlertsFromName = jest.fn();

jest.mock('../../../rest/alertsAPI', () => ({
  getAllAlerts: (params: unknown) => mockGetAllAlerts(params),
  getAlertsFromName: (name: string) => mockGetAlertsFromName(name),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let mockPaging: {
  currentPage: number;
  pagingCursor?: { cursorType: string; cursorValue: string };
} = { currentPage: 1 };

jest.mock('../../../hooks/paging/usePaging', () => ({
  usePaging: () => ({
    currentPage: mockPaging.currentPage,
    handlePageChange: jest.fn(),
    handlePageSizeChange: jest.fn(),
    handlePagingChange: jest.fn(),
    pageSize: 10,
    paging: { total: 0 },
    pagingCursor: mockPaging.pagingCursor,
    showPagination: false,
  }),
}));

jest.mock('../../../context/LimitsProvider/useLimitsStore', () => ({
  useLimitStore: () => ({ getResourceLimit: jest.fn() }),
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    getEntityPermissionByFqn: jest.fn().mockResolvedValue({ Delete: true }),
    getResourcePermission: jest.fn().mockResolvedValue({ Create: true }),
  }),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const userAlert = {
  id: 'user-alert',
  name: 'user_alert',
  fullyQualifiedName: 'user_alert',
  provider: ProviderType.User,
} as EventSubscription;

const systemAlert = {
  id: 'system-alert',
  name: 'system_alert',
  fullyQualifiedName: 'system_alert',
  provider: ProviderType.System,
} as EventSubscription;

const activityFeedAlert = {
  id: 'activity-feed',
  name: 'ActivityFeedAlert',
  fullyQualifiedName: 'ActivityFeedAlert',
  provider: ProviderType.System,
} as EventSubscription;

describe('useObservabilityAlerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPaging = { currentPage: 1 };
    mockGetAllAlerts.mockResolvedValue({
      data: [userAlert, systemAlert],
      paging: { total: 2 },
    });
    mockGetAlertsFromName.mockResolvedValue(activityFeedAlert);
  });

  it('lists observability alerts without system alerts by default', async () => {
    const { result } = renderHook(() => useObservabilityAlerts());

    await waitFor(() => expect(result.current.alerts).toEqual([userAlert]));

    expect(mockGetAllAlerts).toHaveBeenCalledWith(
      expect.objectContaining({ alertType: AlertType.Observability })
    );
    expect(mockGetAlertsFromName).not.toHaveBeenCalled();
  });

  it('lists notification alerts with the system activity feed alert first', async () => {
    mockGetAllAlerts.mockResolvedValue({
      data: [userAlert],
      paging: { total: 1 },
    });

    const { result } = renderHook(() =>
      useObservabilityAlerts({
        alertType: AlertType.Notification,
        includeSystemAlerts: true,
      })
    );

    await waitFor(() =>
      expect(result.current.alerts).toEqual([activityFeedAlert, userAlert])
    );

    expect(mockGetAllAlerts).toHaveBeenCalledWith(
      expect.objectContaining({ alertType: AlertType.Notification })
    );
    expect(mockGetAlertsFromName).toHaveBeenCalledWith('ActivityFeedAlert');
  });

  it('still lists notification alerts when the activity feed alert cannot be fetched', async () => {
    mockGetAllAlerts.mockResolvedValue({
      data: [userAlert],
      paging: { total: 1 },
    });
    mockGetAlertsFromName.mockRejectedValue(new Error('not found'));

    const { result } = renderHook(() =>
      useObservabilityAlerts({
        alertType: AlertType.Notification,
        includeSystemAlerts: true,
      })
    );

    await waitFor(() => expect(result.current.alerts).toEqual([userAlert]));
  });

  it('refetches the list after an alert is deleted', async () => {
    const { result } = renderHook(() =>
      useObservabilityAlerts({
        alertType: AlertType.Notification,
        includeSystemAlerts: true,
      })
    );

    await waitFor(() => expect(mockGetAllAlerts).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.handleAlertDelete();
    });

    await waitFor(() => expect(mockGetAllAlerts).toHaveBeenCalledTimes(2));
  });

  it('shows the activity feed alert again when Previous returns to page 1', async () => {
    mockPaging = {
      currentPage: 1,
      pagingCursor: { cursorType: 'before', cursorValue: 'cursor-1' },
    };
    mockGetAllAlerts.mockResolvedValue({ data: [userAlert], paging: {} });

    const { result } = renderHook(() =>
      useObservabilityAlerts({
        alertType: AlertType.Notification,
        includeSystemAlerts: true,
      })
    );

    await waitFor(() =>
      expect(result.current.alerts).toEqual([activityFeedAlert, userAlert])
    );
  });

  it('does not add the activity feed alert on later pages', async () => {
    mockPaging = {
      currentPage: 2,
      pagingCursor: { cursorType: 'before', cursorValue: 'cursor-2' },
    };
    mockGetAllAlerts.mockResolvedValue({ data: [userAlert], paging: {} });

    const { result } = renderHook(() =>
      useObservabilityAlerts({
        alertType: AlertType.Notification,
        includeSystemAlerts: true,
      })
    );

    await waitFor(() => expect(result.current.alerts).toEqual([userAlert]));

    expect(mockGetAlertsFromName).not.toHaveBeenCalled();
  });
});
