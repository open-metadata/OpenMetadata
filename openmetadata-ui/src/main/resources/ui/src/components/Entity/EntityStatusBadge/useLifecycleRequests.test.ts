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
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import { getRequestableStages } from '../../../rest/metadataTypeAPI';
import { closeTask, createTask, listTasks } from '../../../rest/tasksAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useLifecycleRequests } from './useLifecycleRequests';

const mockCurrentUser = { name: 'requester', isAdmin: false };

jest.mock('../../../rest/metadataTypeAPI', () => ({
  getRequestableStages: jest.fn(),
}));

jest.mock('../../../rest/tasksAPI', () => ({
  closeTask: jest.fn(),
  createTask: jest.fn(),
  listTasks: jest.fn(),
  TaskCategory: { MetadataUpdate: 'MetadataUpdate' },
  TaskEntityStatus: { Open: 'Open' },
  TaskEntityType: { StatusUpdate: 'StatusUpdate' },
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: mockCurrentUser }),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const ENTITY_LINK = '<#E::domain::Sales>';

const renderRequests = () =>
  renderHook(() =>
    useLifecycleRequests({
      entityType: 'domain',
      entityId: 'domain-id',
      entityFqn: 'Sales',
      entityStatus: EntityStatus.Approved,
      canRequest: true,
    })
  );

const pendingTask = (createdBy: string) => ({
  data: [
    {
      id: 'task-id',
      payload: { newStatus: EntityStatus.Deprecated },
      createdBy: { name: createdBy },
    },
  ],
});

describe('useLifecycleRequests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser.isAdmin = false;
    (getRequestableStages as jest.Mock).mockResolvedValue([
      'Archived',
      'Deprecated',
    ]);
    (listTasks as jest.Mock).mockResolvedValue({ data: [] });
  });

  it("offers the stages the asset's lifecycle takes requests for", async () => {
    const { result } = renderRequests();

    await waitFor(() => expect(result.current.stages).toHaveLength(2));

    expect(getRequestableStages).toHaveBeenCalledWith('domain', 'domain-id');
    expect(listTasks).toHaveBeenCalledWith(
      expect.objectContaining({
        aboutEntity: 'Sales',
        type: 'StatusUpdate',
        status: 'Open',
      })
    );
    expect(result.current.pending).toBeUndefined();
  });

  it('still offers the stages when the pending request cannot be read', async () => {
    (listTasks as jest.Mock).mockRejectedValue(new Error('unavailable'));
    const { result } = renderRequests();

    await waitFor(() => expect(result.current.stages).toHaveLength(2));

    expect(result.current.pending).toBeUndefined();
  });

  it('raises a status update task with the stage and the reason', async () => {
    (createTask as jest.Mock).mockResolvedValue({ id: 'task-id' });
    const { result } = renderRequests();
    await waitFor(() => expect(result.current.stages).toHaveLength(2));

    let raised = false;
    await act(async () => {
      raised = await result.current.request(
        EntityStatus.Deprecated,
        'Replaced by Revenue'
      );
    });

    expect(raised).toBe(true);
    expect(createTask).toHaveBeenCalledWith({
      category: 'MetadataUpdate',
      type: 'StatusUpdate',
      about: ENTITY_LINK,
      description: 'Replaced by Revenue',
      payload: {
        newStatus: EntityStatus.Deprecated,
        reason: 'Replaced by Revenue',
      },
    });
  });

  it('reports a refused request and keeps the dialog open', async () => {
    (createTask as jest.Mock).mockRejectedValue(new Error('not offered'));
    const { result } = renderRequests();
    await waitFor(() => expect(result.current.stages).toHaveLength(2));

    let raised = true;
    await act(async () => {
      raised = await result.current.request(EntityStatus.Archived, 'Old');
    });

    expect(raised).toBe(false);
    expect(showErrorToast).toHaveBeenCalled();
  });

  it('shows the pending request and lets the requester withdraw it', async () => {
    (listTasks as jest.Mock).mockResolvedValue(pendingTask('requester'));
    const { result } = renderRequests();

    await waitFor(() =>
      expect(result.current.pending).toEqual({
        stage: EntityStatus.Deprecated,
        taskId: 'task-id',
        requestedBy: 'requester',
      })
    );

    expect(result.current.stages).toEqual([]);

    await act(async () => {
      await result.current.withdraw?.();
    });

    expect(closeTask).toHaveBeenCalledWith('task-id');
  });

  it('offers withdrawing to no one but the requester and admins', async () => {
    (listTasks as jest.Mock).mockResolvedValue(pendingTask('someone-else'));
    const { result } = renderRequests();

    await waitFor(() => expect(result.current.pending).toBeDefined());

    expect(result.current.withdraw).toBeUndefined();
  });
});
