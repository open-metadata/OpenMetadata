/*
 *  Copyright 2026 Collate.
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

/**
 * One typed factory per data-asset type the entity pages render: the fields
 * the details page reads, the shape the server returns. A schema change
 * breaks compilation here.
 */
import {
  APIEndpoint,
  DataTypeTopic as ApiFieldType,
} from '../../../generated/entity/data/apiEndpoint';
import { Chart, ChartType } from '../../../generated/entity/data/chart';
import { Container } from '../../../generated/entity/data/container';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import {
  DashboardDataModel,
  DataModelType,
  DataType as DataModelColumnType,
} from '../../../generated/entity/data/dashboardDataModel';
import { Directory } from '../../../generated/entity/data/directory';
import { File } from '../../../generated/entity/data/file';
import { Metric } from '../../../generated/entity/data/metric';
import { FeatureType, Mlmodel } from '../../../generated/entity/data/mlmodel';
import { Pipeline } from '../../../generated/entity/data/pipeline';
import {
  DataType as SearchFieldType,
  SearchIndex,
} from '../../../generated/entity/data/searchIndex';
import { Spreadsheet } from '../../../generated/entity/data/spreadsheet';
import { StoredProcedure } from '../../../generated/entity/data/storedProcedure';
import { DataTypeTopic, Topic } from '../../../generated/entity/data/topic';
import { Worksheet } from '../../../generated/entity/data/worksheet';
import { EntityReference } from '../../../generated/type/entityReference';

/** What every steward test starts from: no owners, tags, followers or votes. */
export const UNTOUCHED = {
  owners: [],
  tags: [],
  followers: [],
  votes: { upVotes: 0, downVotes: 0, upVoters: [], downVoters: [] },
  deleted: false,
};

const id = (n: number) =>
  `7c2e3f90-0000-4000-8000-${String(n).padStart(12, '0')}`;

const ref = (n: number, type: string, fqn: string): EntityReference => ({
  id: id(n),
  type,
  name: fqn.split('.').pop(),
  fullyQualifiedName: fqn,
});

/** `name` under `parent`, with the server's id/fqn. */
const asset = (n: number, parent: string, name: string) => ({
  ...UNTOUCHED,
  id: id(n),
  name,
  fullyQualifiedName: `${parent}.${name}`,
});

export const makeApiEndpoint = (): APIEndpoint => {
  const fqn = 'pw_api_service.pw_collection.pw_endpoint';

  return {
    ...asset(1, 'pw_api_service.pw_collection', 'pw_endpoint'),
    service: ref(101, 'apiService', 'pw_api_service'),
    apiCollection: ref(102, 'apiCollection', 'pw_api_service.pw_collection'),
    endpointURL: 'https://example.com/api/orders',
    requestSchema: {
      schemaFields: [
        {
          name: 'order_id',
          dataType: ApiFieldType.String,
          fullyQualifiedName: `${fqn}.order_id`,
          tags: [],
        },
      ],
    },
  };
};

export const makeStoredProcedure = (): StoredProcedure => ({
  ...asset(2, 'pw_db_service.pw_db.pw_schema', 'pw_procedure'),
  service: ref(201, 'databaseService', 'pw_db_service'),
  database: ref(202, 'database', 'pw_db_service.pw_db'),
  databaseSchema: ref(203, 'databaseSchema', 'pw_db_service.pw_db.pw_schema'),
  storedProcedureCode: { code: 'SELECT 1' },
});

export const makeDashboard = (): Dashboard => ({
  ...asset(3, 'pw_dashboard_service', 'pw_dashboard'),
  service: ref(301, 'dashboardService', 'pw_dashboard_service'),
  project: 'pw_project',
  charts: [],
  dataModels: [],
});

export const makePipeline = (): Pipeline => ({
  ...asset(4, 'pw_pipeline_service', 'pw_pipeline'),
  service: ref(401, 'pipelineService', 'pw_pipeline_service'),
  tasks: [
    {
      name: 'pw_task',
      fullyQualifiedName: 'pw_pipeline_service.pw_pipeline.pw_task',
      tags: [],
    },
  ],
});

export const makeTopic = (): Topic => ({
  ...asset(5, 'pw_messaging_service', 'pw_topic'),
  service: ref(501, 'messagingService', 'pw_messaging_service'),
  partitions: 1,
  messageSchema: {
    schemaFields: [
      {
        name: 'order_id',
        dataType: DataTypeTopic.String,
        fullyQualifiedName: 'pw_messaging_service.pw_topic.order_id',
        tags: [],
      },
    ],
  },
});

export const makeMlModel = (): Mlmodel => ({
  ...asset(6, 'pw_mlmodel_service', 'pw_mlmodel'),
  service: ref(601, 'mlmodelService', 'pw_mlmodel_service'),
  algorithm: 'Time Series',
  mlFeatures: [
    {
      name: 'sales',
      dataType: FeatureType.Numerical,
      fullyQualifiedName: 'pw_mlmodel_service.pw_mlmodel.sales',
      tags: [],
    },
  ],
});

export const makeContainer = (): Container => ({
  ...asset(7, 'pw_storage_service', 'pw_container'),
  service: ref(701, 'storageService', 'pw_storage_service'),
});

export const makeSearchIndex = (): SearchIndex => ({
  ...asset(8, 'pw_search_service', 'pw_search_index'),
  service: ref(801, 'searchService', 'pw_search_service'),
  fields: [
    {
      name: 'order_id',
      dataType: SearchFieldType.Keyword,
      fullyQualifiedName: 'pw_search_service.pw_search_index.order_id',
      tags: [],
    },
  ],
});

export const makeDashboardDataModel = (): DashboardDataModel => ({
  ...asset(9, 'pw_dashboard_service.model', 'pw_data_model'),
  service: ref(901, 'dashboardService', 'pw_dashboard_service'),
  dataModelType: DataModelType.SupersetDataModel,
  project: 'pw_project',
  columns: [
    {
      name: 'order_id',
      dataType: DataModelColumnType.String,
      fullyQualifiedName: 'pw_dashboard_service.model.pw_data_model.order_id',
      tags: [],
    },
  ],
});

export const makeMetric = (): Metric => ({
  ...UNTOUCHED,
  id: id(10),
  name: 'pw_metric',
  fullyQualifiedName: 'pw_metric',
});

export const makeDirectory = (): Directory => ({
  ...asset(11, 'pw_drive_service', 'pw_directory'),
  service: ref(1101, 'driveService', 'pw_drive_service'),
});

export const makeFile = (): File => ({
  ...asset(12, 'pw_drive_service', 'pw_file'),
  service: ref(1201, 'driveService', 'pw_drive_service'),
});

export const makeSpreadsheet = (): Spreadsheet => ({
  ...asset(13, 'pw_drive_service', 'pw_spreadsheet'),
  service: ref(1301, 'driveService', 'pw_drive_service'),
});

export const makeWorksheet = (): Worksheet => ({
  ...asset(14, 'pw_drive_service.pw_spreadsheet', 'pw_worksheet'),
  service: ref(1401, 'driveService', 'pw_drive_service'),
  spreadsheet: ref(1402, 'spreadsheet', 'pw_drive_service.pw_spreadsheet'),
});

export const makeChart = (): Chart => ({
  ...asset(15, 'pw_dashboard_service', 'pw_chart'),
  service: ref(1501, 'dashboardService', 'pw_dashboard_service'),
  chartType: ChartType.Bar,
  dashboards: [],
});
