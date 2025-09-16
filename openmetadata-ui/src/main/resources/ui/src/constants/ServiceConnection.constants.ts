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
import { EntityType } from '../enums/entity.enum';
import { ServiceConnectionFilterPatternFields } from '../enums/ServiceConnection.enum';

// Ordered list of filter pattern fields
export const SERVICE_FILTER_PATTERN_FIELDS = Object.values(
  ServiceConnectionFilterPatternFields
);

export const FILTER_PATTERN_BY_SERVICE_TYPE = {
  [EntityType.API_SERVICE]: [
    ServiceConnectionFilterPatternFields.API_COLLECTION_FILTER_PATTERN,
  ],
  [EntityType.DASHBOARD_SERVICE]: [
    ServiceConnectionFilterPatternFields.DASHBOARD_FILTER_PATTERN,
    ServiceConnectionFilterPatternFields.CHART_FILTER_PATTERN,
    ServiceConnectionFilterPatternFields.DATA_MODEL_FILTER_PATTERN,
    ServiceConnectionFilterPatternFields.PROJECT_FILTER_PATTERN,
  ],
  [EntityType.DATABASE_SERVICE]: [
    ServiceConnectionFilterPatternFields.DATABASE_FILTER_PATTERN,
    ServiceConnectionFilterPatternFields.SCHEMA_FILTER_PATTERN,
    ServiceConnectionFilterPatternFields.TABLE_FILTER_PATTERN,
    ServiceConnectionFilterPatternFields.STORED_PROCEDURE_FILTER_PATTERN,
    ServiceConnectionFilterPatternFields.CLASSIFICATION_FILTER_PATTERN,
  ],
  [EntityType.MESSAGING_SERVICE]: [
    ServiceConnectionFilterPatternFields.TOPIC_FILTER_PATTERN,
  ],
  [EntityType.METADATA_SERVICE]: [
    ServiceConnectionFilterPatternFields.DATABASE_FILTER_PATTERN,
    ServiceConnectionFilterPatternFields.SCHEMA_FILTER_PATTERN,
    ServiceConnectionFilterPatternFields.TABLE_FILTER_PATTERN,
  ],
  [EntityType.MLMODEL_SERVICE]: [
    ServiceConnectionFilterPatternFields.ML_MODEL_FILTER_PATTERN,
  ],
  [EntityType.PIPELINE_SERVICE]: [
    ServiceConnectionFilterPatternFields.PIPELINE_FILTER_PATTERN,
  ],
  [EntityType.SEARCH_SERVICE]: [
    ServiceConnectionFilterPatternFields.SEARCH_INDEX_FILTER_PATTERN,
  ],
  [EntityType.STORAGE_SERVICE]: [
    ServiceConnectionFilterPatternFields.CONTAINER_FILTER_PATTERN,
  ],
};

export const SERVICE_CONNECTION_UI_SCHEMA = {
  'ui:order': [...SERVICE_FILTER_PATTERN_FIELDS],
};
