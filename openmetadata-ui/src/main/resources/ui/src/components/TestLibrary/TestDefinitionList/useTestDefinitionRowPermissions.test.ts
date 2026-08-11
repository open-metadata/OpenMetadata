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
import { act } from 'react';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { TestDefinition } from '../../../generated/tests/testDefinition';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { useTestDefinitionRowPermissions } from './useTestDefinitionRowPermissions';

const MOCK_PERMISSION = {
  ViewAll: true,
  ViewBasic: true,
} as unknown as OperationPermission;

const DEF_A = {
  name: 'defA',
  fullyQualifiedName: 'fqn.defA',
} as TestDefinition;
const DEF_B = {
  name: 'defB',
  fullyQualifiedName: 'fqn.defB',
} as TestDefinition;

const mockGetEntityPermissionByFqn = jest.fn();

// The provider mock reads `mockPermissions` at call time so a test can supply a
// grant/deny permission set before rendering and assert how the resource-level
// create/view flags are derived.
let mockPermissions: Record<string, Record<string, boolean>> = {
  testDefinition: { Create: true, ViewBasic: true, ViewAll: true },
};

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    permissions: mockPermissions,
    getEntityPermissionByFqn: mockGetEntityPermissionByFqn,
  })),
}));

const renderPermissions = () =>
  renderHook(() => useTestDefinitionRowPermissions());

describe('useTestDefinitionRowPermissions', () => {
  beforeEach(() => {
    mockPermissions = {
      testDefinition: { Create: true, ViewBasic: true, ViewAll: true },
    };
    mockGetEntityPermissionByFqn.mockReset().mockResolvedValue(MOCK_PERMISSION);
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

      expect(mockGetEntityPermissionByFqn).toHaveBeenCalledTimes(2);
      expect(mockGetEntityPermissionByFqn).toHaveBeenNthCalledWith(
        1,
        ResourceEntity.TEST_DEFINITION,
        'fqn.defA'
      );
      expect(mockGetEntityPermissionByFqn).toHaveBeenNthCalledWith(
        2,
        ResourceEntity.TEST_DEFINITION,
        'fqn.defB'
      );
      expect(result.current.testDefinitionPermissions).toEqual({
        defA: MOCK_PERMISSION,
        defB: MOCK_PERMISSION,
      });
    });

    it('should fall back to DEFAULT_ENTITY_PERMISSION for a rejected lookup only', async () => {
      mockGetEntityPermissionByFqn
        .mockReset()
        .mockResolvedValueOnce(MOCK_PERMISSION)
        .mockRejectedValueOnce(new Error('boom'));

      const { result } = renderPermissions();

      await act(async () => {
        await result.current.fetchTestDefinitionPermissions([DEF_A, DEF_B]);
      });

      expect(result.current.testDefinitionPermissions).toEqual({
        defA: MOCK_PERMISSION,
        defB: DEFAULT_ENTITY_PERMISSION,
      });
    });

    it('should pass an empty fqn string for a row missing a fullyQualifiedName', async () => {
      const { result } = renderPermissions();

      await act(async () => {
        await result.current.fetchTestDefinitionPermissions([
          { name: 'noFqn' } as TestDefinition,
        ]);
      });

      expect(mockGetEntityPermissionByFqn).toHaveBeenCalledWith(
        ResourceEntity.TEST_DEFINITION,
        ''
      );
      expect(result.current.testDefinitionPermissions).toEqual({
        noFqn: MOCK_PERMISSION,
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

      let resolvePermission: (value: unknown) => void = () => undefined;
      mockGetEntityPermissionByFqn.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePermission = resolve;
          })
      );

      act(() => {
        result.current.fetchTestDefinitionPermissions([DEF_A]);
      });

      expect(result.current.permissionLoading).toBe(true);

      await act(async () => {
        resolvePermission(MOCK_PERMISSION);
      });

      await waitFor(() => {
        expect(result.current.permissionLoading).toBe(false);
      });
    });
  });
});
