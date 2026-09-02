/*
 *  Copyright 2025 Collate.
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

import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';
import type { ServiceTypes } from 'Models';
import { GlobalSettingOptions } from '../constants/GlobalSettings.constants';
import {
  SERVICE_TYPES_ENUM,
  SERVICE_TYPE_MAP,
} from '../constants/Services.constant';
import {
  ResourceEntity,
  UIPermission,
} from '../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { ServiceCategory } from '../enums/service.enum';
import { StorageServiceType } from '../generated/entity/data/container';
import { MlModelServiceType } from '../generated/entity/data/mlmodel';
import { Operation } from '../generated/entity/policies/policy';
import { DashboardServiceType } from '../generated/entity/services/dashboardService';
import { DatabaseServiceType } from '../generated/entity/services/databaseService';
import { DriveServiceType } from '../generated/entity/services/driveService';
import { PipelineType as IngestionPipelineType } from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { MessagingServiceType } from '../generated/entity/services/messagingService';
import { PipelineServiceType } from '../generated/entity/services/pipelineService';
import { SearchServiceType } from '../generated/entity/services/searchService';
import { t } from './i18next/LocalUtil';
import { checkPermission } from './PermissionsUtils';
import { replaceAllSpacialCharWith_ } from './StringUtils';

export const getIngestionName = (
  serviceName: string,
  type: IngestionPipelineType
) => {
  if (
    [
      IngestionPipelineType.Profiler,
      IngestionPipelineType.Metadata,
      IngestionPipelineType.Lineage,
      IngestionPipelineType.Dbt,
      IngestionPipelineType.Application,
      IngestionPipelineType.TestSuite,
    ].includes(type)
  ) {
    return `${replaceAllSpacialCharWith_(
      serviceName
    )}_${type}_${cryptoRandomString({
      length: 8,
      type: 'alphanumeric',
    })}`;
  } else {
    return `${serviceName}_${type}`;
  }
};

export const shouldTestConnection = (serviceType: string) => {
  return (
    serviceType !== DatabaseServiceType.CustomDatabase &&
    serviceType !== MessagingServiceType.CustomMessaging &&
    serviceType !== DashboardServiceType.CustomDashboard &&
    serviceType !== MlModelServiceType.CustomMlModel &&
    serviceType !== PipelineServiceType.CustomPipeline &&
    serviceType !== StorageServiceType.CustomStorage &&
    serviceType !== SearchServiceType.CustomSearch &&
    serviceType !== DriveServiceType.CustomDrive
  );
};

export const getServiceType = (serviceCat: ServiceCategory) =>
  SERVICE_TYPE_MAP[serviceCat];

export const getServiceTypesFromServiceCategory = (
  serviceCat: ServiceCategory
) => {
  return SERVICE_TYPES_ENUM[serviceCat];
};

const SERVICE_ROUTE_MAP: Partial<Record<ServiceTypes, GlobalSettingOptions>> = {
  [ServiceCategory.MESSAGING_SERVICES]: GlobalSettingOptions.MESSAGING,
  [ServiceCategory.DASHBOARD_SERVICES]: GlobalSettingOptions.DASHBOARDS,
  [ServiceCategory.PIPELINE_SERVICES]: GlobalSettingOptions.PIPELINES,
  [ServiceCategory.ML_MODEL_SERVICES]: GlobalSettingOptions.MLMODELS,
  [ServiceCategory.METADATA_SERVICES]: GlobalSettingOptions.METADATA,
  [ServiceCategory.STORAGE_SERVICES]: GlobalSettingOptions.STORAGES,
  [ServiceCategory.SEARCH_SERVICES]: GlobalSettingOptions.SEARCH,
  [ServiceCategory.API_SERVICES]: GlobalSettingOptions.APIS,
  [ServiceCategory.DRIVE_SERVICES]: GlobalSettingOptions.DRIVES,
  [ServiceCategory.SECURITY_SERVICES]: GlobalSettingOptions.SECURITY,
};

export const getServiceRouteFromServiceType = (type: ServiceTypes) =>
  SERVICE_ROUTE_MAP[type] ?? GlobalSettingOptions.DATABASES;

export const getSearchIndexForService = (type: ServiceTypes): SearchIndex => {
  switch (type) {
    case ServiceCategory.DATABASE_SERVICES:
      return SearchIndex.DATABASE;
    case ServiceCategory.MESSAGING_SERVICES:
      return SearchIndex.TOPIC;
    case ServiceCategory.DASHBOARD_SERVICES:
      return SearchIndex.DASHBOARD;
    case ServiceCategory.PIPELINE_SERVICES:
      return SearchIndex.PIPELINE;
    case ServiceCategory.ML_MODEL_SERVICES:
      return SearchIndex.MLMODEL;
    case ServiceCategory.STORAGE_SERVICES:
      return SearchIndex.CONTAINER;
    case ServiceCategory.SEARCH_SERVICES:
      return SearchIndex.SEARCH_INDEX;
    case ServiceCategory.API_SERVICES:
      return SearchIndex.API_COLLECTION;
    case ServiceCategory.DRIVE_SERVICES:
      return SearchIndex.DIRECTORY;
    default:
      return SearchIndex.DATABASE;
  }
};

const RESOURCE_ENTITY_BY_CATEGORY_ENTRIES: [string, ResourceEntity][] = [
  ['dashboards', ResourceEntity.DASHBOARD_SERVICE],
  [ServiceCategory.DASHBOARD_SERVICES, ResourceEntity.DASHBOARD_SERVICE],
  ['databases', ResourceEntity.DATABASE_SERVICE],
  [ServiceCategory.DATABASE_SERVICES, ResourceEntity.DATABASE_SERVICE],
  ['mlModels', ResourceEntity.ML_MODEL_SERVICE],
  [ServiceCategory.ML_MODEL_SERVICES, ResourceEntity.ML_MODEL_SERVICE],
  ['messaging', ResourceEntity.MESSAGING_SERVICE],
  [ServiceCategory.MESSAGING_SERVICES, ResourceEntity.MESSAGING_SERVICE],
  ['pipelines', ResourceEntity.PIPELINE_SERVICE],
  [ServiceCategory.PIPELINE_SERVICES, ResourceEntity.PIPELINE_SERVICE],
  ['metadata', ResourceEntity.METADATA_SERVICE],
  [ServiceCategory.METADATA_SERVICES, ResourceEntity.METADATA_SERVICE],
  ['storageServices', ResourceEntity.STORAGE_SERVICE],
  [ServiceCategory.STORAGE_SERVICES, ResourceEntity.STORAGE_SERVICE],
  ['searchIndex', ResourceEntity.SEARCH_SERVICE],
  [ServiceCategory.SEARCH_SERVICES, ResourceEntity.SEARCH_SERVICE],
  [ServiceCategory.API_SERVICES, ResourceEntity.API_SERVICE],
  ['directories', ResourceEntity.DRIVE_SERVICE],
  ['files', ResourceEntity.DRIVE_SERVICE],
  ['spreadsheets', ResourceEntity.DRIVE_SERVICE],
  ['worksheets', ResourceEntity.DRIVE_SERVICE],
  [ServiceCategory.DRIVE_SERVICES, ResourceEntity.DRIVE_SERVICE],
  [ServiceCategory.SECURITY_SERVICES, ResourceEntity.SECURITY_SERVICE],
];

const RESOURCE_ENTITY_BY_CATEGORY: Record<string, ResourceEntity> =
  Object.fromEntries(RESOURCE_ENTITY_BY_CATEGORY_ENTRIES);

export const getResourceEntityFromServiceCategory = (
  category: string | ServiceCategory
) => RESOURCE_ENTITY_BY_CATEGORY[category] ?? ResourceEntity.DATABASE_SERVICE;

// Used to decide whether a category-agnostic "Add New Service" entry point (the All Connections
// tab, the /settings/services landing page) should be shown at all — the user may not be able to
// create every category, but the button should still appear if they can create at least one.
export const canCreateAnyServiceCategory = (permissions: UIPermission) =>
  Object.values(ServiceCategory).some((category) =>
    checkPermission(
      Operation.Create,
      getResourceEntityFromServiceCategory(category),
      permissions
    )
  );

export const getCountLabel = (serviceName: ServiceTypes) => {
  switch (serviceName) {
    case ServiceCategory.DASHBOARD_SERVICES:
      return t('label.dashboard-plural');
    case ServiceCategory.MESSAGING_SERVICES:
      return t('label.topic-plural');
    case ServiceCategory.PIPELINE_SERVICES:
      return t('label.pipeline-plural');
    case ServiceCategory.ML_MODEL_SERVICES:
      return t('label.ml-model-plural');
    case ServiceCategory.STORAGE_SERVICES:
      return t('label.container-plural');
    case ServiceCategory.SEARCH_SERVICES:
      return t('label.search-index-plural');
    case ServiceCategory.API_SERVICES:
      return t('label.collection-plural');
    case ServiceCategory.DRIVE_SERVICES:
      return t('label.directory-plural');
    case ServiceCategory.DATABASE_SERVICES:
    default:
      return t('label.database-plural');
  }
};

export const getTestConnectionName = (connectionType: string) => {
  return `test-connection-${connectionType}-${cryptoRandomString({
    length: 8,
    type: 'alphanumeric',
  })}`;
};

const SERVICE_CATEGORY_BY_ENTITY_TYPE: Partial<
  Record<EntityType, ServiceCategory>
> = {
  [EntityType.DASHBOARD_SERVICE]: ServiceCategory.DASHBOARD_SERVICES,
  [EntityType.MESSAGING_SERVICE]: ServiceCategory.MESSAGING_SERVICES,
  [EntityType.PIPELINE_SERVICE]: ServiceCategory.PIPELINE_SERVICES,
  [EntityType.MLMODEL_SERVICE]: ServiceCategory.ML_MODEL_SERVICES,
  [EntityType.STORAGE_SERVICE]: ServiceCategory.STORAGE_SERVICES,
  [EntityType.METADATA_SERVICE]: ServiceCategory.METADATA_SERVICES,
  [EntityType.SEARCH_SERVICE]: ServiceCategory.SEARCH_SERVICES,
  [EntityType.API_SERVICE]: ServiceCategory.API_SERVICES,
  [EntityType.DRIVE_SERVICE]: ServiceCategory.DRIVE_SERVICES,
  [EntityType.SECURITY_SERVICE]: ServiceCategory.SECURITY_SERVICES,
};

export const getServiceCategoryFromEntityType = (
  entityType: EntityType
): string =>
  SERVICE_CATEGORY_BY_ENTITY_TYPE[entityType] ??
  ServiceCategory.DATABASE_SERVICES;

const ENTITY_TYPE_BY_SERVICE_CATEGORY: Partial<
  Record<ServiceTypes, EntityType>
> = {
  [ServiceCategory.DASHBOARD_SERVICES]: EntityType.DASHBOARD_SERVICE,
  [ServiceCategory.MESSAGING_SERVICES]: EntityType.MESSAGING_SERVICE,
  [ServiceCategory.PIPELINE_SERVICES]: EntityType.PIPELINE_SERVICE,
  [ServiceCategory.ML_MODEL_SERVICES]: EntityType.MLMODEL_SERVICE,
  [ServiceCategory.METADATA_SERVICES]: EntityType.METADATA_SERVICE,
  [ServiceCategory.STORAGE_SERVICES]: EntityType.STORAGE_SERVICE,
  [ServiceCategory.SEARCH_SERVICES]: EntityType.SEARCH_SERVICE,
  [ServiceCategory.API_SERVICES]: EntityType.API_SERVICE,
  [ServiceCategory.DRIVE_SERVICES]: EntityType.DRIVE_SERVICE,
  [ServiceCategory.SECURITY_SERVICES]: EntityType.SECURITY_SERVICE,
};

export const getEntityTypeFromServiceCategory = (
  serviceCategory: ServiceTypes
) =>
  ENTITY_TYPE_BY_SERVICE_CATEGORY[serviceCategory] ??
  EntityType.DATABASE_SERVICE;

export const getServiceDisplayNameQueryFilter = (displayName: string) => ({
  query: {
    bool: {
      must: [
        {
          bool: {
            should: [
              {
                term: {
                  'service.displayName.keyword': displayName,
                },
              },
            ],
          },
        },
      ],
    },
  },
});

export const getServiceNameQueryFilter = (serviceName: string) => ({
  query: {
    match: {
      'service.name.keyword': serviceName,
    },
  },
});

export const getActiveFieldNameForAppDocs = (activeField?: string) => {
  if (!activeField) {
    return undefined;
  }

  // Split by '/', remove 'root', then filter out array indices and join with '.'
  return activeField
    .split('/')
    .slice(1)
    .filter((segment) => !/^\d+$/.test(segment))
    .join('.');
};

export const getReadableCountString = (count: number, maxDigits = 2) => {
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: maxDigits,
  }).format(count);
};

export const getSearchIndexFromService = (serviceName: string): SearchIndex => {
  const mapping: Partial<Record<string, SearchIndex>> = {
    [ServiceCategory.DATABASE_SERVICES]: SearchIndex.DATABASE_SERVICE,
    [ServiceCategory.DASHBOARD_SERVICES]: SearchIndex.DASHBOARD_SERVICE,
    [ServiceCategory.MESSAGING_SERVICES]: SearchIndex.MESSAGING_SERVICE,
    [ServiceCategory.PIPELINE_SERVICES]: SearchIndex.PIPELINE_SERVICE,
    [ServiceCategory.ML_MODEL_SERVICES]: SearchIndex.ML_MODEL_SERVICE,
    [ServiceCategory.STORAGE_SERVICES]: SearchIndex.STORAGE_SERVICE,
    [ServiceCategory.SEARCH_SERVICES]: SearchIndex.SEARCH_SERVICE,
    [ServiceCategory.API_SERVICES]: SearchIndex.API_SERVICE,
    [ServiceCategory.DRIVE_SERVICES]: SearchIndex.DRIVE_SERVICE,
    [ServiceCategory.METADATA_SERVICES]: SearchIndex.METADATA_SERVICE,
  };

  return mapping[serviceName] ?? SearchIndex.DATABASE_SERVICE;
};
