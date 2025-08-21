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
export enum WidgetWidths {
  large = 3,
  medium = 2,
  small = 1,
}

export enum DetailPageWidgetKeys {
  TABS = 'KnowledgePanel.Tabs',
  HEADER = 'KnowledgePanel.Header',
  LEFT_PANEL = 'KnowledgePanel.LeftPanel',
  ANNOUNCEMENTS = 'KnowledgePanel.Announcements',
  DESCRIPTION = 'KnowledgePanel.Description',
  TABLE_SCHEMA = 'KnowledgePanel.TableSchema',
  TOPIC_SCHEMA = 'KnowledgePanel.TopicSchema',
  DATABASE_SCHEMA = 'KnowledgePanel.DatabaseSchema',
  CHARTS_TABLE = 'KnowledgePanel.ChartsTable',
  FREQUENTLY_JOINED_TABLES = 'KnowledgePanel.FrequentlyJoinedTables',
  DATA_PRODUCTS = 'KnowledgePanel.DataProducts',
  TAGS = 'KnowledgePanel.Tags',
  DOMAIN = 'KnowledgePanel.Domain',
  GLOSSARY_TERMS = 'KnowledgePanel.GlossaryTerms',
  CUSTOM_PROPERTIES = 'KnowledgePanel.CustomProperties',
  TABLE_CONSTRAINTS = 'KnowledgePanel.TableConstraints',
  EMPTY_WIDGET_PLACEHOLDER = 'ExtraWidget.EmptyWidgetPlaceholder',
  PARTITIONED_KEYS = 'KnowledgePanel.PartitionedKeys',
  STORED_PROCEDURE_CODE = 'KnowledgePanel.StoredProcedureCode',
  DATA_MODEL = 'KnowledgePanel.DataModel',
  CONTAINER_CHILDREN = 'KnowledgePanel.ContainerChildren',
  PIPELINE_TASKS = 'KnowledgePanel.PipelineTasks',
  SEARCH_INDEX_FIELDS = 'KnowledgePanel.SearchIndexFields',
  OWNERS = 'KnowledgePanel.Owners',
  EXPERTS = 'KnowledgePanel.Experts',
  DOMAIN_TYPE = 'KnowledgePanel.DomainType',
  TABLES = 'KnowledgePanel.Tables',
  API_ENDPOINTS = 'KnowledgePanel.APIEndpoints',
  API_SCHEMA = 'KnowledgePanel.APISchema',
  RELATED_METRICS = 'KnowledgePanel.RelatedMetrics',
  ML_MODEL_FEATURES = 'KnowledgePanel.MlModelFeatures',
  CONTAINER_SCHEMA = 'KnowledgePanel.ContainerSchema',
  DIRECTORY_CHILDREN = 'KnowledgePanel.DirectoryChildren',
}

export enum GlossaryTermDetailPageWidgetKeys {
  TABS = 'KnowledgePanel.Tabs',
  HEADER = 'KnowledgePanel.Header',
  DESCRIPTION = 'KnowledgePanel.Description',
  TAGS = 'KnowledgePanel.Tags',
  SYNONYMS = 'KnowledgePanel.Synonyms',
  RELATED_TERMS = 'KnowledgePanel.RelatedTerms',
  REFERENCES = 'KnowledgePanel.References',
  OWNER = 'KnowledgePanel.Owner',
  DOMAIN = 'KnowledgePanel.Domain',
  REVIEWER = 'KnowledgePanel.Reviewer',
  CUSTOM_PROPERTIES = 'KnowledgePanel.CustomProperties',
  EMPTY_WIDGET_PLACEHOLDER = 'ExtraWidget.EmptyWidgetPlaceholder',
  TERMS_TABLE = 'KnowledgePanel.TermsTable',
  WORKFLOW_HISTORY = 'KnowledgePanel.WorkflowHistory',
}
