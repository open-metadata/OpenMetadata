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

import { map, startCase } from 'lodash';
import { ServiceTypes, StepperStepType } from 'Models';
import { EntityType } from '../enums/entity.enum';
import { ServiceCategory } from '../enums/service.enum';
import { PipelineType } from '../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { WorkflowStatus } from '../generated/entity/automations/workflow';
import { StorageServiceType } from '../generated/entity/data/container';
import { APIServiceType } from '../generated/entity/services/apiService';
import { DashboardServiceType } from '../generated/entity/services/dashboardService';
import { DatabaseServiceType } from '../generated/entity/services/databaseService';
import { DriveServiceType } from '../generated/entity/services/driveService';
import { MessagingServiceType } from '../generated/entity/services/messagingService';
import { MetadataServiceType } from '../generated/entity/services/metadataService';
import { MlModelServiceType } from '../generated/entity/services/mlmodelService';
import { PipelineServiceType } from '../generated/entity/services/pipelineService';
import { SearchServiceType } from '../generated/entity/services/searchService';
import { Type as SecurityServiceType } from '../generated/entity/services/securityService';
import { ServiceType } from '../generated/entity/services/serviceType';

export const OPEN_METADATA = 'OpenMetadata';
export const JWT_CONFIG = 'openMetadataJWTClientConfig';

export const excludedService = [
  MlModelServiceType.Sklearn,
  MetadataServiceType.MetadataES,
  MetadataServiceType.OpenMetadata,
  PipelineServiceType.Spark,
];

export const arrServiceTypes: Array<ServiceTypes> = [
  'databaseServices',
  'messagingServices',
  'dashboardServices',
  'pipelineServices',
  'mlmodelServices',
  'storageServices',
  'apiServices',
  'securityServices',
  'driveServices',
];

export const SERVICE_CATEGORY: { [key: string]: ServiceCategory } = {
  databases: ServiceCategory.DATABASE_SERVICES,
  messaging: ServiceCategory.MESSAGING_SERVICES,
  dashboards: ServiceCategory.DASHBOARD_SERVICES,
  pipelines: ServiceCategory.PIPELINE_SERVICES,
  mlmodels: ServiceCategory.ML_MODEL_SERVICES,
  metadata: ServiceCategory.METADATA_SERVICES,
  storages: ServiceCategory.STORAGE_SERVICES,
  search: ServiceCategory.SEARCH_SERVICES,
  apiServices: ServiceCategory.API_SERVICES,
  security: ServiceCategory.SECURITY_SERVICES,
  drives: ServiceCategory.DRIVE_SERVICES,
};

export const servicesDisplayName: Record<
  string,
  { key: string; entity: string }
> = {
  databaseServices: { key: 'label.entity-service', entity: 'label.database' },
  messagingServices: { key: 'label.entity-service', entity: 'label.messaging' },
  dashboardServices: { key: 'label.entity-service', entity: 'label.dashboard' },
  pipelineServices: { key: 'label.entity-service', entity: 'label.pipeline' },
  mlmodelServices: { key: 'label.entity-service', entity: 'label.ml-model' },
  metadataServices: { key: 'label.entity-service', entity: 'label.metadata' },
  storageServices: { key: 'label.entity-service', entity: 'label.storage' },
  searchServices: { key: 'label.entity-service', entity: 'label.search' },
  dashboardDataModel: {
    key: 'label.entity-service',
    entity: 'label.data-model',
  },
  apiServices: { key: 'label.entity-service', entity: 'label.api-uppercase' },
  securityServices: { key: 'label.entity-service', entity: 'label.security' },
  driveServices: { key: 'label.entity-service', entity: 'label.drive' },
};

export const SERVICE_CATEGORY_OPTIONS = map(ServiceCategory, (value) => ({
  label: startCase(value),
  value,
}));

