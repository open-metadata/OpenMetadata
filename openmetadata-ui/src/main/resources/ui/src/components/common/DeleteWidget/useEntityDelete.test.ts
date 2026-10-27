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
import { act, renderHook } from '@testing-library/react';
import { EntityType } from '../../../enums/entity.enum';
import { deleteEntity } from '../../../rest/miscAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { DeleteType } from './DeleteWidget.interface';
import { useEntityDelete, UseEntityDeleteOptions } from './useEntityDelete';

const CURRENT_USER_ID = 'current-user-id';
const mockOnLogoutHandler = jest.fn();
const mockAsyncDelete = jest.fn();
const mockAfterDeleteAction = jest.fn();

jest.mock('../../../rest/miscAPI', () => ({
  deleteEntity: jest.fn(),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(
    (selector: (state: { currentUser: { id: string } }) => unknown) =>
      selector({ currentUser: { id: 'current-user-id' } })
  ),
}));

jest.mock('../../Auth/AuthProviders/AuthProvider', () => ({
  useAuthProvider: jest.fn(() => ({ onLogoutHandler: mockOnLogoutHandler })),
}));

jest.mock('../../../context/AsyncDeleteProvider/AsyncDeleteProvider', () => ({
  useAsyncDeleteProvider: jest.fn(() => ({
    handleOnAsyncEntityDeleteConfirm: mockAsyncDelete,
  })),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const baseOptions: UseEntityDeleteOptions = {
  entityName: 'Sales',
  entityType: EntityType.TEAM,
  entityId: 'team-id',
  afterDeleteAction: mockAfterDeleteAction,
};

const runDelete = async (
  deleteType: DeleteType,
  options: Partial<UseEntityDeleteOptions> = {}
) => {
  const { result } = renderHook(() =>
    useEntityDelete({ ...baseOptions, ...options })
  );
  let succeeded = false;
  await act(async () => {
    succeeded = await result.current(deleteType);
  });

  return succeeded;
};

describe('useEntityDelete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (deleteEntity as jest.Mock).mockResolvedValue({
      status: 200,
      data: { version: 3 },
    });
  });

  it('soft-deletes, toasts and reports the soft delete to afterDeleteAction', async () => {
    expect(await runDelete(DeleteType.SOFT_DELETE)).toBe(true);
    expect(deleteEntity).toHaveBeenCalledWith('teams', 'team-id', false, false);
    expect(showSuccessToast).toHaveBeenCalledWith(
      'server.entity-deleted-successfully'
    );
    expect(mockAfterDeleteAction).toHaveBeenCalledWith(true, 3);
  });

  it('hard-deletes recursively and uses a custom success message', async () => {
    expect(
      await runDelete(DeleteType.HARD_DELETE, {
        isRecursiveDelete: true,
        successMessage: 'Gone',
      })
    ).toBe(true);
    expect(deleteEntity).toHaveBeenCalledWith('teams', 'team-id', true, true);
    expect(showSuccessToast).toHaveBeenCalledWith('Gone');
    expect(mockAfterDeleteAction).toHaveBeenCalledWith(false, 3);
  });

  it('keeps the entity type as given when prepareType is off', async () => {
    await runDelete(DeleteType.HARD_DELETE, { prepareType: false });

    expect(deleteEntity).toHaveBeenCalledWith('team', 'team-id', false, true);
  });

  it('resolves false and toasts when the request fails', async () => {
    (deleteEntity as jest.Mock).mockRejectedValueOnce(new Error('nope'));

    expect(await runDelete(DeleteType.HARD_DELETE)).toBe(false);
    expect(showErrorToast).toHaveBeenCalled();
    expect(mockAfterDeleteAction).not.toHaveBeenCalled();
  });

  it('resolves false on an unexpected response status', async () => {
    (deleteEntity as jest.Mock).mockResolvedValueOnce({ status: 500 });

    expect(await runDelete(DeleteType.HARD_DELETE)).toBe(false);
    expect(showErrorToast).toHaveBeenCalledWith('server.unexpected-response');
    expect(mockAfterDeleteAction).not.toHaveBeenCalled();
  });

  it('logs the current user out instead of running afterDeleteAction', async () => {
    expect(
      await runDelete(DeleteType.SOFT_DELETE, {
        entityId: CURRENT_USER_ID,
        entityType: EntityType.USER,
      })
    ).toBe(true);
    expect(mockOnLogoutHandler).toHaveBeenCalled();
    expect(mockAfterDeleteAction).not.toHaveBeenCalled();
  });

  it('hands an async delete to the async delete provider', async () => {
    mockAsyncDelete.mockResolvedValueOnce(undefined);

    expect(
      await runDelete(DeleteType.HARD_DELETE, { isAsyncDelete: true })
    ).toBe(true);
    expect(deleteEntity).not.toHaveBeenCalled();
    expect(mockAsyncDelete).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: 'team-id',
        deleteType: DeleteType.HARD_DELETE,
        isRecursiveDelete: false,
      })
    );
  });

  it('resolves false when the async delete throws', async () => {
    mockAsyncDelete.mockRejectedValueOnce(new Error('socket'));

    expect(
      await runDelete(DeleteType.HARD_DELETE, { isAsyncDelete: true })
    ).toBe(false);
  });
});
