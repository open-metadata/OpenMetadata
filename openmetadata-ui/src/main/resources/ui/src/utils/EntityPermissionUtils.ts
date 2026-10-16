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

import {
  CUSTOM_PROPERTIES_TABS_SET,
  LINEAGE_TABS_SET,
  SCHEMA_TABS_SET,
} from '../components/Entity/EntityRightPanel/EntityRightPanelVerticalNav.constants';
import { EntityType } from '../enums/entity.enum';
import { User } from '../generated/entity/teams/user';
import { EntityReference } from '../generated/type/entityUsage';

export const hasSchemaTab = (entityType: EntityType): boolean =>
  SCHEMA_TABS_SET.has(entityType);

export const hasLineageTab = (entityType: EntityType): boolean =>
  LINEAGE_TABS_SET.has(entityType);

export const hasCustomPropertiesTab = (entityType: EntityType): boolean =>
  CUSTOM_PROPERTIES_TABS_SET.has(entityType);

export const hasEditAccess = (owners: EntityReference[], currentUser: User) => {
  return owners.some((owner) => {
    if (owner.type === 'user') {
      return owner.id === currentUser.id;
    } else {
      return Boolean(
        currentUser.teams?.length &&
          currentUser.teams.some((team) => team.id === owner.id)
      );
    }
  });
};
