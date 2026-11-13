/*
 *  Copyright 2025 Collate.
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
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { getAllNotificationTemplates } from '../../../rest/notificationtemplateAPI';
import { useObservabilityAlertTemplates } from './useObservabilityAlertTemplates';

jest.mock('../../../rest/notificationtemplateAPI', () => ({
  getAllNotificationTemplates: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockGetAllNotificationTemplates =
  getAllNotificationTemplates as jest.MockedFunction<
    typeof getAllNotificationTemplates
  >;

const extraFormWidgets = {
  template: jest.fn(),
} as unknown as Parameters<
  typeof useObservabilityAlertTemplates
>[0]['extraFormWidgets'];

const renderTemplates = (permission: OperationPermission) =>
  renderHook(() =>
    useObservabilityAlertTemplates({
      extraFormWidgets,
      getResourcePermission: jest.fn().mockResolvedValue(permission),
    })
  );

describe('useObservabilityAlertTemplates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllNotificationTemplates.mockResolvedValue({
      data: [{ name: 'template' }],
      paging: {},
    } as unknown as Awaited<ReturnType<typeof getAllNotificationTemplates>>);
  });

  it('should fetch templates when ViewAll is granted', async () => {
    const { result } = renderTemplates({
      ViewAll: true,
    } as OperationPermission);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetAllNotificationTemplates).toHaveBeenCalled();
    expect(result.current.templates).toHaveLength(1);
  });

  it('should not fetch templates when ViewAll is denied', async () => {
    const { result } = renderTemplates({
      ViewBasic: true,
    } as OperationPermission);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetAllNotificationTemplates).not.toHaveBeenCalled();
    expect(result.current.templates).toEqual([]);
  });

  it('should expose the fetched resource permission either way', async () => {
    const permission = { ViewAll: false } as OperationPermission;
    const { result } = renderTemplates(permission);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.templateResourcePermission).toEqual(permission);
  });
});
