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

import { SelectItemType } from '@openmetadata/ui-core-components';
import { capitalize } from 'lodash';
import { SearchDropdownOption } from '../../../../../../components/SearchDropdown/SearchDropdown.interface';
import { EntityType } from '../../../../../../enums/entity.enum';
import {
  Effect,
  Rule,
} from '../../../../../../generated/api/policies/createPolicy';
import { EntityIconSize } from '../../../../../../utils/EntityIconUtils';
import { getEntityNameLabel } from '../../../../../../utils/EntityNameUtils';
import { getCanonicalEntityType } from '../../../../../../utils/ExplorePureUtils';
import searchClassBase from '../../../../../../utils/SearchClassBase';
import {
  PERMISSION_OPERATIONS,
  PERMISSION_RESOURCES,
} from '../../../../../Settings/Users/AdminPermissionDebugger/AdminPermissionDebugger.constants';
import { EntityTypeOption } from './AccessControl.types';

export const INITIAL_RULE: Rule = {
  condition: '',
  description: '',
  effect: Effect.Allow,
  name: '',
  operations: [],
  resources: [],
};

export const EFFECT_ITEMS: SelectItemType[] = [
  { id: Effect.Allow, label: capitalize(Effect.Allow) },
  { id: Effect.Deny, label: capitalize(Effect.Deny) },
];

export const EXPORT_POLL_INTERVAL_MS = 5000;

const POLICY_ENTITY_TYPES = [
  EntityType.TABLE,
  EntityType.TOPIC,
  EntityType.DASHBOARD,
  EntityType.PIPELINE,
  EntityType.MLMODEL,
  EntityType.CONTAINER,
  EntityType.SEARCH_INDEX,
  EntityType.STORED_PROCEDURE,
  EntityType.DASHBOARD_DATA_MODEL,
  EntityType.CHART,
  EntityType.DATABASE,
  EntityType.DATABASE_SCHEMA,
  EntityType.QUERY,
  EntityType.API_COLLECTION,
  EntityType.API_ENDPOINT,
  EntityType.METRIC,
  EntityType.GLOSSARY,
  EntityType.GLOSSARY_TERM,
  EntityType.CLASSIFICATION,
  EntityType.TAG,
  EntityType.DOMAIN,
  EntityType.DATA_PRODUCT,
  EntityType.USER,
  EntityType.TEAM,
  EntityType.BOT,
  EntityType.PERSONA,
  EntityType.ROLE,
  EntityType.POLICY,
  EntityType.DATABASE_SERVICE,
  EntityType.MESSAGING_SERVICE,
  EntityType.DASHBOARD_SERVICE,
  EntityType.PIPELINE_SERVICE,
  EntityType.MLMODEL_SERVICE,
  EntityType.STORAGE_SERVICE,
  EntityType.SEARCH_SERVICE,
  EntityType.API_SERVICE,
  EntityType.METADATA_SERVICE,
  EntityType.INGESTION_PIPELINE,
  EntityType.TEST_SUITE,
  EntityType.TEST_CASE,
  EntityType.EVENT_SUBSCRIPTION,
  EntityType.APPLICATION,
  EntityType.KPI,
] as const;

export const ENTITY_TYPE_OPTIONS: EntityTypeOption[] = POLICY_ENTITY_TYPES.map(
  (et) => ({
    value: et,
    label: getEntityNameLabel(et),
  })
);

export const ENTITY_TYPE_SEARCH_OPTIONS: SearchDropdownOption[] =
  ENTITY_TYPE_OPTIONS.map((o) => ({
    icon:
      searchClassBase.getEntityIconWithBg(
        getCanonicalEntityType(o.value),
        EntityIconSize.Size14
      ) ?? undefined,
    key: o.value,
    label: o.label,
  }));

export const RESOURCE_ITEMS: SelectItemType[] = PERMISSION_RESOURCES.map(
  (r) => ({ id: r, label: r })
);

export const OPERATION_ITEMS: SelectItemType[] = PERMISSION_OPERATIONS.map(
  (op) => ({ id: op, label: op })
);
