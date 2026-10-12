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

import { Access } from '../generated/entity/policies/accessControl/resourcePermission';
import { Operation } from '../generated/entity/policies/policy';
import { getOperationPermissions, getUIPermission } from './PermissionsUtils';

const resourcePermission = (access: Access) => ({
  resource: 'databaseService',
  permissions: [{ operation: Operation.ViewAll, access }],
});

describe('conditionalAllow translation (#31783)', () => {
  it('entity-level (default) keeps conditionalAllow as false', () => {
    const op = getOperationPermissions(
      resourcePermission(Access.ConditionalAllow)
    );

    expect(op[Operation.ViewAll]).toBe(false);
  });

  it('resource-level (allowConditional) treats conditionalAllow as true', () => {
    const op = getOperationPermissions(
      resourcePermission(Access.ConditionalAllow),
      true
    );

    expect(op[Operation.ViewAll]).toBe(true);
  });

  it('deny and conditionalDeny stay false in both modes', () => {
    for (const access of [
      Access.Deny,
      Access.ConditionalDeny,
      Access.NotAllow,
    ]) {
      expect(
        getOperationPermissions(resourcePermission(access))[Operation.ViewAll]
      ).toBe(false);
      expect(
        getOperationPermissions(resourcePermission(access), true)[
          Operation.ViewAll
        ]
      ).toBe(false);
    }
  });

  // The exhaustive switch's `never` guard is compile-time only. `access` is network data, so
  // a state the generated enum does not yet carry (backend shipped it before the types were
  // regenerated) reaches the default branch at runtime. It must deny — this is the single
  // seam every entity/resource permission flows through, so failing open would grant access
  // app-wide. The cast is the point of the test: it reproduces exactly what the type system
  // cannot see.
  it('denies an Access value the generated enum does not carry (fails closed)', () => {
    const unknownAccess = 'someFutureAccessState' as Access;

    expect(
      getOperationPermissions(resourcePermission(unknownAccess))[
        Operation.ViewAll
      ]
    ).toBe(false);
    expect(
      getOperationPermissions(resourcePermission(unknownAccess), true)[
        Operation.ViewAll
      ]
    ).toBe(false);
  });

  it('getUIPermission forwards allowConditional', () => {
    const ui = getUIPermission(
      [resourcePermission(Access.ConditionalAllow)],
      true
    );

    expect(ui.databaseService[Operation.ViewAll]).toBe(true);
  });
});
