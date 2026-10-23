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
import { renderHook } from '@testing-library/react';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ResourceEntity } from '../../../enums/permissions.enum';
import { User } from '../../../generated/entity/teams/user';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import {
  useEntityPermissions,
  UseEntityPermissionsOptions,
} from '../../useEntityPermissions/useEntityPermissions';
import { useUserCustomPropertyAccess } from './useUserCustomPropertyAccess';

jest.mock('../../useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: jest.fn(),
}));

// Mock the hook, run the real derivation (incl. its `deleted` gating).
const mockPermissions = (
  grants: Partial<OperationPermission>,
  isLoading = false
) =>
  (useEntityPermissions as jest.Mock).mockImplementation(
    (
      _resource: ResourceEntity,
      _fqn: string,
      options?: UseEntityPermissionsOptions
    ) => {
      const permissions = {
        ...DEFAULT_ENTITY_PERMISSION,
        ...grants,
      } as OperationPermission;

      return {
        permissions,
        isLoading,
        error: null,
        refresh: jest.fn(),
        ...getDerivedPermissionFlags(permissions, options?.deleted),
      };
    }
  );

const USER = { id: 'u1', name: 'alice', email: 'a@x.io' } as User;

describe('useUserCustomPropertyAccess', () => {
  it('reads the user entity permissions by name and passes the deleted flag', () => {
    mockPermissions({ ViewCustomFields: true, EditCustomFields: true });

    renderHook(() => useUserCustomPropertyAccess({ ...USER, deleted: true }));

    expect(useEntityPermissions).toHaveBeenCalledWith(
      ResourceEntity.USER,
      'alice',
      { deleted: true, enabled: true }
    );
  });

  it('maps view and edit custom-field permissions', () => {
    mockPermissions({ ViewCustomFields: true, EditCustomFields: false });

    const { result } = renderHook(() => useUserCustomPropertyAccess(USER));

    expect(result.current).toEqual({
      canView: true,
      canEdit: false,
      isLoading: false,
    });
  });

  it('never allows editing a deleted user', () => {
    mockPermissions({ ViewCustomFields: true, EditCustomFields: true });

    const { result } = renderHook(() =>
      useUserCustomPropertyAccess({ ...USER, deleted: true })
    );

    expect(result.current).toEqual(
      expect.objectContaining({ canView: true, canEdit: false })
    );
  });

  it('does not report loading without a user', () => {
    mockPermissions({}, true);

    const { result } = renderHook(() => useUserCustomPropertyAccess());

    expect(result.current.isLoading).toBe(false);
  });
});
