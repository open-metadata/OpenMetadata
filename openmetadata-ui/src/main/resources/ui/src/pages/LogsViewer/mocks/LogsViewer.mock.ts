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

export const mockLogsData = {
  ingestion_task: 'test Logs',
  total: '6',
  after: '1',
};

export const mockIngestionPipeline = {
  id: 'c379d75a-43cd-4d93-a799-0bba4a22c690',
  name: 'test-redshift_metadata_ZeCajs9g',
  displayName: 'test-redshift_metadata_ZeCajs9g',
  pipelineType: 'metadata',
  owner: {
    id: 'e43cdd2e-7698-4e06-8cb4-dbcdf401d6dc',
    type: 'user',
    name: 'admin',
    fullyQualifiedName: 'admin',
    deleted: false,
    href: 'http://localhost:8585/api/v1/users/e43cdd2e-7698-4e06-8cb4-dbcdf401d6dc',
  },
  fullyQualifiedName: 'test-redshift.test-redshift_metadata_ZeCajs9g',
  sourceConfig: {
    config: {
      type: 'DatabaseMetadata',
      markDeletedTables: true,
      markAllDeletedTables: false,
      includeTables: true,
      includeViews: true,
      includeTags: true,
      useFqnForFiltering: true,
    },
  },
  openMetadataServerConnection: {
    clusterName: 'openmetadata',
    type: 'OpenMetadata',
    hostPort: 'http://openmetadata-server:8585/api',
    authProvider: 'openmetadata',
    verifySSL: 'no-ssl',
    securityConfig: {
      jwtToken: 'test_token',
    },
    secretsManagerProvider: 'noop',
  },
  airflowConfig: {
    pausePipeline: false,
    concurrency: 1,
    pipelineTimezone: 'UTC',
    retries: 3,
    retryDelay: 300,
    pipelineCatchup: false,
    scheduleInterval: '*/5 * * * *',
    maxActiveRuns: 1,
    workflowDefaultView: 'tree',
    workflowDefaultViewOrientation: 'LR',
  },
  service: {
    id: '086ad38c-dd10-42ae-a58b-1c72ee6e7f50',
    type: 'databaseService',
    name: 'test-redshift',
    fullyQualifiedName: 'test-redshift',
    description: '',
    deleted: false,
    href: 'http://localhost:8585/api/v1/services/databaseServices/086ad38c-dd10-42ae-a58b-1c72ee6e7f50',
  },
  pipelineStatuses: [
    {
      runId: 'scheduled__2022-10-20T04:35:00+00:00',
      state: 'running',
      startDate: 1666240861500,
      timestamp: 1666240500000,
    },
  ],
  loggerLevel: 'DEBUG',
  deployed: true,
  enabled: true,
  href: 'http://localhost:8585/api/v1/services/ingestionPipelines/c379d75a-43cd-4d93-a799-0bba4a22c690',
  version: 0.1,
  updatedAt: 1666240859704,
  updatedBy: 'admin',
  deleted: false,
};
