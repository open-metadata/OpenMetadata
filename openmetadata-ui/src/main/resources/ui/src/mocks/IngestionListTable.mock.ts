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

import { AddIngestionButtonProps } from '../components/Settings/Services/Ingestion/AddIngestionButton.interface';
import { IngestionListTableProps } from '../components/Settings/Services/Ingestion/IngestionListTable/IngestionListTable.interface';
import { PipelineActionsProps } from '../components/Settings/Services/Ingestion/IngestionListTable/PipelineActions/PipelineActions.interface';
import { PipelineActionsDropdownProps } from '../components/Settings/Services/Ingestion/IngestionListTable/PipelineActions/PipelineActionsDropdown.interface';
import { AirflowStatusContextType } from '../context/AirflowStatusProvider/AirflowStatusProvider.interface';
import { CursorType } from '../enums/pagination.enum';
import { ServiceCategory } from '../enums/service.enum';
import { DatabaseServiceType } from '../generated/entity/data/database';
import { ConfigType } from '../generated/entity/services/databaseService';
import {
  AuthProvider,
  FluffyType as AirflowConfigType,
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
const mockHandleIngestionListUpdate = jest.fn();
const mockHandlePipelineIdToFetchStatus = jest.fn();
const mockOnPageChange = jest.fn();

export const ingestionDataName = 'OpenMetadata_elasticSearchReIndex';

export const mockESIngestionData: IngestionPipeline = {
  id: '5ff66f1c-9809-4333-836e-ba4dadda11f2',
  name: ingestionDataName,
  displayName: 'OpenMetadata_elasticSearchReIndex',
  description: 'Elastic Search ReIndexing Pipeline',
  pipelineType: PipelineType.ElasticSearchReindex,
  fullyQualifiedName: 'OpenMetadata.OpenMetadata_elasticSearchReIndex',
  sourceConfig: {
    config: {
      type: AirflowConfigType.MetadataToElasticSearch,
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
    secretsManagerProvider: SecretsManagerProvider.DB,
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
    description: 'Service Used for creating OpenMetadata Ingestion Pipelines.',
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
};
const mockPagingCursor = {
  cursorData: {
    cursorType: CursorType.AFTER,
    cursorValue: 'mockCursorValue',
  },
  currentPage: '1',
  pageSize: 10,
};
const mockPagingInfoObj = {
  paging: { total: 10 },
  handlePagingChange: jest.fn(),
  currentPage: 1,
  handlePageChange: jest.fn(),
  pageSize: 10,
  handlePageSizeChange: jest.fn(),
  showPagination: true,
  pagingCursor: mockPagingCursor,
};

export const mockIngestionListTableProps: IngestionListTableProps = {
  triggerIngestion: mockTriggerIngestion,
  deployIngestion: mockDeployIngestion,
  handleEnableDisableIngestion: mockHandleEnableDisableIngestion,
  onIngestionWorkflowsUpdate: mockOnIngestionWorkflowsUpdate,
  serviceCategory: ServiceCategory.METADATA_SERVICES,
  serviceName: 'OpenMetadata',
  ingestionData: [mockESIngestionData],
  pipelineType: PipelineType.ElasticSearchReindex,
  isLoading: false,
  airflowInformation: {
    isFetchingStatus: false,
    isAirflowAvailable: true,
    platform: '',
  } as AirflowStatusContextType,
  ingestionPagingInfo: mockPagingInfoObj,
  handlePipelineIdToFetchStatus: mockHandlePipelineIdToFetchStatus,
  onPageChange: mockOnPageChange,
  handleIngestionListUpdate: mockHandleIngestionListUpdate,
};

export const mockAddIngestionButtonProps: AddIngestionButtonProps = {
  serviceDetails: {
    id: 'service',
    name: 'service',
    serviceType: DatabaseServiceType.Mysql,
    connection: {
      config: {
        type: ConfigType.Mysql,
      },
    },
  },
  pipelineType: PipelineType.Metadata,
  ingestionList: [],
  serviceCategory: ServiceCategory.DATABASE_SERVICES,
  serviceName: 'OpenMetadata',
};

export const mockPipelineActionsProps: PipelineActionsProps = {
  pipeline: mockESIngestionData,
  handleDeleteSelection: jest.fn(),
  handleIsConfirmationModalOpen: jest.fn(),
  ingestionPipelinePermissions: {
    OpenMetadata_elasticSearchReIndex: ENTITY_PERMISSIONS,
  },
  triggerIngestion: jest.fn(),
  deployIngestion: jest.fn(),
  handleEnableDisableIngestion: jest.fn(),
  serviceCategory: ServiceCategory.SEARCH_SERVICES,
  serviceName: 'testService',
  onIngestionWorkflowsUpdate: jest.fn(),
  handleEditClick: jest.fn(),
};

export const mockPipelineActionsDropdownProps: PipelineActionsDropdownProps = {
  ingestion: mockESIngestionData,
  triggerIngestion: jest.fn(),
  deployIngestion: jest.fn(),
  serviceName: 'testService',
  serviceCategory: ServiceCategory.SEARCH_SERVICES,
  handleEditClick: jest.fn(),
  handleDeleteSelection: jest.fn(),
  handleIsConfirmationModalOpen: jest.fn(),
  onIngestionWorkflowsUpdate: jest.fn(),
  ingestionPipelinePermissions: {
    OpenMetadata_elasticSearchReIndex: ENTITY_PERMISSIONS,
  },
};
