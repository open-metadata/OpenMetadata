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
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';

// Sets for O(1) lookup performance - exported for reuse across the codebase
export const SCHEMA_TABS_SET = new Set<EntityType | TabSpecificField.COLUMNS>([
  EntityType.API_COLLECTION,
  EntityType.API_ENDPOINT,
  EntityType.CONTAINER,
  EntityType.DASHBOARD,
  EntityType.DASHBOARD_DATA_MODEL,
  EntityType.DATABASE,
  EntityType.DATABASE_SCHEMA,
  EntityType.PIPELINE,
  EntityType.SEARCH_INDEX,
  EntityType.TABLE,
  EntityType.TOPIC,
]);

export const LINEAGE_TABS_SET = new Set<EntityType | TabSpecificField.COLUMNS>([
  EntityType.API_ENDPOINT,
  EntityType.CHART,
  EntityType.CONTAINER,
  EntityType.DASHBOARD,
  EntityType.DASHBOARD_DATA_MODEL,
  EntityType.DIRECTORY,
  EntityType.MLMODEL,
  EntityType.PIPELINE,
  EntityType.SEARCH_INDEX,
  EntityType.TABLE,
  EntityType.TOPIC,
]);

export const CUSTOM_PROPERTIES_TABS_SET = new Set<
  EntityType | TabSpecificField.COLUMNS
>([
  EntityType.API_COLLECTION,
  EntityType.API_ENDPOINT,
  EntityType.CHART,
  EntityType.CONTAINER,
  EntityType.DASHBOARD,
  EntityType.DASHBOARD_DATA_MODEL,
  EntityType.DATABASE,
  EntityType.DATABASE_SCHEMA,
  EntityType.DATA_PRODUCT,
  EntityType.DIRECTORY,
  EntityType.DOMAIN,
  EntityType.FILE,
  EntityType.GLOSSARY_TERM,
  EntityType.METRIC,
  EntityType.MLMODEL,
  EntityType.PIPELINE,
  EntityType.SEARCH_INDEX,
  EntityType.SPREADSHEET,
  EntityType.STORED_PROCEDURE,
  EntityType.TABLE,
  EntityType.TOPIC,
  EntityType.WORKSHEET,
]);

// Exported arrays for backward compatibility
export const ENTITY_RIGHT_PANEL_SCHEMA_TABS = Array.from(SCHEMA_TABS_SET);
export const ENTITY_RIGHT_PANEL_LINEAGE_TABS = Array.from(LINEAGE_TABS_SET);
export const ENTITY_RIGHT_PANEL_CUSTOM_PROPERTIES_TABS = Array.from(
  CUSTOM_PROPERTIES_TABS_SET
);
