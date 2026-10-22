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
import { ResourceEntity } from '../../../../../enums/permissions.enum';
import { User } from '../../../../../generated/entity/teams/user';
import { useEntityPermissions } from '../../../../../hooks/useEntityPermissions/useEntityPermissions';
import { useUserCustomPropertyAccess } from './useUserCustomPropertyAccess';

jest.mock(
  '../../../../../hooks/useEntityPermissions/useEntityPermissions',
  () => ({ useEntityPermissions: jest.fn() })
);

const mockPermissions = (flags: {
  canViewCustomFields: boolean;
  canEditCustomFields: boolean;
  isLoading?: boolean;
}) =>
  (useEntityPermissions as jest.Mock).mockReturnValue({
    isLoading: false,
    ...flags,
  });

const USER = { id: 'u1', name: 'alice', email: 'a@x.io' } as User;

describe('useUserCustomPropertyAccess', () => {
  it('reads the user entity permissions by name and passes the deleted flag', () => {
    mockPermissions({ canViewCustomFields: true, canEditCustomFields: true });

    renderHook(() => useUserCustomPropertyAccess({ ...USER, deleted: true }));

    expect(useEntityPermissions).toHaveBeenCalledWith(
      ResourceEntity.USER,
      'alice',
      { deleted: true, enabled: true }
    );
  });

  it('maps view and edit custom-field permissions', () => {
    mockPermissions({ canViewCustomFields: true, canEditCustomFields: false });

    const { result } = renderHook(() => useUserCustomPropertyAccess(USER));

    expect(result.current).toEqual({
      canView: true,
      canEdit: false,
      isLoading: false,
    });
  });

  it('never allows editing a deleted user', () => {
    mockPermissions({ canViewCustomFields: true, canEditCustomFields: true });

    const { result } = renderHook(() =>
      useUserCustomPropertyAccess({ ...USER, deleted: true })
    );

    expect(result.current.canEdit).toBe(false);
  });

  it('does not report loading without a user', () => {
    mockPermissions({
      canViewCustomFields: false,
      canEditCustomFields: false,
      isLoading: true,
    });

    const { result } = renderHook(() => useUserCustomPropertyAccess());

    expect(result.current.isLoading).toBe(false);
  });
});
