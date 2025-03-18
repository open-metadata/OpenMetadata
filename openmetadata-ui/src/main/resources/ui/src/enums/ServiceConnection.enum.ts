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

// IMPORTANT: While adding new fields, make sure to keep the order of the enum values
// same as the order of the fields you in the UI form
export enum ServiceConnectionFilterPatternFields {
  DATABASE_FILTER_PATTERN = 'databaseFilterPattern',
  SCHEMA_FILTER_PATTERN = 'schemaFilterPattern',
  TABLE_FILTER_PATTERN = 'tableFilterPattern',
  API_COLLECTION_FILTER_PATTERN = 'apiCollectionFilterPattern',
  DASHBOARD_FILTER_PATTERN = 'dashboardFilterPattern',
  CONTAINER_FILTER_PATTERN = 'containerFilterPattern',
  ML_MODEL_FILTER_PATTERN = 'mlModelFilterPattern',
  PIPELINE_FILTER_PATTERN = 'pipelineFilterPattern',
  TOPIC_FILTER_PATTERN = 'topicFilterPattern',
  SEARCH_INDEX_FILTER_PATTERN = 'searchIndexFilterPattern',
  CHART_FILTER_PATTERN = 'chartFilterPattern',
  DATA_MODEL_FILTER_PATTERN = 'dataModelFilterPattern',
  PROJECT_FILTER_PATTERN = 'projectFilterPattern',
  CLASSIFICATION_FILTER_PATTERN = 'classificationFilterPattern',
}
