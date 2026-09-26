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

import { renderHook, waitFor } from '@testing-library/react';
import { AlertType } from '../../../generated/events/eventSubscription';
import { useAlertResources } from './useAlertResources';

const mockObservabilityResources = jest.fn();
const mockNotificationResources = jest.fn();

jest.mock('../../../rest/observabilityAPI', () => ({
  getResourceFunctions: () => mockObservabilityResources(),
}));

jest.mock('../../../rest/alertsAPI', () => ({
  getResourceFunctions: () => mockNotificationResources(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const renderResources = (alertType?: AlertType, selectedResource?: string) =>
  renderHook(() => useAlertResources(alertType, selectedResource));

describe('useAlertResources', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockObservabilityResources.mockResolvedValue({
      data: [{ name: 'testCase' }],
    });
    mockNotificationResources.mockResolvedValue({
      data: [{ name: 'all' }, { name: 'table' }],
    });
  });

  it('loads observability resources by default', async () => {
    const { result } = renderResources();

    await waitFor(() =>
      expect(result.current.filterResources.map((r) => r.name)).toEqual([
        'testCase',
      ])
    );

    expect(mockNotificationResources).not.toHaveBeenCalled();
  });

  it('loads notification resources for notification alerts', async () => {
    const { result } = renderResources(AlertType.Notification);

    await waitFor(() =>
      expect(result.current.filterResources.map((r) => r.name)).toEqual([
        'all',
        'table',
      ])
    );

    expect(mockObservabilityResources).not.toHaveBeenCalled();
  });

  it('narrows filters and triggers to the selected source', async () => {
    mockObservabilityResources.mockResolvedValue({
      data: [
        {
          name: 'table',
          supportedFilters: [{ name: 'filterByFqn' }],
          supportedActions: [],
        },
        { name: 'testCase', supportedFilters: [], supportedActions: [] },
      ],
    });

    const { result } = renderResources(AlertType.Observability, 'table');

    await waitFor(() =>
      expect(result.current.supportedFilters?.map((f) => f.name)).toEqual([
        'filterByFqn',
      ])
    );

    expect(result.current.shouldShowFiltersSection).toBe(true);
    expect(result.current.shouldShowActionsSection).toBe(false);
  });

  it('shows both sections until a source is selected', async () => {
    const { result } = renderResources();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.shouldShowFiltersSection).toBe(true);
    expect(result.current.shouldShowActionsSection).toBe(true);
  });
});
