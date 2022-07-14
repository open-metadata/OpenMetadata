/*
 *  Copyright 2021 Collate
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

import { ServiceDataObj } from '../../interface/service.interface';

export const mockIngestionWorkFlow = {
  data: {
    data: [
      {
        id: 'c804ec51-8fcf-4040-b830-5d967c4cbf49',
        name: 'test3_metadata',
        deployed: true,
        enabled: true,
        displayName: 'test3_metadata',
        pipelineType: 'metadata',
        owner: {
          id: 'fd96fdc7-a159-4802-84be-33c68d8b7e07',
          type: 'user',
          name: 'anonymous',
          fullyQualifiedName: 'anonymous',
          deleted: false,
          href: 'http://localhost:8585/api/v1/users/fd96fdc7-a159-4802-84be-33c68d8b7e07',
        },
        fullyQualifiedName: 'test3.test3_metadata',
        source: {
          type: 'bigquery',
          serviceName: 'test3',
          serviceConnection: {
            config: {
              type: 'BigQuery',
              scheme: 'bigquery',
              hostPort: 'bigquery.googleapis.com',
              partitionField: '_PARTITIONTIME',
              partitionQuery: 'select * from {}.{} WHERE {} = "{}" LIMIT 1000',
              tagCategoryName: 'BigqueryPolicyTags',
              connectionOptions: {},
              connectionArguments: {},
              enablePolicyTagImport: true,
              partitionQueryDuration: 1,
              supportsUsageExtraction: true,
              supportsMetadataExtraction: true,
            },
          },
          sourceConfig: {
            config: {
              includeViews: false,
              enableDataProfiler: true,
              generateSampleData: true,
            },
          },
        },
        openMetadataServerConnection: {
          hostPort: 'http://localhost:8585/api',
          authProvider: 'no-auth',
          apiVersion: 'v1',
        },
        airflowConfig: {
          pausePipeline: false,
          concurrency: 1,
          startDate: '2022-04-14',
          endDate: '2022-04-14',
          pipelineTimezone: 'UTC',
          retries: 3,
          retryDelay: 300,
          pipelineCatchup: false,
          scheduleInterval: '5 * * * *',
          pipelineTimeout: 60,
          maxActiveRuns: 1,
          workflowTimeout: 60,
          workflowDefaultView: 'tree',
          workflowDefaultViewOrientation: 'LR',
        },
        service: {
          id: 'c68e904a-4262-4b58-84c1-8a986b4aa47d',
          type: 'databaseService',
          name: 'test3',
          fullyQualifiedName: 'test3',
          description: '',
          deleted: false,
          href: 'http://localhost:8585/api/v1/services/databaseServices/c68e904a-4262-4b58-84c1-8a986b4aa47d',
        },
        href: 'http://localhost:8585/api/v1/services/ingestionPipelines/c804ec51-8fcf-4040-b830-5d967c4cbf49',
        version: 0.1,
        updatedAt: 1649941364738,
        updatedBy: 'anonymous',
        deleted: false,
      },
    ],
    paging: {
      total: 1,
    },
  },
};

export const mockService = {
  id: 'c68e904a-4262-4b58-84c1-8a986b4aa47d',
  name: 'test3',
  serviceType: 'BigQuery',
  description: '',
  connection: {
    config: {
      type: 'BigQuery',
      scheme: 'bigquery',
      hostPort: 'bigquery.googleapis.com',
      partitionField: '_PARTITIONTIME',
      partitionQuery: 'select * from {}.{} WHERE {} = "{}" LIMIT 1000',
      tagCategoryName: 'BigqueryPolicyTags',
      connectionOptions: {},
      connectionArguments: {},
      enablePolicyTagImport: true,
      partitionQueryDuration: 1,
      supportsUsageExtraction: true,
      supportsMetadataExtraction: true,
    },
  },
  version: 0.1,
  updatedAt: 1649941355557,
  updatedBy: 'anonymous',
  owner: {
    id: 'fd96fdc7-a159-4802-84be-33c68d8b7e07',
    type: 'user',
    name: 'anonymous',
    fullyQualifiedName: 'anonymous',
    deleted: false,
    href: 'http://localhost:8585/api/v1/users/fd96fdc7-a159-4802-84be-33c68d8b7e07',
  },
  href: 'http://localhost:8585/api/v1/services/databaseServices/c68e904a-4262-4b58-84c1-8a986b4aa47d',
  deleted: false,
} as ServiceDataObj;