export const STEPS_FOR_ADD_SERVICE: Array<StepperStepType> = [
  {
    name: 'label.select-field',
    nameData: { field: 'label.service-type' },
    step: 1,
  },
  {
    name: 'label.configure-entity',
    nameData: { entity: 'label.service' },
    step: 2,
  },
  {
    name: 'label.connection-entity',
    nameData: { entity: 'label.detail-plural' },
    step: 3,
  },
  {
    name: 'label.set-default-filters',
    step: 4,
  },
];

export const STEPS_FOR_EDIT_SERVICE: Array<StepperStepType> = [
  {
    name: 'label.connection-entity',
    nameData: { entity: 'label.detail-plural' },
    step: 1,
  },
  {
    name: 'label.set-default-filters',
    step: 2,
  },
];

export const SERVICE_DEFAULT_ERROR_MAP = {
  serviceType: false,
};

export const FETCHING_EXPIRY_TIME = 3 * 60 * 1000;
export const FETCH_INTERVAL = 2000;

export const WORKFLOW_COMPLETE_STATUS = [
  WorkflowStatus.Failed,
  WorkflowStatus.Successful,
];

export const TEST_CONNECTION_PROGRESS_PERCENTAGE = {
  ZERO: 0,
  ONE: 1,
  TEN: 10,
  TWENTY: 20,
  FORTY: 40,
  HUNDRED: 100,
};

export const SERVICE_TYPE_MAP = {
  [ServiceCategory.DASHBOARD_SERVICES]: ServiceType.Dashboard,
  [ServiceCategory.DATABASE_SERVICES]: ServiceType.Database,
  [ServiceCategory.MESSAGING_SERVICES]: ServiceType.Messaging,
  [ServiceCategory.ML_MODEL_SERVICES]: ServiceType.MlModel,
  [ServiceCategory.METADATA_SERVICES]: ServiceType.Metadata,
  [ServiceCategory.STORAGE_SERVICES]: ServiceType.Storage,
  [ServiceCategory.PIPELINE_SERVICES]: ServiceType.Pipeline,
  [ServiceCategory.SEARCH_SERVICES]: ServiceType.Search,
  [ServiceCategory.API_SERVICES]: ServiceType.API,
  [ServiceCategory.SECURITY_SERVICES]: ServiceType.Security,
  [ServiceCategory.DRIVE_SERVICES]: ServiceType.Drive,
};

export const SERVICE_TYPES_ENUM = {
  [ServiceCategory.DASHBOARD_SERVICES]: DashboardServiceType,
  [ServiceCategory.DATABASE_SERVICES]: DatabaseServiceType,
  [ServiceCategory.MESSAGING_SERVICES]: MessagingServiceType,
  [ServiceCategory.ML_MODEL_SERVICES]: MlModelServiceType,
  [ServiceCategory.METADATA_SERVICES]: MetadataServiceType,
  [ServiceCategory.STORAGE_SERVICES]: StorageServiceType,
  [ServiceCategory.PIPELINE_SERVICES]: PipelineServiceType,
  [ServiceCategory.SEARCH_SERVICES]: SearchServiceType,
  [ServiceCategory.API_SERVICES]: APIServiceType,
  [ServiceCategory.SECURITY_SERVICES]: SecurityServiceType,
  [ServiceCategory.DRIVE_SERVICES]: DriveServiceType,
};

export const BETA_SERVICES = [
  PipelineServiceType.Ssis,
  DatabaseServiceType.Ssas,
  DatabaseServiceType.Epic,
  DashboardServiceType.Hex,
  DatabaseServiceType.ServiceNow,
  DatabaseServiceType.Dremio,
  MetadataServiceType.Collibra,
  PipelineServiceType.Mulesoft,
  DatabaseServiceType.MicrosoftFabric,
  PipelineServiceType.MicrosoftFabricPipeline,
  DatabaseServiceType.BurstIQ,
  DatabaseServiceType.StarRocks,
  DriveServiceType.SFTP,
  DriveServiceType.GoogleDrive,
  DatabaseServiceType.Informix,
  DatabaseServiceType.MicrosoftAccess,
  DashboardServiceType.SapS4Hana,
];

