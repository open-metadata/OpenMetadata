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
import { Effect, Rule } from '../../../../../../generated/api/policies/createPolicy';
import { EntityIconSize } from '../../../../../../utils/EntityIconUtils';
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

export const ENTITY_TYPE_OPTIONS: EntityTypeOption[] = [
  { label: 'Table', value: 'table' },
  { label: 'Topic', value: 'topic' },
  { label: 'Dashboard', value: 'dashboard' },
  { label: 'Pipeline', value: 'pipeline' },
  { label: 'ML Model', value: 'mlmodel' },
  { label: 'Container', value: 'container' },
  { label: 'Search Index', value: 'searchIndex' },
  { label: 'Stored Procedure', value: 'storedProcedure' },
  { label: 'Dashboard Data Model', value: 'dashboardDataModel' },
  { label: 'Chart', value: 'chart' },
  { label: 'Database', value: 'database' },
  { label: 'Database Schema', value: 'databaseSchema' },
  { label: 'Query', value: 'query' },
  { label: 'API Collection', value: 'apiCollection' },
  { label: 'API Endpoint', value: 'apiEndpoint' },
  { label: 'Metric', value: 'metric' },
  { label: 'Glossary', value: 'glossary' },
  { label: 'Glossary Term', value: 'glossaryTerm' },
  { label: 'Classification', value: 'classification' },
  { label: 'Tag', value: 'tag' },
  { label: 'Domain', value: 'domain' },
  { label: 'Data Product', value: 'dataProduct' },
  { label: 'User', value: 'user' },
  { label: 'Team', value: 'team' },
  { label: 'Bot', value: 'bot' },
  { label: 'Persona', value: 'persona' },
  { label: 'Role', value: 'role' },
  { label: 'Policy', value: 'policy' },
  { label: 'Database Service', value: 'databaseService' },
  { label: 'Messaging Service', value: 'messagingService' },
  { label: 'Dashboard Service', value: 'dashboardService' },
  { label: 'Pipeline Service', value: 'pipelineService' },
  { label: 'ML Model Service', value: 'mlmodelService' },
  { label: 'Storage Service', value: 'storageService' },
  { label: 'Search Service', value: 'searchService' },
  { label: 'API Service', value: 'apiService' },
  { label: 'Metadata Service', value: 'metadataService' },
  { label: 'Ingestion Pipeline', value: 'ingestionPipeline' },
  { label: 'Test Suite', value: 'testSuite' },
  { label: 'Test Case', value: 'testCase' },
  { label: 'Event Subscription', value: 'eventsubscription' },
  { label: 'Application', value: 'app' },
  { label: 'KPI', value: 'kpi' },
];

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
