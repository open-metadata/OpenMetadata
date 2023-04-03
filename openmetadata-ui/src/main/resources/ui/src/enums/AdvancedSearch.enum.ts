/*
 *  Copyright 2022 Collate.
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

export enum SuggestionField {
  COLUMN = 'column_suggest',
  DATABASE = 'database_suggest',
  SCHEMA = 'schema_suggest',
  SERVICE = 'service_suggest',
  CHART = 'chart_suggest',
  DATA_MODEL = 'data_model_suggest',
  TASK = 'task_suggest',
  ROOT = 'suggest',
  SERVICE_TYPE = 'serviceType',
}

export enum AdvancedFields {
  COLUMN = 'column_suggest',
  DATABASE = 'database_suggest',
  SCHEMA = 'schema_suggest',
  SERVICE = 'service_suggest',
  CHART = 'chart_suggest',
  DATA_MODEL = 'data_model_suggest',
  TASK = 'task_suggest',
  FIELD = 'field_suggest',
}

export enum EntityFields {
  OWNER = 'owner.displayName',
  TAG = 'tags.tagFQN',
  TIER = 'tier.tagFQN',
  SERVICE = 'service.name',
  DATABASE = 'database.name',
  DATABASE_SCHEMA = 'databaseSchema.name',
  COLUMN = 'columns.name',
  CHART = 'charts.name',
  TASK = 'tasks.name',
}
