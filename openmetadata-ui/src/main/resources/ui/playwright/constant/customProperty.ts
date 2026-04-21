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

import { EntityTypeEndpoint } from '../support/entity/Entity.interface';

export const CustomPropertySupportedEntityList = [
  EntityTypeEndpoint.Database,
  EntityTypeEndpoint.DatabaseSchema,
  EntityTypeEndpoint.Table,
  EntityTypeEndpoint.StoreProcedure,
  EntityTypeEndpoint.Topic,
  EntityTypeEndpoint.Dashboard,
  EntityTypeEndpoint.Pipeline,
  EntityTypeEndpoint.Container,
  EntityTypeEndpoint.MlModel,
  EntityTypeEndpoint.GlossaryTerm,
  EntityTypeEndpoint.SearchIndex,
  EntityTypeEndpoint.DataModel,
  EntityTypeEndpoint.API_COLLECTION,
  EntityTypeEndpoint.API_ENDPOINT,
  EntityTypeEndpoint.DATA_PRODUCT,
  EntityTypeEndpoint.METRIC,
  EntityTypeEndpoint.Domain,
  EntityTypeEndpoint.Chart,
  EntityTypeEndpoint.TableColumn,
];

export const ENTITY_REFERENCE_PROPERTIES = [
  'Entity Reference',
  'Entity Reference List',
];

const commonCustomPropertyValues = {
  integerValue: '14',
  stringValue: 'This is string property',
  markdownValue: 'This is markdown value',
  enumConfig: {
    values: ['enum1', 'enum2', 'enum3'],
    multiSelect: false,
  },
  dateFormatConfig: 'yyyy-MM-dd',
  dateTimeFormatConfig: 'yyyy-MM-dd HH:mm:ss',
  timeFormatConfig: 'HH:mm:ss',
  entityReferenceConfig: ['User', 'Team', 'Metric'],
  entityObj: {},
  tableConfig: {
    columns: ['pw-column1', 'pw-column2'],
  },
};

export const CUSTOM_PROPERTIES_ENTITIES = {
  entity_container: {
    ...commonCustomPropertyValues,
    name: 'container',
    description: 'This is Container custom property',
    entityApiType: 'containers',
  },
  entity_dashboard: {
    ...commonCustomPropertyValues,
    name: 'dashboard',
    description: 'This is Dashboard custom property',
    entityApiType: 'dashboards',
  },
  entity_database: {
    ...commonCustomPropertyValues,
    name: 'database',
    description: 'This is Database custom property',
    entityApiType: 'databases',
  },

  entity_databaseSchema: {
    ...commonCustomPropertyValues,
    name: 'databaseSchema',
    description: 'This is Database Schema custom property',
    entityApiType: 'databaseSchemas',
  },

  entity_glossaryTerm: {
    ...commonCustomPropertyValues,
    name: 'glossaryTerm',
    description: 'This is Glossary Term custom property',
    entityApiType: 'glossaryTerm',
  },

  entity_mlmodel: {
    ...commonCustomPropertyValues,
    name: 'mlmodel',
    description: 'This is ML Model custom property',
    entityApiType: 'mlmodels',
  },

  entity_pipeline: {
    ...commonCustomPropertyValues,
    name: 'pipeline',
    description: 'This is Pipeline custom property',
    enumConfig: {
      values: ['enum1', 'enum2', 'enum3'],
      multiSelect: true,
    },
    entityApiType: 'pipelines',
  },

  entity_searchIndex: {
    ...commonCustomPropertyValues,
    name: 'searchIndex',
    description: 'This is Search Index custom property',
    entityApiType: 'searchIndexes',
  },

  entity_storedProcedure: {
    ...commonCustomPropertyValues,
    name: 'storedProcedure',
    description: 'This is Stored Procedure custom property',
    entityApiType: 'storedProcedures',
  },

  entity_table: {
    ...commonCustomPropertyValues,
    name: 'table',
    description: 'This is Table custom property',
    entityApiType: 'tables',
  },

  entity_topic: {
    ...commonCustomPropertyValues,
    name: 'topic',
    description: 'This is Topic custom property',
    entityApiType: 'topics',
  },
  entity_apiCollection: {
    ...commonCustomPropertyValues,
    name: 'apiCollection',
    description: 'This is API Collection custom property',
    entityApiType: 'apiCollections',
  },

  entity_apiEndpoint: {
    ...commonCustomPropertyValues,
    name: 'apiEndpoint',
    description: 'This is API Endpoint custom property',
    entityApiType: 'apiEndpoints',
  },
  entity_dataProduct: {
    ...commonCustomPropertyValues,
    name: 'dataProduct',
    description: 'This is Data Product custom property',
    entityApiType: 'dataProducts',
  },
  entity_domain: {
    ...commonCustomPropertyValues,
    name: 'domain',
    description: 'This is Domain custom property',
    entityApiType: 'domains',
  },
  entity_dashboardDataModel: {
    ...commonCustomPropertyValues,
    name: 'dashboardDataModel',
    description: 'This is Data Model custom property',
    entityApiType: 'dashboardDataModels',
  },
  entity_metric: {
    ...commonCustomPropertyValues,
    name: 'metric',
    description: 'This is Metric custom property',
    entityApiType: 'metrics',
  },
  entity_chart: {
    ...commonCustomPropertyValues,
    name: 'chart',
    description: 'This is Chart custom property',
    entityApiType: 'charts',
  },
  entity_directory: {
    ...commonCustomPropertyValues,
    name: 'directory',
    description: 'This is Directory custom property',
    entityApiType: 'directories',
  },
  entity_file: {
    ...commonCustomPropertyValues,
    name: 'file',
    description: 'This is File custom property',
    entityApiType: 'files',
  },
  entity_spreadsheet: {
    ...commonCustomPropertyValues,
    name: 'spreadsheet',
    description: 'This is Spreadsheet custom property',
    entityApiType: 'spreadsheets',
  },
  entity_worksheet: {
    ...commonCustomPropertyValues,
    name: 'worksheet',
    description: 'This is Worksheet custom property',
    entityApiType: 'worksheets',
  },
  entity_tableColumn: {
    ...commonCustomPropertyValues,
    name: 'tableColumn',
    description: 'This is Table Column custom property',
    entityApiType: 'column',
  },
};

export const CUSTOM_PROPERTY_NAME_VALIDATION_ERROR =
  "Name must not contain '::'.";
