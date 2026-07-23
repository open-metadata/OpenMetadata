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
import { startCase } from 'lodash';
import { ExplorePageTabs } from '../enums/Explore.enum';
import { APIServiceType } from '../generated/entity/services/apiService';
import { DashboardServiceType } from '../generated/entity/services/dashboardService';
import { DriveServiceType } from '../generated/entity/services/driveService';
import { MessagingServiceType } from '../generated/entity/services/messagingService';
import { MlModelServiceType } from '../generated/entity/services/mlmodelService';
import { PipelineServiceType } from '../generated/entity/services/pipelineService';
import { SearchServiceType } from '../generated/entity/services/searchService';
import { Type as SecurityServiceType } from '../generated/entity/services/securityService';
import { StorageServiceType } from '../generated/entity/services/storageService';
import { LANDING_WIDGET_DEFAULT_ICON_URL } from './LandingPageWidgetIconUtils.constants';
import { getServiceIcon } from './ServiceIconUtils';

type DataAssetServiceCategory =
  | 'api'
  | 'dashboard'
  | 'database'
  | 'drive'
  | 'mlmodel'
  | 'pipeline'
  | 'search'
  | 'security'
  | 'storage'
  | 'topic';

type ServiceTypeEnum = Record<string, string>;

const normalizeServiceType = (serviceType: string) =>
  serviceType.toLowerCase().replaceAll(/[_\s-]/g, '');

const getNormalizedServiceTypes = (
  serviceTypes: ServiceTypeEnum,
  aliases: string[] = []
) =>
  new Set([
    ...Object.values(serviceTypes).map(normalizeServiceType),
    ...aliases.map(normalizeServiceType),
  ]);

const MESSAGING_SERVICE_TYPES = getNormalizedServiceTypes(MessagingServiceType);

const DASHBOARD_SERVICE_TYPES = getNormalizedServiceTypes(DashboardServiceType);

const PIPELINE_SERVICE_TYPES = getNormalizedServiceTypes(PipelineServiceType);

const ML_MODEL_SERVICE_TYPES = getNormalizedServiceTypes(MlModelServiceType, [
  'scikit',
]);

const STORAGE_SERVICE_TYPES = getNormalizedServiceTypes(StorageServiceType);

const SEARCH_SERVICE_TYPES = getNormalizedServiceTypes(SearchServiceType);

const API_SERVICE_TYPES = getNormalizedServiceTypes(APIServiceType, [
  'customapi',
]);

const DRIVE_SERVICE_TYPES = getNormalizedServiceTypes(DriveServiceType);

const SECURITY_SERVICE_TYPES = getNormalizedServiceTypes(SecurityServiceType, [
  'customsecurity',
]);

const SERVICE_TYPE_LABELS: Record<string, string> = {
  azuresql: 'Azure SQL',
  bigquery: 'Big Query',
  bigtable: 'Big Table',
  customapi: 'Custom API',
  customdashboard: 'Custom Dashboard',
  customdatabase: 'Custom Database',
  customdrive: 'Custom Drive',
  custommessaging: 'Custom Messaging',
  custommlmodel: 'Custom ML Model',
  custompipeline: 'Custom Pipeline',
  customsearch: 'Custom Search',
  customsecurity: 'Custom Security',
  customstorage: 'Custom Storage',
  dbtcloud: 'dbt Cloud',
  deltalake: 'DeltaLake',
  domodashboard: 'Domo Dashboard',
  domodatabase: 'Domo Database',
  dynamodb: 'Dynamo DB',
  mlflow: 'MLflow',
  mongodb: 'Mongo DB',
  mssql: 'MS SQL',
  mysql: 'MySQL',
  pinotdb: 'PinotDB',
  powerbi: 'Power BI',
  powerbireportserver: 'Power BI Report Server',
  qliksense: 'Qlik Sense',
  saperp: 'SAP ERP',
  saphana: 'SAP Hana',
  saps4hana: 'SAP S/4HANA',
  sqlite: 'SQLite',
};

const DEFAULT_ICON_KEYS: Record<DataAssetServiceCategory, string> = {
  api: 'restservice',
  dashboard: 'dashboarddefault',
  database: 'databasedefault',
  drive: 'drivedefault',
  mlmodel: 'mlmodeldefault',
  pipeline: 'pipelinedefault',
  search: 'searchdefault',
  security: 'securitydefault',
  storage: 'storagedefault',
  topic: 'topicdefault',
};

const SERVICE_ICON_ALIASES: Record<string, string> = {
  ibmdb2: 'db2',
  sklearn: 'scikit',
};

export const getDataAssetServiceCategory = (
  serviceType: string
): DataAssetServiceCategory => {
  const normalizedServiceType = normalizeServiceType(serviceType);

  if (MESSAGING_SERVICE_TYPES.has(normalizedServiceType)) {
    return 'topic';
  }
  if (DASHBOARD_SERVICE_TYPES.has(normalizedServiceType)) {
    return 'dashboard';
  }
  if (PIPELINE_SERVICE_TYPES.has(normalizedServiceType)) {
    return 'pipeline';
  }
  if (ML_MODEL_SERVICE_TYPES.has(normalizedServiceType)) {
    return 'mlmodel';
  }
  if (STORAGE_SERVICE_TYPES.has(normalizedServiceType)) {
    return 'storage';
  }
  if (SEARCH_SERVICE_TYPES.has(normalizedServiceType)) {
    return 'search';
  }
  if (API_SERVICE_TYPES.has(normalizedServiceType)) {
    return 'api';
  }
  if (DRIVE_SERVICE_TYPES.has(normalizedServiceType)) {
    return 'drive';
  }
  if (SECURITY_SERVICE_TYPES.has(normalizedServiceType)) {
    return 'security';
  }

  return 'database';
};

export const getDataAssetExploreTab = (
  serviceType: string
): ExplorePageTabs => {
  const category = getDataAssetServiceCategory(serviceType);

  const tabByCategory: Record<DataAssetServiceCategory, ExplorePageTabs> = {
    api: ExplorePageTabs.API_ENDPOINT,
    dashboard: ExplorePageTabs.DASHBOARDS,
    database: ExplorePageTabs.TABLES,
    drive: ExplorePageTabs.DIRECTORIES,
    mlmodel: ExplorePageTabs.MLMODELS,
    pipeline: ExplorePageTabs.PIPELINES,
    search: ExplorePageTabs.SEARCH_INDEX,
    security: ExplorePageTabs.TABLES,
    storage: ExplorePageTabs.CONTAINERS,
    topic: ExplorePageTabs.TOPICS,
  };

  return tabByCategory[category];
};

export const getFormattedDataAssetServiceType = (serviceType: string) => {
  const normalizedServiceType = normalizeServiceType(serviceType);

  return (
    SERVICE_TYPE_LABELS[normalizedServiceType] ??
    startCase(serviceType.replaceAll(/[_-]/g, ' '))
  );
};

export const DataAssetServiceLogo = ({
  serviceType,
  className = '',
}: {
  serviceType: string;
  className?: string;
}): JSX.Element | null => {
  const category = getDataAssetServiceCategory(serviceType);
  const normalizedServiceType = normalizeServiceType(serviceType);
  const logo =
    getServiceIcon(
      SERVICE_ICON_ALIASES[normalizedServiceType] ?? normalizedServiceType
    ) ??
    getServiceIcon(DEFAULT_ICON_KEYS[category]) ??
    LANDING_WIDGET_DEFAULT_ICON_URL;

  return <img alt="" className={className} src={logo} />;
};
