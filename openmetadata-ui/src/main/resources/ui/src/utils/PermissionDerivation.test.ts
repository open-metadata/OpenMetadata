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

import { Operation } from '../generated/entity/policies/policy';
import { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import { getDerivedPermissionFlags } from './PermissionDerivation';

const perms = (overrides: Partial<Record<Operation, boolean>>): OperationPermission =>
  ({ ...overrides } as OperationPermission);

describe('getDerivedPermissionFlags', () => {
  it('field-level edit permission wins over EditAll (prioritization)', () => {
    const flags = getDerivedPermissionFlags(
      perms({ [Operation.EditTags]: false, [Operation.EditAll]: true })
    );
    expect(flags.canEditTags).toBe(false); // explicit field denial beats EditAll
    expect(flags.canEditDescription).toBe(true); // absent field falls back to EditAll
  });

  it('EditAll=false with no field grants denies everything editable', () => {
    const flags = getDerivedPermissionFlags(perms({ [Operation.EditAll]: false }));
    expect(flags.canEditTags).toBe(false);
    expect(flags.canEditAll).toBe(false);
  });

  it('deleted=true switches off every edit flag but not view or delete', () => {
    const flags = getDerivedPermissionFlags(
      perms({
        [Operation.EditAll]: true,
        [Operation.Delete]: true,
        [Operation.ViewAll]: true,
      }),
      true
    );
    expect(flags.canEditTags).toBe(false);
    expect(flags.canEditAll).toBe(false);
    expect(flags.canDelete).toBe(true); // restore/hard-delete still offered
    expect(flags.canViewSampleData).toBe(true);
  });

  it('view flags prioritize field over ViewAll', () => {
    const flags = getDerivedPermissionFlags(
      perms({ [Operation.ViewSampleData]: false, [Operation.ViewAll]: true })
    );
    expect(flags.canViewSampleData).toBe(false);
    expect(flags.canViewQueries).toBe(true);
  });

  it('flags are real booleans even when no keys exist (never undefined)', () => {
    const flags = getDerivedPermissionFlags(perms({}));
    expect(flags.canEditTags).toBe(false); // not undefined
    expect(flags.canViewSampleData).toBe(false);
  });

  it('hasViewAccess is ViewBasic OR ViewAll', () => {
    expect(
      getDerivedPermissionFlags(perms({ [Operation.ViewBasic]: true })).hasViewAccess
    ).toBe(true);
    expect(getDerivedPermissionFlags(perms({})).hasViewAccess).toBeFalsy();
  });

  it('can() escape hatch applies edit prioritization for Edit* and view for View*', () => {
    const flags = getDerivedPermissionFlags(perms({ [Operation.EditAll]: true }));
    expect(flags.can(Operation.EditUsers)).toBe(true); // falls back to EditAll
    expect(flags.can(Operation.Trigger)).toBeFalsy(); // non-edit op: direct lookup only
  });

  it('can() respects deleted for edit operations', () => {
    const flags = getDerivedPermissionFlags(perms({ [Operation.EditAll]: true }), true);
    expect(flags.can(Operation.EditUsers)).toBe(false);
  });
});
