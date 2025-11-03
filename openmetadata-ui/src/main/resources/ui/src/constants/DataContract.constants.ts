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

import { BarProps } from 'recharts';
import { EntityReferenceFields } from '../enums/AdvancedSearch.enum';
import { EntityType } from '../enums/entity.enum';

export const CONTRACT_DATE_TIME_FORMAT = 'MM/dd/yyyy, h:mma';

export enum DataContractMode {
  YAML,
  UI,
}

export enum DataContractTabMode {
  ADD,
  EDIT,
  VIEW,
}

export enum EDataContractTab {
  CONTRACT_DETAIL,
  TERMS_OF_SERVICE,
  SCHEMA,
  SEMANTICS,
  SECURITY,
  QUALITY,
  SLA,
}

export const DATA_ASSET_RULE_FIELDS_NOT_TO_RENDER = [
  EntityReferenceFields.EXTENSION,
  EntityReferenceFields.OWNERS,
  EntityReferenceFields.NAME,
  EntityReferenceFields.DESCRIPTION,
  EntityReferenceFields.TIER,
  EntityReferenceFields.SERVICE,
  EntityReferenceFields.DISPLAY_NAME,
  EntityReferenceFields.DELETED,
];

export const SUPPORTED_CONTRACT_TAB = {
  [EntityType.TABLE]: [
    EDataContractTab.CONTRACT_DETAIL,
    EDataContractTab.SCHEMA,
    EDataContractTab.SEMANTICS,
    EDataContractTab.QUALITY,
  ],
  [EntityType.TOPIC]: [
    EDataContractTab.CONTRACT_DETAIL,
    EDataContractTab.SCHEMA,
    EDataContractTab.SEMANTICS,
  ],
  [EntityType.API_ENDPOINT]: [
    EDataContractTab.CONTRACT_DETAIL,
    EDataContractTab.SCHEMA,
    EDataContractTab.SEMANTICS,
  ],
  [EntityType.DASHBOARD_DATA_MODEL]: [
    EDataContractTab.CONTRACT_DETAIL,
    EDataContractTab.SCHEMA,
    EDataContractTab.SEMANTICS,
  ],
  [EntityType.DATABASE]: [
    EDataContractTab.CONTRACT_DETAIL,
    EDataContractTab.SEMANTICS,
  ],
  [EntityType.DATABASE_SCHEMA]: [
    EDataContractTab.CONTRACT_DETAIL,
    EDataContractTab.SEMANTICS,
  ],
  [EntityType.STORED_PROCEDURE]: [
    EDataContractTab.CONTRACT_DETAIL,
    EDataContractTab.SEMANTICS,
  ],
  [EntityType.DASHBOARD]: [
    EDataContractTab.CONTRACT_DETAIL,
    EDataContractTab.SEMANTICS,
  ],
  [EntityType.PIPELINE]: [
    EDataContractTab.CONTRACT_DETAIL,
    EDataContractTab.SEMANTICS,
  ],
  [EntityType.SEARCH_INDEX]: [
    EDataContractTab.CONTRACT_DETAIL,
    EDataContractTab.SEMANTICS,
  ],
  [EntityType.API_COLLECTION]: [
    EDataContractTab.CONTRACT_DETAIL,
    EDataContractTab.SEMANTICS,
  ],
  [EntityType.MLMODEL]: [
    EDataContractTab.CONTRACT_DETAIL,
    EDataContractTab.SEMANTICS,
  ],
  [EntityType.CONTAINER]: [
    EDataContractTab.CONTRACT_DETAIL,
    EDataContractTab.SEMANTICS,
  ],
  [EntityType.CHART]: [
    EDataContractTab.CONTRACT_DETAIL,
    EDataContractTab.SEMANTICS,
  ],
};
export const SEMANTIC_TAG_OPERATORS = ['array_contains', 'array_not_contains'];

export const SLA_AVAILABILITY_TIME_FORMAT = 'HH:mm';

export enum DATA_CONTRACT_ACTION_DROPDOWN_KEY {
  EDIT = 'edit',
  RUN_NOW = 'run_now',
  EXPORT = 'export',
  DELETE = 'delete',
}

export enum DATA_CONTRACT_SLA {
  REFRESH_FREQUENCY = 'refresh_frequency',
  MAX_LATENCY = 'max_latency',
  TIME_AVAILABILITY = 'time_availability',
  RETENTION = 'retention',
  COLUMN_NAME = 'columnName',
}

export const DATA_CONTRACT_EXECUTION_CHART_COMMON_PROPS: {
  maxBarSize: number;
  radius: BarProps['radius'];
} = {
  maxBarSize: 12,
  radius: [6, 6, 0, 0],
};

export const MAX_LATENCY_UNITS = ['minute', 'hour', 'day'];
export const REFRESH_FREQUENCY_UNITS = ['hour', 'day', 'week', 'month', 'year'];
export const RETENTION_UNITS = ['day', 'week', 'month', 'year'];
