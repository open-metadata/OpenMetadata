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

/**
 * Behavioral policy for permission resolution.
 *
 * Entries here decide WHAT permissions mean, as opposed to how they are
 * fetched (hooks/React Query) or derived (PermissionDerivation). They live in
 * one file so changing UI permission behavior is a single reviewable edit with
 * a known blast radius.
 *
 * Other centralized permission behavior decisions (not switches — each is a
 * single function to change, listed here so "where do I change X" is
 * answerable from this one file):
 *  (a) Deleted entities are read-only for edit operations
 *      → `getDerivedPermissionFlags` in `PermissionDerivation.ts`.
 *  (b) A field-level permission beats a blanket `EditAll` (deny-wins)
 *      → `getPrioritizedEditPermission` / `getPrioritizedViewPermission` in
 *        `PermissionsUtils.ts`.
 *  (c) The four-state backend `Access` → boolean translation
 *      → `toAllowedBoolean` in `PermissionsUtils.ts`.
 *  (d) Permission cache freshness
 *      → `PERMISSION_STALE_TIME` in `hooks/useEntityPermissions/permissionQueryKeys.ts`.
 */
export const PERMISSION_POLICY = {
  /**
   * Operations where a backend `conditionalAllow` or `conditionalDeny` is
   * read as PERMITTED at RESOURCE level — lists, route guards, sidebar
   * gating: places with no specific entity yet, so the backend could not
   * evaluate `isOwner()` / `hasDomain()` conditions and returned "depends on
   * the entity" rather than a hard Allow/Deny.
   *
   * Without an entity the backend evaluates no conditions: every rule with
   * a condition contributes conditionalAllow or conditionalDeny (by its
   * effect), and the highest-precedence value wins (deny > allow >
   * conditionalDeny > conditionalAllow > notAllow). So a conditional answer
   * means no unconditional rule matched and at least one conditional rule
   * did — both values mean "depends on the entity" and are treated alike.
   * E.g. the built-in DomainOnlyAccessPolicy (allow if hasDomain(), deny if
   * !hasDomain()) reports conditionalDeny.
   *
   * An operation in this set treats either as "can attempt" — the backend
   * still enforces the real condition per entity on every actual read/write,
   * so this only unblocks navigation/listing, never the write itself. An
   * operation NOT in this set stays strict: both count as DENIED, which is
   * byte-for-byte the pre-refactor behavior.
   *
   * Only View-class operations belong here. This is the fix for
   * OpenMetadata#31783, #33834 and #33356 (domain-scoped users wrongly blocked
   * from opening the Services lists, the Glossary / Data Quality sections and
   * specific entity pages, even though the entity-level check — which runs
   * once the entity is actually loaded — correctly grants access via the same
   * condition).
   *
   * Do NOT add Create/EditAll/Delete/Trigger-class operations here: some
   * bulk-write endpoints (e.g. glossary-term/tag bulk asset add-remove) use
   * this exact same entity-less resource-level check as REAL enforcement, not
   * just UI gating — widening it to writes would grant real cross-domain
   * bulk-write access. It would also flip
   * playwright/e2e/Features/Permissions/ServiceEntityPermissions.spec.ts:163
   * ("AutoPilot trigger button is hidden with view-only permission").
   *
   * ENTITY-level reads are always strict and deliberately NOT configurable:
   * there the backend has already evaluated the conditions for that entity.
   */
  resourceLevelConditionalOperations: new Set<Operation>([
    Operation.ViewBasic,
    Operation.ViewAll,
  ]),
} as const;
