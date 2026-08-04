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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import type { Task } from '../../../generated/entity/tasks/task';
import { TaskStatus, TaskType } from '../../../generated/entity/tasks/task';
import { useMetricTaskResolutionPermission } from './useMetricTaskResolutionPermission';

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn(),
}));

const descriptionTask = {
  assignees: [{ id: 'current-user', type: 'user' }],
  createdAt: 1,
  id: 'task-1',
  name: 'Update description',
  status: TaskStatus.Open,
  type: TaskType.DescriptionUpdate,
} as Task;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useMetricTaskResolutionPermission', () => {
  const getEntityPermission = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (usePermissionProvider as jest.Mock).mockReturnValue({
      getEntityPermission,
    });
  });

  it('allows a task assignee when task and underlying permissions allow resolution', async () => {
    getEntityPermission.mockResolvedValue({ ResolveTask: true });
    const { result } = renderHook(
      () =>
        useMetricTaskResolutionPermission(descriptionTask, {
          EditDescription: true,
        }),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.canResolve).toBe(true);
    expect(getEntityPermission).toHaveBeenCalledWith(
      ResourceEntity.TASK,
      descriptionTask.id
    );
  });

  it('denies resolution when the task-scoped ResolveTask operation is denied', async () => {
    getEntityPermission.mockResolvedValue({ ResolveTask: false });
    const { result } = renderHook(
      () =>
        useMetricTaskResolutionPermission(descriptionTask, {
          EditDescription: true,
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.canResolve).toBe(false);
  });

  it('denies update tasks without their underlying Metric edit permission', async () => {
    getEntityPermission.mockResolvedValue({ ResolveTask: true });
    const { result } = renderHook(
      () => useMetricTaskResolutionPermission(descriptionTask, {}),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.canResolve).toBe(false);
  });

  it('does not require an underlying edit operation for approval tasks', async () => {
    getEntityPermission.mockResolvedValue({ ResolveTask: true });
    const { result } = renderHook(
      () =>
        useMetricTaskResolutionPermission(
          { ...descriptionTask, type: TaskType.RequestApproval },
          {}
        ),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.canResolve).toBe(true);
  });

  it('fails closed when task permission loading errors', async () => {
    const permissionError = new Error('permission unavailable');
    getEntityPermission.mockRejectedValue(permissionError);
    const { result } = renderHook(
      () =>
        useMetricTaskResolutionPermission(descriptionTask, {
          EditDescription: true,
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.canResolve).toBe(false);
    expect(result.current.error).toBe(permissionError);
  });
});
