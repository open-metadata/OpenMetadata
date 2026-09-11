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
import { act, ReactNode } from 'react';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Access } from '../../../generated/entity/policies/accessControl/resourcePermission';
import { TestDefinition } from '../../../generated/tests/testDefinition';
import { getEntityPermissionByFqn } from '../../../rest/permissionAPI';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { useTestDefinitionRowPermissions } from './useTestDefinitionRowPermissions';

// This hook is now folded onto useBulkEntityPermissions (Task 9) — the row
// fetch moved from usePermissionProvider().getEntityPermissionByFqn to
// rest/permissionAPI's getEntityPermissionByFqn (react-query owned), so the
// mock target moves with it. The resource-level create/view flags are
// untouched (still usePermissionProvider().permissions via checkPermission),
// so that mock stays as-is.
const MOCK_OPERATION_PERMISSION = {
  ViewAll: true,
  ViewBasic: true,
} as const;

const MOCK_API_RESPONSE = {
  resource: 'testDefinition',
  permissions: [
    { operation: 'ViewAll', access: Access.Allow },
    { operation: 'ViewBasic', access: Access.Allow },
  ],
};

const DEF_A = {
  name: 'defA',
  fullyQualifiedName: 'fqn.defA',
} as TestDefinition;
const DEF_B = {
  name: 'defB',
  fullyQualifiedName: 'fqn.defB',
} as TestDefinition;

const mockGetEntityPermissionByFqn = jest.fn();

jest.mock('../../../rest/permissionAPI', () => ({
  getEntityPermissionByFqn: (
    ...args: Parameters<typeof getEntityPermissionByFqn>
  ) => mockGetEntityPermissionByFqn(...args),
}));

// The provider mock reads `mockPermissions` at call time so a test can supply a
// grant/deny permission set before rendering and assert how the resource-level
// create/view flags are derived.
let mockPermissions: Record<string, Record<string, boolean>> = {
  testDefinition: { Create: true, ViewBasic: true, ViewAll: true },
};

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    permissions: mockPermissions,
  })),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const renderPermissions = () =>
  renderHook(() => useTestDefinitionRowPermissions(), {
    wrapper: createWrapper(),
  });

