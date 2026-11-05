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
  it('ships as "strict" — behavior parity with base commit 9cf866cd23', () => {
    // Locks the live default. This is the assertion that fails loudly if
    // someone flips the switch without meaning to (or without updating the
    // Playwright suite documented in permissionPolicy.ts).
    expect(PERMISSION_POLICY.resourceLevelConditionalAllow).toBe('strict');
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

  it('the live policy setting reproduces the "strict" row above end-to-end', () => {
    const allowConditional =
      PERMISSION_POLICY.resourceLevelConditionalAllow === 'attempt';
    const permissions = getOperationPermissions(
      resourcePermission(Access.ConditionalAllow),
      allowConditional
    );

    // While the policy stays 'strict' this must be denied — the same
    // observable behavior PermissionProvider.tsx's RESOURCE_ALLOW_CONDITIONAL
    // produces for every logged-in-user / resource-level permission fetch.
    expect(permissions[Operation.ViewAll]).toBe(false);
  });
});
