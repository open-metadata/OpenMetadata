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
import { EntityType } from '../../../enums/entity.enum';

export const ENTITY_RIGHT_PANEL_SCHEMA_TABS = [
  EntityType.TABLE,
  EntityType.TOPIC,
  EntityType.DASHBOARD,
  EntityType.DATABASE_SCHEMA,
  EntityType.DATABASE,
  EntityType.PIPELINE,
  EntityType.API_COLLECTION,
  EntityType.SEARCH_INDEX,
  EntityType.DASHBOARD_DATA_MODEL,
  EntityType.API_ENDPOINT,
  EntityType.CONTAINER,
];

export const ENTITY_RIGHT_PANEL_LINEAGE_TABS = [
  EntityType.TABLE,
  EntityType.TOPIC,
  EntityType.CONTAINER,
  EntityType.DASHBOARD,
  EntityType.CHART,
  EntityType.PIPELINE,
  EntityType.MLMODEL,
  EntityType.SEARCH_INDEX,
  EntityType.DASHBOARD_DATA_MODEL,
  EntityType.API_ENDPOINT,
  EntityType.DIRECTORY,
];
