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
  SERVICE_TYPE = 'serviceType',
  DATA_MODEL_TYPE = 'dataModelType',
  ENTITY_TYPE = 'entityType',
  TABLE_TYPE = 'tableType',
  DISPLAY_NAME_KEYWORD = 'displayName.keyword',
  GLOSSARY = 'glossary.name.keyword',
  CLASSIFICATION = 'classification.name.keyword',
  DOMAIN = 'domain.displayName.keyword',
  DATA_MODEL = 'dataModels.displayName.keyword',
  CONTAINER_COLUMN = 'dataModel.columns.name.keyword',
  PROJECT = 'project.keyword',
  SCHEMA_FIELD = 'messageSchema.schemaFields.name.keyword',
  FEATURE = 'mlFeatures.name',
  FIELD = 'fields.name.keyword',
  OWNER = 'owner.displayName.keyword',
  TAG = 'tags.tagFQN',
  TIER = 'tier.tagFQN',
  SERVICE = 'service.displayName.keyword',
  DATABASE = 'database.name.keyword',
  DATABASE_SCHEMA = 'databaseSchema.name.keyword',
  COLUMN = 'columns.name.keyword',
  CHART = 'charts.displayName.keyword',
  TASK = 'tasks.displayName.keyword',
  GLOSSARY_TERM_STATUS = 'status',
}
