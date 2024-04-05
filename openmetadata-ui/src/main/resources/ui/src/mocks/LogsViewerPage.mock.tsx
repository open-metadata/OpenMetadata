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

import { PipelineState } from '../generated/entity/services/ingestionPipelines/ingestionPipeline';

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

export const mockDataInsightApplication = {
  id: '8437b08f-404a-4129-8448-610323daf51e',
  name: 'DataInsightsApplication',
  displayName: 'Data Insights',
  description:
    // eslint-disable-next-line max-len
    '**Data Insights: A Revolutionary Tool for Metadata Analysis and Data Management**\n\n**Comprehensive Data Analytics:** Dive deep into the world of data with our advanced analytics, crafted to transform raw metadata into valuable insights.',
  fullyQualifiedName: 'DataInsightsApplication',
  version: 0.1,
  updatedAt: 1712299044226,
  updatedBy: 'admin',
  href: 'http://localhost:8585/api/v1/apps/8437b08f-404a-4129-8448-610323daf51e',
  deleted: false,
  provider: 'user',
  developer: 'Collate Inc.',
  developerUrl: 'https://www.getcollate.io',
  privacyPolicyUrl: 'https://www.getcollate.io',
  supportEmail: 'support@getcollate.io',
  className: 'org.openmetadata.service.apps.bundles.insights.DataInsightsApp',
  appType: 'external',
  scheduleType: 'Scheduled',
  permission: 'All',
  bot: {
    id: '2f38b35d-bc91-4412-af2a-294644d44b2c',
    type: 'bot',
    name: 'DataInsightsApplicationBot',
    fullyQualifiedName: 'DataInsightsApplicationBot',
    deleted: false,
  },
  runtime: {
    enabled: 'true',
  },
  allowConfiguration: false,
  system: false,
  appConfiguration: {},
  preview: false,
  appSchedule: {
    scheduleTimeline: 'Custom',
    cronExpression: '0 0 * * *',
  },
  appScreenshots: ['DataInsightsPic1.png'],
};

export const mockDataInsightApplicationRun = {
  data: [
    {
      runId: '7852085e-2ef3-44d1-8c95-dd8c14d33895',
      pipelineState: PipelineState.Success,
      startDate: 1712299055158,
      timestamp: 1712299055158,
      endDate: 1712299060061,
      status: [
        {
          name: 'OpenMetadata Insights',
          records: 71,
          updated_records: 0,
          warnings: 0,
          errors: 0,
          filtered: 0,
          failures: [],
        },
        {
          name: 'OpenMetadata',
          records: 71,
          updated_records: 0,
          warnings: 0,
          errors: 0,
          filtered: 0,
          failures: [],
        },
      ],
    },
  ],
  paging: {
    before: 'MTcxMjIxMzc0NjM1Ng==',
    after: 'MTcxMjMwMDE0NjM1Ng==',
    total: 1,
  },
};

export const mockLatestDataInsightApplicationRunLogs = {
  data_insight_task:
    // eslint-disable-next-line max-len
    "31103bd4cfc9\n*** Found local files:\n***   * /opt/airflow/logs/dag_id=OpenMetadata_dataInsight/run_id=manual__2024-04-05T06:37:28+00:00/task_id=data_insight_task/attempt=1.log\n[2024-04-05T06:37:35.052+0000] {taskinstance.py:1159} INFO - Dependencies all met for dep_context=non-requeueable deps ti=<TaskInstance: OpenMetadata_dataInsight.data_insight_task manual__2024-04-05T06:37:28+00:00 [queued]>\n[2024-04-05T06:37:35.057+0000] {taskinstance.py:1159} INFO - Dependencies all met for dep_context=requeueable deps ti=<TaskInstance: OpenMetadata_dataInsight.data_insight_task manual__2024-04-05T06:37:28+00:00 [queued]>\n[2024-04-05T06:37:35.057+0000] {taskinstance.py:1361} INFO - Starting attempt 1 of 1\n[2024-04-05T06:37:35.065+0000] {taskinstance.py:1382} INFO - Executing <Task(CustomPythonOperator): data_insight_task> on 2024-04-05 06:37:28+00:00\n[2024-04-05T06:37:35.068+0000] {standard_task_runner.py:57} INFO - Started process 40504 to run task\n[2024-04-05T06:37:35.072+0000] {standard_task_runner.py:84} INFO - Running: ['airflow', 'tasks', 'run', 'OpenMetadata_dataInsight', 'data_insight_task', 'manual__2024-04-05T06:37:28+00:00', '--job-id', '81', '--raw', '--subdir', 'DAGS_FOLDER/OpenMetadata_dataInsight.py', '--cfg-path', '/tmp/tmpu41_kxxp']\n[2024-04-05T06:37:35.073+0000] {standard_task_runner.py:85} INFO - Job 81: Subtask data_insight_task\n[2024-04-05T06:37:35.099+0000] {task_command.py:416} INFO - Running <TaskInstance: OpenMetadata_dataInsight.data_insight_task manual__2024-04-05T06:37:28+00:00 [running]> on host 31103bd4cfc9\n[2024-04-05T06:37:35.151+0000] {taskinstance.py:1662} INFO - Exporting env vars: AIRFLOW_CTX_DAG_OWNER='openmetadata' AIRFLOW_CTX_DAG_ID='OpenMetadata_dataInsight' AIRFLOW_CTX_TASK_ID='data_insight_task' AIRFLOW_CTX_EXECUTION_DATE='2024-04-05T06:37:28+00:00",
  total: '1',
};
