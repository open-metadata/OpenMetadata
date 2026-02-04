/*
 *  Copyright 2024 Collate.
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

import { EntityType } from '../enums/entity.enum';
import { APIEndpoint, Field } from '../generated/entity/data/apiEndpoint';
import { Container } from '../generated/entity/data/container';
import {
  Column as DataModelColumn,
  DashboardDataModel,
} from '../generated/entity/data/dashboardDataModel';
import { Mlmodel } from '../generated/entity/data/mlmodel';
import { Pipeline } from '../generated/entity/data/pipeline';
import { SearchIndex } from '../generated/entity/data/searchIndex';
import { Column, Table } from '../generated/entity/data/table';
import { Topic } from '../generated/entity/data/topic';
import { Worksheet } from '../generated/entity/data/worksheet';
import { TagLabel } from '../generated/type/tagLabel';

/**
 * Entity data type mapping for column updates
 */
export interface EntityDataMap {
  [EntityType.TABLE]: Table;
  [EntityType.TOPIC]: Topic;
  [EntityType.SEARCH_INDEX]: SearchIndex;
  [EntityType.CONTAINER]: Container;
  [EntityType.MLMODEL]: Mlmodel;
  [EntityType.PIPELINE]: Pipeline;
  [EntityType.DASHBOARD_DATA_MODEL]: DashboardDataModel;
  [EntityType.API_ENDPOINT]: APIEndpoint;
  [EntityType.WORKSHEET]: Worksheet;
}

/**
 * Union type of all entity types that support column updates
 */
export type EntityDataMapValue =
  | EntityDataMap[EntityType.TABLE]
  | EntityDataMap[EntityType.TOPIC]
  | EntityDataMap[EntityType.SEARCH_INDEX]
  | EntityDataMap[EntityType.CONTAINER]
  | EntityDataMap[EntityType.MLMODEL]
  | EntityDataMap[EntityType.PIPELINE]
  | EntityDataMap[EntityType.DASHBOARD_DATA_MODEL]
  | EntityDataMap[EntityType.API_ENDPOINT]
  | EntityDataMap[EntityType.WORKSHEET];

/**
 * Column field update payload
 */
export interface ColumnFieldUpdate {
  description?: string;
  tags?: TagLabel[];
  extension?: Record<string, unknown>;
  displayName?: string;
}

/**
 * Options for handleColumnFieldUpdate
 */
export interface HandleColumnFieldUpdateOptions<T extends EntityDataMapValue> {
  entityType: EntityType;
  entityData: T;
  fqn: string;
  update: ColumnFieldUpdate;
}

/**
 * Result of handleColumnFieldUpdate
 */
export interface HandleColumnFieldUpdateResult<T> {
  updatedEntity: T;
  updatedColumn: Column | DataModelColumn | Field | undefined;
}
