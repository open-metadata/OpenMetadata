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
import { PERMISSION_POLICY } from './permissionPolicy';
import { getOperationPermissions } from './PermissionsUtils';

const resourcePermission = (operation: Operation, access: Access) => ({
  resource: 'databaseService',
  permissions: [{ operation, access }],
});

// Mirrors PermissionProvider.tsx's RESOURCE_ALLOW_CONDITIONAL derivation.
const resourceAllowConditional = (operation: Operation) =>
  PERMISSION_POLICY.resourceLevelConditionalOperations.has(operation);

// Both resource-level "depends on the entity" answers; which one the backend
// reports depends only on whether a matching conditional rule has a deny effect.
const CONDITIONAL_ACCESS = [Access.ConditionalAllow, Access.ConditionalDeny];

describe('permissionPolicy — resourceLevelConditionalOperations seam', () => {
  it('allow-lists exactly ViewBasic and ViewAll — the fix for OpenMetadata#31783, #33834 and #33356', () => {
    // Locks the live default. Fails loudly if someone widens the allow-list
    // to a Create/Edit/Delete/Trigger-class operation, which would turn a
    // UI navigation fix into real cross-domain write access (see
    // permissionPolicy.ts for why those endpoints treat this check as
    // enforcement, not just gating).
    expect(
      Array.from(PERMISSION_POLICY.resourceLevelConditionalOperations).sort()
    ).toEqual([Operation.ViewAll, Operation.ViewBasic].sort());
  });

  describe.each([Operation.ViewBasic, Operation.ViewAll])(
    'operation = %s (allow-listed)',
    (operation) => {
      it.each(CONDITIONAL_ACCESS)(
        'translates a resource-level %s to permitted',
        (access) => {
          const permissions = getOperationPermissions(
            resourcePermission(operation, access),
            resourceAllowConditional
          );

          expect(permissions[operation]).toBe(true);
        }
      );

      it('leaves an explicit Allow unaffected', () => {
        const permissions = getOperationPermissions(
          resourcePermission(operation, Access.Allow),
          resourceAllowConditional
        );

        expect(permissions[operation]).toBe(true);
      });

      it('leaves an explicit Deny unaffected', () => {
        const permissions = getOperationPermissions(
          resourcePermission(operation, Access.Deny),
          resourceAllowConditional
        );

        expect(permissions[operation]).toBe(false);
      });
    }
  );

  describe.each([
    Operation.Create,
    Operation.EditAll,
    Operation.Delete,
    Operation.Trigger,
  ])('operation = %s (stays strict)', (operation) => {
    it.each(CONDITIONAL_ACCESS)(
      'a resource-level %s stays denied',
      (access) => {
        const permissions = getOperationPermissions(
          resourcePermission(operation, access),
          resourceAllowConditional
        );

        expect(permissions[operation]).toBe(false);
      }
    );
  });

  it.each(CONDITIONAL_ACCESS)(
    'entity-level gating (no allowConditional passed) keeps %s strict regardless of operation',
    (access) => {
      const permissions = getOperationPermissions(
        resourcePermission(Operation.ViewBasic, access)
      );

      expect(permissions[Operation.ViewBasic]).toBe(false);
    }
  );
});
