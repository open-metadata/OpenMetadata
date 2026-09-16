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

const resourcePermission = (access: Access) => ({
  resource: 'databaseService',
  permissions: [{ operation: Operation.ViewAll, access }],
});

describe('permissionPolicy — resourceLevelConditionalAllow seam', () => {
  it('ships as "attempt" — fix for #31783 and #33356', () => {
    // Locks the live default. This is the assertion that fails loudly if
    // someone flips the switch without updating the surrounding documentation.
    expect(PERMISSION_POLICY.resourceLevelConditionalAllow).toBe('attempt');
  });

  // Exercises the translation the same way PermissionProvider.tsx derives
  // `allowConditional` from the policy (`=== 'attempt'`), for BOTH policy
  // values — so the 'attempt' path (the #31783 fix) is proven correct
  // *before* anyone flips PERMISSION_POLICY.resourceLevelConditionalAllow.
  // Uses local literal mode values rather than mutating the frozen policy
  // object (its property is typed readonly via `as const`).
  describe.each([
    ['strict', false],
    ['attempt', true],
  ] as const)('mode = %s', (mode, expectAllowed) => {
    const allowConditional = mode === 'attempt';

    it(`translates a resource-level conditionalAllow to ${expectAllowed}`, () => {
      const permissions = getOperationPermissions(
        resourcePermission(Access.ConditionalAllow),
        allowConditional
      );

      expect(permissions[Operation.ViewAll]).toBe(expectAllowed);
    });

    it('leaves an explicit Allow unaffected', () => {
      const permissions = getOperationPermissions(
        resourcePermission(Access.Allow),
        allowConditional
      );

      expect(permissions[Operation.ViewAll]).toBe(true);
    });

    it('leaves an explicit Deny unaffected', () => {
      const permissions = getOperationPermissions(
        resourcePermission(Access.Deny),
        allowConditional
      );

      expect(permissions[Operation.ViewAll]).toBe(false);
    });
  });

  it('the live policy setting reproduces the "attempt" row above end-to-end', () => {
    const allowConditional =
      PERMISSION_POLICY.resourceLevelConditionalAllow === 'attempt';
    const permissions = getOperationPermissions(
      resourcePermission(Access.ConditionalAllow),
      allowConditional
    );

    // Now that the policy is 'attempt', CONDITIONAL_ALLOW at resource level
    // must be permitted — domain-scoped users can reach entity pages and the
    // backend enforces per-entity access on every real read/write.
    expect(permissions[Operation.ViewAll]).toBe(true);
  });
});
