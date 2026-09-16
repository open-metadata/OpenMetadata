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

const resourcePermission = (access: Access, op = Operation.ViewAll) => ({
  resource: 'databaseService',
  permissions: [{ operation: op, access }],
});

describe('permissionPolicy — resourceLevelConditionalAllow seam', () => {
  it('ships as "view-only" — targeted fix for #31783 and #33356', () => {
    // Locks the live default. This assertion fails loudly if someone flips the
    // switch without updating the surrounding documentation.
    expect(PERMISSION_POLICY.resourceLevelConditionalAllow).toBe('view-only');
  });

  // Verifies the two raw modes independently (using local literals, not
  // mutating the frozen policy object) so behavior is proven before any switch flip.
  describe.each([
    ['strict', false],
    ['view-only', true],
  ] as const)('mode = %s (ViewAll)', (mode, expectAllowed) => {
    const allowConditional =
      mode === 'view-only'
        ? (op: Operation) => op === Operation.ViewAll
        : false;

    it(`translates a resource-level conditionalAllow to ${expectAllowed} for ViewAll`, () => {
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

  it('view-only mode keeps non-view operations (Trigger) strict even when CONDITIONAL_ALLOW', () => {
    // OrganizationPolicy isOwner() grants All:CONDITIONAL_ALLOW to every user.
    // In view-only mode only ViewBasic/ViewAll become true — action buttons must stay hidden.
    const viewOnlyFn = (op: Operation) =>
      op === Operation.ViewBasic || op === Operation.ViewAll;
    const permissions = getOperationPermissions(
      resourcePermission(Access.ConditionalAllow, Operation.Trigger),
      viewOnlyFn
    );

    expect(permissions[Operation.Trigger]).toBe(false);
  });

  it('the live policy setting allows ViewAll but denies Trigger for CONDITIONAL_ALLOW end-to-end', () => {
    const viewOnlyFn =
      PERMISSION_POLICY.resourceLevelConditionalAllow === 'view-only'
        ? (op: Operation) =>
            op === Operation.ViewBasic || op === Operation.ViewAll
        : () => false;

    const viewPerms = getOperationPermissions(
      resourcePermission(Access.ConditionalAllow, Operation.ViewAll),
      viewOnlyFn
    );
    const triggerPerms = getOperationPermissions(
      resourcePermission(Access.ConditionalAllow, Operation.Trigger),
      viewOnlyFn
    );

    // Domain-scoped users can reach entity pages (route guards use ViewAll).
    expect(viewPerms[Operation.ViewAll]).toBe(true);
    // Action buttons stay hidden — Trigger stays false even under CONDITIONAL_ALLOW.
    expect(triggerPerms[Operation.Trigger]).toBe(false);
  });
});