export const TEST_CONNECTION_INITIAL_MESSAGE =
  'message.test-your-connection-before-creating-service';

export const TEST_CONNECTION_SUCCESS_MESSAGE =
  'message.connection-test-successful';

export const TEST_CONNECTION_FAILURE_MESSAGE = 'message.connection-test-failed';

export const TEST_CONNECTION_TESTING_MESSAGE =
  'message.testing-your-connection-may-take-two-minutes';

export const TEST_CONNECTION_WARNING_MESSAGE =
  'message.connection-test-warning';

export const ADVANCED_PROPERTIES = [
  'connectionArguments',
  'connectionOptions',
  'scheme',
  'sampleDataStorageConfig',
  'computeTableMetrics',
  'computeColumnMetrics',
  'includeViews',
  'useStatistics',
  'confidence',
  'profileSampleConfig',
  'randomizedSample',
  'sampleDataCount',
  'threadCount',
  'timeoutSeconds',
  'metrics',
  'sslConfig',
  'sslMode',
  'schemaRegistrySSL',
  'consumerConfigSSL',
  'verify',
  'useNonce',
  'disablePkce',
  'maxClockSkew',
  'tokenValidity',
  'maxAge',
  'sessionExpiry',
];

export const PIPELINE_SERVICE_PLATFORM = 'Airflow';

export const SERVICE_TYPES = [
  EntityType.DATABASE_SERVICE,
  EntityType.DASHBOARD_SERVICE,
  EntityType.MESSAGING_SERVICE,
  EntityType.PIPELINE_SERVICE,
  EntityType.MLMODEL_SERVICE,
  EntityType.METADATA_SERVICE,
  EntityType.STORAGE_SERVICE,
  EntityType.SEARCH_SERVICE,
  EntityType.API_SERVICE,
  EntityType.SECURITY_SERVICE,
  EntityType.DRIVE_SERVICE,
];

export const EXCLUDE_AUTO_PILOT_SERVICE_TYPES = [EntityType.SECURITY_SERVICE];

export const SERVICE_INGESTION_PIPELINE_TYPES = [
  PipelineType.Metadata,
  PipelineType.Usage,
  PipelineType.Lineage,
  PipelineType.Profiler,
  PipelineType.AutoClassification,
  PipelineType.Dbt,
];

export const SERVICE_AUTOPILOT_AGENT_TYPES = [
  PipelineType.Metadata,
  PipelineType.Lineage,
  PipelineType.Usage,
  PipelineType.AutoClassification,
  PipelineType.Profiler,
];

export const SERVICE_TYPE_WITH_DISPLAY_NAME = new Map<string, string>([
  [PipelineServiceType.GluePipeline, 'Glue Pipeline'],
  [DatabaseServiceType.DomoDatabase, 'Domo Database'],
  [DashboardServiceType.DomoDashboard, 'Domo Dashboard'],
  [DashboardServiceType.MicroStrategy, 'Micro Strategy'],
  [DashboardServiceType.PowerBIReportServer, 'PowerBI Report Server'],
  [PipelineServiceType.DatabricksPipeline, 'Databricks Pipeline'],
  [PipelineServiceType.DomoPipeline, 'Domo Pipeline'],
  [PipelineServiceType.KafkaConnect, 'Kafka Connect'],
  [DatabaseServiceType.SapERP, 'SAP ERP'],
  [DatabaseServiceType.SapHana, 'SAP HANA'],
  [DatabaseServiceType.UnityCatalog, 'Unity Catalog'],
  [PipelineServiceType.DataFactory, 'Data Factory'],
  [PipelineServiceType.DBTCloud, 'DBT Cloud'],
  [PipelineServiceType.OpenLineage, 'Open Lineage'],
  [MetadataServiceType.AlationSink, 'Alation Sink'],
  [SearchServiceType.ElasticSearch, 'Elasticsearch'],
  [DatabaseServiceType.MicrosoftFabric, 'Microsoft Fabric'],
  [PipelineServiceType.MicrosoftFabricPipeline, 'Microsoft Fabric Pipeline'],
]);
