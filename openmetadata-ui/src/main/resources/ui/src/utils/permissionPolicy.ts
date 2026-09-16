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
   * How a backend `conditionalAllow` is read at RESOURCE level — lists, route
   * guards, create buttons: places with no specific entity yet, so the backend
   * could not evaluate `isOwner()` / `hasDomain()` conditions.
   *
   * 'strict'  — conditionalAllow counts as DENIED.
   * 'attempt' — conditionalAllow counts as PERMITTED ("can attempt"); the
   *            backend still enforces per entity on every real read/write.
   *            Fixes OpenMetadata#31783 and OpenMetadata#33356: domain-scoped
   *            users were wrongly blocked by route guards before any entity-level
   *            permission call was made, because the bulk /permissions response
   *            returns CONDITIONAL_ALLOW (no entity context) which strict mode
   *            maps to false.
   *
   * ServiceEntityPermissions.spec.ts:163 ("AutoPilot trigger button is hidden
   * with view-only permission") is NOT affected: that test user holds a concrete
   * ViewAll:ALLOW from VIEW_ALL_RULE, not a CONDITIONAL_ALLOW, so toAllowedBoolean
   * is unchanged for it.
   *
   * ENTITY-level reads are always strict and deliberately NOT configurable:
   * there the backend has already evaluated the conditions for that entity.
   */
  resourceLevelConditionalAllow: 'attempt' as 'strict' | 'attempt',
} as const;
