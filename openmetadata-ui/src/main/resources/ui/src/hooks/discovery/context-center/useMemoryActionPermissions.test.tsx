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
import { ReactNode } from 'react';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ResourceEntity } from '../../../enums/permissions.enum';
import { ContextMemory } from '../../../generated/entity/context/contextMemory';
import {
  Access,
  ResourcePermission,
} from '../../../generated/entity/policies/accessControl/resourcePermission';
import { Operation } from '../../../generated/entity/policies/policy';
import { getEntityPermissionByFqn } from '../../../rest/permissionAPI';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { useApplicationStore } from '../../useApplicationStore';
import { permissionQueryKeys } from '../../useEntityPermissions/permissionQueryKeys';
import {
  NO_MEMORY_ACTIONS,
  useMemoryActionPermissions,
} from './useMemoryActionPermissions';

jest.mock('../../../rest/permissionAPI', () => ({
  getEntityPermissionByFqn: jest.fn(),
}));

const mockGetEntityPermissionByFqn = getEntityPermissionByFqn as jest.Mock;

const USER = { id: 'user-1', name: 'pw.owner', email: 'pw.owner@x.org' };

const memoryOwnedBy = (name: string, owner: string): ContextMemory => ({
  id: `${name}-id`,
  name,
  fullyQualifiedName: name,
  question: name,
  answer: name,
  owners: [{ id: `${owner}-id`, name: owner, type: 'user' }],
});

const OWN = memoryOwnedBy('own', USER.name);
const OTHERS = memoryOwnedBy('others', 'someone.else');

const answer = (access: Access): ResourcePermission => ({
  resource: ResourceEntity.CONTEXT_MEMORY,
  permissions: [
    { operation: Operation.EditAll, access },
    { operation: Operation.Delete, access },
  ],
});

const deferred = () => {
  let resolve: (value: ResourcePermission) => void = () => undefined;
  const promise = new Promise<ResourcePermission>((done) => {
    resolve = done;
  });

  return { promise, resolve };
};

const setup = (
  memories: Array<ContextMemory | undefined>,
  resourcePermission: OperationPermission = DEFAULT_ENTITY_PERMISSION
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    ({ targets }) => useMemoryActionPermissions(targets, resourcePermission),
    { initialProps: { targets: memories }, wrapper }
  );
  const queryStatus = (fqn: string) =>
    queryClient.getQueryState(
      permissionQueryKeys.entity(ResourceEntity.CONTEXT_MEMORY, fqn)
    )?.status;

  return { ...hook, queryStatus };
};

describe('useMemoryActionPermissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useApplicationStore.setState({
      currentUser: { ...USER, isAdmin: false },
    });
    mockGetEntityPermissionByFqn.mockResolvedValue(answer(Access.Allow));
  });

  it("lets the owner edit and delete from the memory's own permission when the resource level says no", async () => {
    const { result } = setup([OWN]);

    await waitFor(() =>
      expect(result.current.getMemoryActions(OWN)).toEqual({
        canEdit: true,
        canDelete: true,
      })
    );
  });

  it('looks up only the memories the user owns', async () => {
    const { result } = setup([OWN, OTHERS]);

    await waitFor(() =>
      expect(result.current.getMemoryActions(OWN).canEdit).toBe(true)
    );

    expect(mockGetEntityPermissionByFqn.mock.calls).toEqual([
      [ResourceEntity.CONTEXT_MEMORY, OWN.fullyQualifiedName],
    ]);
    expect(result.current.getMemoryActions(OTHERS)).toEqual(NO_MEMORY_ACTIONS);
  });

  it('answers an admin from the resource level without a lookup', () => {
    useApplicationStore.setState({ currentUser: { ...USER, isAdmin: true } });

    const { result } = setup([OWN, OTHERS], {
      ...DEFAULT_ENTITY_PERMISSION,
      EditAll: true,
      Delete: true,
    });

    expect(result.current.getMemoryActions(OTHERS)).toEqual({
      canEdit: true,
      canDelete: true,
    });
    expect(mockGetEntityPermissionByFqn).not.toHaveBeenCalled();
  });

  it('offers no action when the lookup fails', async () => {
    mockGetEntityPermissionByFqn.mockRejectedValue(new Error('403'));

    const { result, queryStatus } = setup([OWN]);

    await waitFor(() => expect(queryStatus('own')).toBe('error'));

    expect(result.current.getMemoryActions(OWN)).toEqual(NO_MEMORY_ACTIONS);
  });

  it("never hands one memory's late answer to the memory shown after it", async () => {
    const own = deferred();
    const next = memoryOwnedBy('next', USER.name);
    mockGetEntityPermissionByFqn.mockImplementation(
      (_resource: ResourceEntity, fqn: string) =>
        fqn === 'own' ? own.promise : Promise.resolve(answer(Access.NotAllow))
    );

    const { result, rerender, queryStatus } = setup([OWN]);

    expect(result.current.getMemoryActions(OWN)).toEqual(NO_MEMORY_ACTIONS);

    rerender({ targets: [next] });
    await waitFor(() => expect(queryStatus('next')).toBe('success'));
    own.resolve(answer(Access.Allow));
    await waitFor(() => expect(queryStatus('own')).toBe('success'));

    expect(result.current.getMemoryActions(next)).toEqual(NO_MEMORY_ACTIONS);
    expect(result.current.getMemoryActions(OWN)).toEqual(NO_MEMORY_ACTIONS);
  });

  it('lets the owner delete but not edit a soft-deleted memory', async () => {
    const deletedMemory = { ...OWN, deleted: true };

    const { result } = setup([deletedMemory]);

    await waitFor(() =>
      expect(result.current.getMemoryActions(deletedMemory)).toEqual({
        canEdit: false,
        canDelete: true,
      })
    );
  });

  it('looks up a memory listed twice once', async () => {
    const { result } = setup([OWN, { ...OWN }, undefined]);

    await waitFor(() =>
      expect(result.current.getMemoryActions(OWN).canEdit).toBe(true)
    );

    expect(mockGetEntityPermissionByFqn).toHaveBeenCalledTimes(1);
    expect(result.current.getMemoryActions(undefined)).toEqual(
      NO_MEMORY_ACTIONS
    );
  });
});
