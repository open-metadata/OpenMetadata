import { AppType, ProviderType } from '../../generated/entity/applications/app';
import {
  ScheduleTimeline,
  Status,
} from '../../generated/entity/applications/appRunRecord';
import {
  Permissions,
  ScheduleType,
} from '../../generated/entity/applications/marketplace/appMarketPlaceDefinition';
import { SearchIndexMappingLanguage } from '../../generated/settings/settings';

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
export const mockApplicationData = {
  id: 'bfa9dee3-6737-4e82-b73b-2aef15420ba0',
  runId: 'pipeline-run-id',
  status: Status.Success,
  successContext: null,
  name: 'SearchIndexingApplication',
  displayName: 'Search Indexing',
  features: 'Sync OpenMetadata and Elastic Search and Recreate Indexes.',
  fullyQualifiedName: 'SearchIndexingApplication',
  version: 0.1,
  updatedAt: 1706768603545,
  updatedBy: 'admin',
  href: 'http://localhost:8585/api/v1/apps/bfa9dee3-6737-4e82-b73b-2aef15420ba0',
  deleted: false,
  provider: ProviderType.User,
  developer: 'Collate Inc.',
  developerUrl: 'https://www.getcollate.io',
  privacyPolicyUrl: 'https://www.getcollate.io',
  supportEmail: 'support@getcollate.io',
  className: 'org.openmetadata.service.apps.bundles.searchIndex.SearchIndexApp',
  appType: AppType.Internal,
  scheduleType: ScheduleType.ScheduledOrManual,
  permission: Permissions.All,
  bot: {
    id: '7afdf172-ba26-44b5-b2bd-4dfd6768f44c',
    type: 'bot',
    name: 'SearchIndexingApplicationBot',
    fullyQualifiedName: 'SearchIndexingApplicationBot',
    deleted: false,
  },
  runtime: {
    enabled: true,
  },
  runType: 'runType',
  allowConfiguration: true,
  appConfiguration: {
    entities: [
      'table',
      'dashboard',
      'topic',
      'pipeline',
      'searchIndex',
      'user',
      'team',
      'glossary',
      'glossaryTerm',
      'mlmodel',
      'tag',
      'classification',
      'query',
      'container',
      'database',
      'databaseSchema',
      'testCase',
      'testSuite',
      'chart',
      'dashboardDataModel',
      'databaseService',
      'messagingService',
      'dashboardService',
      'pipelineService',
      'mlmodelService',
      'searchService',
      'entityReportData',
      'webAnalyticEntityViewReportData',
      'webAnalyticUserActivityReportData',
      'domain',
      'storedProcedure',
      'dataProduct',
    ],
    batchSize: 100,
    recreateIndex: true,
    searchIndexMappingLanguage: SearchIndexMappingLanguage.En,
  },
  pipelines: [],
  appSchedule: {
    scheduleTimeline: ScheduleTimeline.Custom,
    cronExpression: '0 0 0 1/1 * ? *',
  },
  appScreenshots: ['SearchIndexPic1.png'],
};

export const mockExternalApplicationData = {
  id: '633f579c-512c-4b5f-864b-5664aa56b37f',
  name: 'CollateAIApplication',
  displayName: 'Collate AI',
  description: 'Test Description',
  features: 'Test Features',
  fullyQualifiedName: 'CollateAIApplication',
  owners: [],
  version: 0.5,
  updatedAt: 1739539645532,
  updatedBy: 'joseph',
  href: 'http://demo.getcollate.io/api/v1/apps/633f579c-512c-4b5f-864b-5664aa56b37f',
  deleted: false,
  developer: 'Collate Inc.',
  developerUrl: 'https://www.getcollate.io',
  privacyPolicyUrl: 'https://www.getcollate.io',
  supportEmail: 'support@getcollate.io',
  className: 'io.collate.service.apps.bundles.collateAI.CollateAIApp',
  sourcePythonClass: 'metadata.applications.collateai.app.CollateAIApp',
  appType: AppType.External,
  scheduleType: ScheduleType.ScheduledOrManual,
  permission: Permissions.All,
  bot: {
    id: '7532ae3e-39d2-4494-9f89-6e3568fa853b',
    type: 'bot',
    name: 'CollateAIApplicationBot',
    fullyQualifiedName: 'CollateAIApplicationBot',
    displayName: 'CollateAIApplicationBot',
    deleted: false,
  },
  runtime: {
    enabled: 'true',
  },
  allowConfiguration: true,
  system: false,
  appConfiguration: {},
  preview: false,
  pipelines: [
    {
      id: 'ecc41d34-1479-4ac0-84d1-1d05c951a5c0',
      type: 'ingestionPipeline',
      name: 'CollateAIApplication',
      fullyQualifiedName: 'OpenMetadata.CollateAIApplication',
      description: 'Test Description',
      displayName: 'Collate AI',
      deleted: false,
    },
  ],
  appSchedule: {
    scheduleTimeline: ScheduleTimeline.None,
  },
  appScreenshots: ['CollateAIApp.png'],
  supportsInterrupt: false,
};
