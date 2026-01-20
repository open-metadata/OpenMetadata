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
export const MOCK_SELECT_WIDGET = {
  autofocus: false,
  disabled: false,
  formContext: { handleFocus: undefined },
  hideError: undefined,
  hideLabel: false,
  id: 'root/searchIndexMappingLanguage',
  label: 'Search Index Language',
  name: 'searchIndexMappingLanguage',
  options: {
    enumOptions: [
      { label: 'EN', value: 'EN' },
      { label: 'JP', value: 'JP' },
      { label: 'RU', value: 'RU' },
      { label: 'ZH', value: 'ZH' },
    ],
  },
  placeholder: '',
  rawErrors: undefined,
  readonly: false,
  required: false,
  schema: {
    description: 'Recreate Indexes with updated Language',
    title: 'Search Index Language',
    javaType: 'org.openmetadata.schema.type.IndexMappingLanguage',
    enum: ['EN', 'JP', 'RU', 'ZH'],
  },
  uiSchema: {},
  value: 'JP',
};

export const MOCK_TREE_SELECT_WIDGET = {
  autofocus: false,
  disabled: false,
  formContext: { handleFocus: undefined },
  hideError: undefined,
  hideLabel: false,
  id: 'root/entities',
  label: 'Entities',
  multiple: true,
  name: 'entities',
  readonly: false,
  placeholder: '',
  rawErrors: undefined,
  options: {
    enumOptions: [
      {
        label: 'table',
        value: 'table',
      },
      {
        label: 'dashboard',
        value: 'dashboard',
      },
      {
        label: 'topic',
        value: 'topic',
      },
      {
        label: 'pipeline',
        value: 'pipeline',
      },
      {
        label: 'ingestionPipeline',
        value: 'ingestionPipeline',
      },
      {
        label: 'searchIndex',
        value: 'searchIndex',
      },
      {
        label: 'user',
        value: 'user',
      },
      {
        label: 'team',
        value: 'team',
      },
      {
        label: 'glossary',
        value: 'glossary',
      },
      {
        label: 'glossaryTerm',
        value: 'glossaryTerm',
      },
      {
        label: 'mlmodel',
        value: 'mlmodel',
      },
      {
        label: 'tag',
        value: 'tag',
      },
      {
        label: 'classification',
        value: 'classification',
      },
      {
        label: 'query',
        value: 'query',
      },
      {
        label: 'container',
        value: 'container',
      },
      {
        label: 'database',
        value: 'database',
      },
      {
        label: 'databaseSchema',
        value: 'databaseSchema',
      },
      {
        label: 'testCase',
        value: 'testCase',
      },
      {
        label: 'testSuite',
        value: 'testSuite',
      },
      {
        label: 'chart',
        value: 'chart',
      },
      {
        label: 'dashboardDataModel',
        value: 'dashboardDataModel',
      },
      {
        label: 'databaseService',
        value: 'databaseService',
      },
      {
        label: 'messagingService',
        value: 'messagingService',
      },
      {
        label: 'dashboardService',
        value: 'dashboardService',
      },
      {
        label: 'pipelineService',
        value: 'pipelineService',
      },
      {
        label: 'mlmodelService',
        value: 'mlmodelService',
      },
      {
        label: 'storageService',
        value: 'storageService',
      },
      {
        label: 'metadataService',
        value: 'metadataService',
      },
      {
        label: 'searchService',
        value: 'searchService',
      },
      {
        label: 'entityReportData',
        value: 'entityReportData',
      },
      {
        label: 'webAnalyticEntityViewReportData',
        value: 'webAnalyticEntityViewReportData',
      },
      {
        label: 'webAnalyticUserActivityReportData',
        value: 'webAnalyticUserActivityReportData',
      },
      {
        label: 'domain',
        value: 'domain',
      },
      {
        label: 'storedProcedure',
        value: 'storedProcedure',
      },
      {
        label: 'dataProduct',
        value: 'dataProduct',
      },
      {
        label: 'testCaseResolutionStatus',
        value: 'testCaseResolutionStatus',
      },
    ],
  },
  schema: {
    title: 'Entities',
    description: 'List of entities that you need to reindex',
    uiFieldType: 'treeSelect',
  },
  value: ['all'],
};
