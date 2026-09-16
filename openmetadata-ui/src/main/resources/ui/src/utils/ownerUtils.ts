/*
 *  Copyright 2025 Collate.
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
import type { OwnerRef } from '@openmetadata/ui-core-components';
import { OwnerType } from '../enums/user.enum';
import { EntityReference } from '../generated/entity/data/table';
import { toOwnerRefs } from './Owner/ownerConversionUtils';
import { getTeamAndUserDetailsPath, getUserPath } from './RouterUtils';

/**
 * Returns the appropriate path for an owner link based on owner type
 */
export const getOwnerPath = (owner: EntityReference): string => {
  // A team's FQN equals its name; owner references frequently omit
  // fullyQualifiedName, so fall back to name to avoid linking every team to
  // the Organization page.
  return owner.type === OwnerType.TEAM
    ? getTeamAndUserDetailsPath(owner.fullyQualifiedName ?? owner.name ?? '')
    : getUserPath(owner.name ?? '');
};

/**
 * Converts owner EntityReferences into core-component OwnerRefs whose `href`
 * points to the in-app profile route (getOwnerPath). `toOwnerRefs` alone copies
 * EntityReference.href, which is the backend API self-link (/api/v1/users/<id>);
 * <Owner> renders the owner name as `<a href>`, so a non-compact owner built
 * from plain `toOwnerRefs` links to the API and returns 401 on click. Use this
 * for any non-compact <Owner> whose names are rendered as links.
 */
export const getOwnersWithHref = (owners?: EntityReference[]): OwnerRef[] =>
  toOwnerRefs(owners ?? []).map((owner) => ({
    ...owner,
    href: getOwnerPath({
      id: owner.id,
      name: owner.name,
      type: owner.type,
    } as EntityReference),
  }));
