/*
 *  Copyright 2023 Collate.
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

import { IngestionListTableProps } from '../components/Ingestion/IngestionListTable.interface';
import { ServiceCategory } from '../enums/service.enum';
import {
  AuthProvider,
  ConfigType,
  IngestionPipeline,
  LogLevels,
  OpenmetadataType,
  PipelineState,
  PipelineType,
  ProviderType,
  SearchIndexMappingLanguage,
  SecretsManagerClientLoader,
  SecretsManagerProvider,
  VerifySSL,
} from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { ENTITY_PERMISSIONS } from './Permissions.mock';

const mockTriggerIngestion = jest.fn();
const mockDeployIngestion = jest.fn();
const mockHandleEnableDisableIngestion = jest.fn();
const mockOnIngestionWorkflowsUpdate = jest.fn();
const mockHandleDeleteSelection = jest.fn();
const mockHandleIsConfirmationModalOpen = jest.fn();

const mockESIngestionData: IngestionPipeline[] = [
  {
    id: '5ff66f1c-9809-4333-836e-ba4dadda11f2',
    name: 'OpenMetadata_elasticSearchReindex',
    displayName: 'OpenMetadata_elasticSearchReindex',
    description: 'Elastic Search Reindexing Pipeline',
    pipelineType: PipelineType.ElasticSearchReindex,
    fullyQualifiedName: 'OpenMetadata.OpenMetadata_elasticSearchReindex',
    sourceConfig: {
      config: {
        type: ConfigType.MetadataToElasticSearch,
        useSSL: false,
        timeout: 30,
        batchSize: 1000,
        verifyCerts: false,
        recreateIndex: true,
        useAwsCredentials: false,
        searchIndexMappingLanguage: SearchIndexMappingLanguage.En,
      },
    },
    openMetadataServerConnection: {
      clusterName: 'sandbox-beta',
      type: OpenmetadataType.OpenMetadata,
      hostPort: 'http://openmetadata-server:8585/api',
      authProvider: AuthProvider.Openmetadata,
      verifySSL: VerifySSL.NoSSL,
      securityConfig: {
        jwtToken: 'eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrO',
      },
      secretsManagerProvider: SecretsManagerProvider.Noop,
      secretsManagerLoader: SecretsManagerClientLoader.Noop,
      apiVersion: 'v1',
      includeTopics: true,
      includeTables: true,
      includeDashboards: true,
      includePipelines: true,
      includeMlModels: true,
      includeUsers: true,
      includeTeams: true,
      includeGlossaryTerms: true,
      includeTags: true,
      includePolicy: true,
      includeMessagingServices: true,
      enableVersionValidation: true,
      includeDatabaseServices: true,
      includePipelineServices: true,
      limitRecords: 1000,
      forceEntityOverwriting: false,
      supportsDataInsightExtraction: true,
      supportsElasticSearchReindexingExtraction: true,
    },
    airflowConfig: {
      pausePipeline: false,
      concurrency: 1,
      pipelineTimezone: 'UTC',
      retries: 3,
      retryDelay: 300,
      pipelineCatchup: false,
      scheduleInterval: '*/30 * * * *',
      maxActiveRuns: 1,
      workflowDefaultView: 'tree',
      workflowDefaultViewOrientation: 'LR',
    },
    service: {
      id: 'd520c9bb-a517-4f1e-8962-d8518de71279',
      type: 'metadataService',
      name: 'OpenMetadata',
      fullyQualifiedName: 'OpenMetadata',
      description:
        'Service Used for creating OpenMetadata Ingestion Pipelines.',
      displayName: 'OpenMetadata Service',
      deleted: false,
      href: 'http://sandbox-beta.open-metadata.org/api/v1/services/databaseServices/d520c9bb-a517-4f1e-8962-d8518de71279',
    },
    pipelineStatuses: {
      runId: '8bd07fbd-a356-45c1-8621-7bb6a4dff5b2',
      pipelineState: PipelineState.Success,
      startDate: 1690885805006,
      timestamp: 1690885805006,
      endDate: 1690885844106,
    },
    loggerLevel: LogLevels.Info,
    deployed: true,
    enabled: false,
    href: 'http://sandbox-beta.open-metadata.org/api/v1/services/ingestionPipelines/5ff66f1c-9809-4333-836e-ba4dadda11f2',
    version: 0.5,
    updatedAt: 1687854372726,
    updatedBy: 'teddy',
    changeDescription: {
      fieldsAdded: [],
      fieldsUpdated: [
        {
          name: 'enabled',
          oldValue: true,
          newValue: false,
        },
      ],
      fieldsDeleted: [],
      previousVersion: 0.4,
    },
    deleted: false,
    provider: ProviderType.User,
  },
];

export const mockIngestionListTableProps: IngestionListTableProps = {
  airflowEndpoint: 'http://localhost:8080',
  triggerIngestion: mockTriggerIngestion,
  deployIngestion: mockDeployIngestion,
  isRequiredDetailsAvailable: true,
  paging: { total: 2 },
  handleEnableDisableIngestion: mockHandleEnableDisableIngestion,
  onIngestionWorkflowsUpdate: mockOnIngestionWorkflowsUpdate,
  ingestionPipelinesPermission: {
    OpenMetadata_elasticSearchReindex: ENTITY_PERMISSIONS,
  },
  serviceCategory: ServiceCategory.METADATA_SERVICES,
  serviceName: 'OpenMetadata',
  handleDeleteSelection: mockHandleDeleteSelection,
  handleIsConfirmationModalOpen: mockHandleIsConfirmationModalOpen,
  ingestionData: mockESIngestionData,
  deleteSelection: {
    id: '',
    name: '',
    state: '',
  },
  permissions: ENTITY_PERMISSIONS,
  pipelineType: PipelineType.ElasticSearchReindex,
  isLoading: false,
};
