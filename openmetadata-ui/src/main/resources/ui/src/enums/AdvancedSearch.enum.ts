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

// This enum contains list of fields that are used in the advanced search for elastic search query
export enum EntityFields {
  SERVICE_TYPE = 'serviceType',
  DATA_MODEL_TYPE = 'dataModelType',
  ENTITY_TYPE = 'entityType',
  TABLE_TYPE = 'tableType',
  COLUMN_DESCRIPTION_STATUS = 'columnDescriptionStatus',
  DISPLAY_NAME_KEYWORD = 'displayName.keyword',
  DISPLAY_NAME_ACTUAL_CASE = 'displayName.actualCase',
  NAME_KEYWORD = 'name.keyword',
  GLOSSARY = 'glossary.name.keyword',
  CLASSIFICATION = 'classification.name.keyword',
  DOMAINS = 'domains.displayName.keyword',
  DATA_MODEL = 'dataModels.displayName.keyword',
  CONTAINER_COLUMN = 'dataModel.columns.name.keyword',
  PROJECT = 'project.keyword',
  SCHEMA_FIELD = 'messageSchema.schemaFields.name.keyword',
  FEATURE = 'mlFeatures.name',
  FIELD = 'fields.name.keyword',
  OWNERS = 'owners.displayName.keyword',
  TAG = 'tags.tagFQN',
  TIER = 'tier.tagFQN',
  CERTIFICATION = 'certification.tagLabel.tagFQN',
  SERVICE = 'service.displayName.keyword',
  DATABASE = 'database.displayName.keyword',
  DATABASE_NAME = 'database.name.keyword',
  DATABASE_SCHEMA = 'databaseSchema.displayName.keyword',
  DATABASE_DISPLAY_NAME = 'database.displayName',
  DATABASE_SCHEMA_DISPLAY_NAME = 'databaseSchema.displayName',
  DATABASE_SCHEMA_NAME = 'databaseSchema.name.keyword',
  COLUMN = 'columns.name.keyword',
  API_COLLECTION = 'apiCollection.displayName.keyword',
  CHART = 'charts.displayName.keyword',
  TASK = 'tasks.displayName.keyword',
  GLOSSARY_TERM_STATUS = 'status',
  REQUEST_SCHEMA_FIELD = 'requestSchema.schemaFields.name.keyword',
  RESPONSE_SCHEMA_FIELD = 'responseSchema.schemaFields.name.keyword',
  SERVICE_NAME = 'service.name.keyword',
  SUGGESTED_DESCRIPTION = 'descriptionSources.Suggested',
  TAGS_LABEL_TYPE = 'tags.labelType',
  TIER_LABEL_TYPE = 'tier.labelType',
  CREATED_BY = 'createdBy',
}

export const EntitySourceFields: Partial<Record<EntityFields, string[]>> = {
  [EntityFields.SERVICE_NAME]: ['service.name'],
  [EntityFields.DATABASE_SCHEMA_NAME]: ['databaseSchema.name'],
  [EntityFields.DATABASE_NAME]: ['database.name'],
  [EntityFields.COLUMN]: ['columns.name'],
  [EntityFields.NAME_KEYWORD]: ['name'],
};

// This enum contains list of fields that are there in the object of the entity
// For example, in Glossary object, there are fields like name, description, parent, etc.
export enum EntityReferenceFields {
  REVIEWERS = 'reviewers',
  OWNERS = 'owners',
  DATABASE = 'database.name',
  DATABASE_SCHEMA = 'databaseSchema.name',
  DESCRIPTION = 'description',
  NAME = 'name',
  DISPLAY_NAME = 'displayName',
  TAG = 'tags',
  TIER = 'tier.tagFQN',
  DOMAIN = 'domain',
  DATA_PRODUCT = 'dataProduct',
  TABLE_TYPE = 'tableType',
  EXTENSION = 'extension',
  SERVICE = 'service.name',
  UPDATED_BY = 'updatedBy',
  CHANGE_DESCRIPTION = 'changeDescription',
  DELETED = 'deleted',
}
