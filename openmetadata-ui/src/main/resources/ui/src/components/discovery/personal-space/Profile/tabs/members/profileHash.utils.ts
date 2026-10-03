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

import { viewToSubPath as acViewToSubPath } from '../access-control/AccessControl.utils';
import { viewToSubPath as membersViewToSubPath } from './Members.utils';

/**
 * A destination inside the personal-space Profile modal, expressed as the
 * `useSettingsHash` tab + sub-path. One source of truth so both href links
 * (`toHashLocation`) and the `setHash` fallback build the exact same hash.
 */
export interface ProfileHashTarget {
  tab: string;
  subPath?: string;
}

/**
 * Builders for the in-modal destinations. Role/policy/team reuse the existing
 * `viewToSubPath` encoders so the sub-paths round-trip through the same parsers
 * (`access-control` and `members`), avoiding divergent encoding.
 */
export const profileHash = {
  user: (name: string): ProfileHashTarget => ({
    tab: 'profile',
    subPath: encodeURIComponent(name),
  }),
  role: (fqn: string): ProfileHashTarget => ({
    tab: 'access-control',
    subPath: acViewToSubPath({ type: 'roles-detail', fqn, name: fqn }),
  }),
  policy: (fqn: string): ProfileHashTarget => ({
    tab: 'access-control',
    subPath: acViewToSubPath({ type: 'policies-detail', fqn, name: fqn }),
  }),
  team: (fqn: string): ProfileHashTarget => ({
    tab: 'members',
    subPath: membersViewToSubPath({ type: 'team-detail', fqn, name: fqn }),
  }),
};

/** Adapter for a react-router `<Link to={...}>` — keeps pathname/search, swaps the hash. */
export const toHashLocation = ({ tab, subPath }: ProfileHashTarget): { hash: string } => ({
  hash: subPath ? `${tab}/${subPath}` : tab,
});