describe('useTestDefinitionRowPermissions', () => {
  beforeEach(() => {
    mockPermissions = {
      testDefinition: { Create: true, ViewBasic: true, ViewAll: true },
    };
    mockGetEntityPermissionByFqn
      .mockReset()
      .mockResolvedValue(MOCK_API_RESPONSE);
  });

  describe('return shape', () => {
    it('should start with an empty permission map, loading true and expose the fetcher', () => {
      const { result } = renderPermissions();

      const value = result.current;

      expect(value.testDefinitionPermissions).toEqual({});
      expect(value.permissionLoading).toBe(true);
      expect(typeof value.fetchTestDefinitionPermissions).toBe('function');
      expect(typeof value.createPermission).toBe('boolean');
      expect(typeof value.viewPermission).toBe('boolean');
    });
  });

  describe('resource level permissions', () => {
    it('should derive create and view permissions as true from a granting permission set', () => {
      const { result } = renderPermissions();

      expect(result.current.createPermission).toBe(true);
      expect(result.current.viewPermission).toBe(true);
    });

    it('should derive create false and view false from a denying permission set', () => {
      mockPermissions = {
        testDefinition: { Create: false, ViewBasic: false, ViewAll: false },
      };

      const { result } = renderPermissions();

      expect(result.current.createPermission).toBe(false);
      expect(result.current.viewPermission).toBe(false);
    });

    it('should derive view permission true when only ViewAll is granted', () => {
      mockPermissions = {
        testDefinition: { Create: false, ViewBasic: false, ViewAll: true },
      };

      const { result } = renderPermissions();

      expect(result.current.viewPermission).toBe(true);
    });
  });

  describe('fetchTestDefinitionPermissions', () => {
    it('should fan out one lookup per row keyed by name using the row fqn', async () => {
      const { result } = renderPermissions();

      await act(async () => {
        await result.current.fetchTestDefinitionPermissions([DEF_A, DEF_B]);
      });

      await waitFor(() =>
        expect(mockGetEntityPermissionByFqn).toHaveBeenCalledTimes(2)
      );

      expect(mockGetEntityPermissionByFqn).toHaveBeenCalledWith(
        ResourceEntity.TEST_DEFINITION,
        'fqn.defA'
      );
      expect(mockGetEntityPermissionByFqn).toHaveBeenCalledWith(
        ResourceEntity.TEST_DEFINITION,
        'fqn.defB'
      );

      await waitFor(() =>
        expect(result.current.testDefinitionPermissions).toEqual({
          defA: MOCK_OPERATION_PERMISSION,
          defB: MOCK_OPERATION_PERMISSION,
        })
      );
    });

    it('should fall back to DEFAULT_ENTITY_PERMISSION for a rejected lookup only', async () => {
      mockGetEntityPermissionByFqn.mockImplementation(
        (_resource: ResourceEntity, fqn: string) =>
          fqn === 'fqn.defB'
            ? Promise.reject(new Error('boom'))
            : Promise.resolve(MOCK_API_RESPONSE)
      );

      const { result } = renderPermissions();

      await act(async () => {
        await result.current.fetchTestDefinitionPermissions([DEF_A, DEF_B]);
      });

      await waitFor(() =>
        expect(result.current.testDefinitionPermissions).toEqual({
          defA: MOCK_OPERATION_PERMISSION,
          defB: DEFAULT_ENTITY_PERMISSION,
        })
      );
    });

    it('should skip the lookup and degrade to DEFAULT_ENTITY_PERMISSION for a row missing a fullyQualifiedName', async () => {
      // Behavior consequence of the fold (Task 9): useBulkEntityPermissions
      // filters falsy fqns out of its own query list (fqns.filter(Boolean)),
      // so a row with no identifier to query never reaches
      // getEntityPermissionByFqn at all — pre-fold, the empty string WAS
      // sent to the API (and this mock's default resolved value made that
      // row look granted). Degrading straight to DEFAULT_ENTITY_PERMISSION
      // without a network call is the more correct outcome for an
      // unidentifiable row (no false grant), and matches the fold's
      // prescribed shape (drive useBulkEntityPermissions off the stored
      // definitions' fqns).
      const { result } = renderPermissions();

      await act(async () => {
        await result.current.fetchTestDefinitionPermissions([
          { name: 'noFqn' } as TestDefinition,
        ]);
      });

      expect(mockGetEntityPermissionByFqn).not.toHaveBeenCalled();
      expect(result.current.testDefinitionPermissions).toEqual({
        noFqn: DEFAULT_ENTITY_PERMISSION,
      });
    });

    it('should short circuit an empty list to an empty map without any lookup', async () => {
      const { result } = renderPermissions();

      await act(async () => {
        await result.current.fetchTestDefinitionPermissions([]);
      });

      expect(mockGetEntityPermissionByFqn).not.toHaveBeenCalled();
      expect(result.current.testDefinitionPermissions).toEqual({});
      expect(result.current.permissionLoading).toBe(false);
    });

    it('should toggle permissionLoading true while in flight and false once settled', async () => {
      const { result } = renderPermissions();

      await act(async () => {
        await result.current.fetchTestDefinitionPermissions([]);
      });

      expect(result.current.permissionLoading).toBe(false);

      let resolvePermission: (value: unknown) => void = (_value) => undefined;
      mockGetEntityPermissionByFqn.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePermission = resolve;
          })
      );

      act(() => {
        result.current.fetchTestDefinitionPermissions([DEF_A]);
      });

      await waitFor(() => expect(result.current.permissionLoading).toBe(true));

      await act(async () => {
        resolvePermission(MOCK_API_RESPONSE);
      });

      await waitFor(() => {
        expect(result.current.permissionLoading).toBe(false);
      });
    });
  });
});
