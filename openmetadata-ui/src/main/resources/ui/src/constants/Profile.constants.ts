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

// Single source of truth for the profile modal's nav ids: the `ProfileNavId`
// type and the runtime `PROFILE_NAV_IDS` Set are both derived from this tuple so
// they can never drift (a missing id makes `parseHash` reject that tab, which
// closes the modal and breaks the panel's hash sync).
export const PROFILE_NAV_ID_LIST = [
  'profile',
  'permissions',
  'access-token',
  'my-connections',
  'access-control',
  'bots',
  'custom-properties',
  'notification',
  'members',
] as const;

export type ProfileNavId = (typeof PROFILE_NAV_ID_LIST)[number];

// Typed as a string set so `.has(arbitraryString)` (hash parsing) type-checks.
export const PROFILE_NAV_IDS: ReadonlySet<string> = new Set(
  PROFILE_NAV_ID_LIST
);
