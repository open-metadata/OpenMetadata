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
import { ResourceEntity } from '../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { ServiceCategory } from '../enums/service.enum';
import { StorageServiceType } from '../generated/entity/data/container';
import { MlModelServiceType } from '../generated/entity/data/mlmodel';
import { DashboardServiceType } from '../generated/entity/services/dashboardService';
import { DatabaseServiceType } from '../generated/entity/services/databaseService';
import { DriveServiceType } from '../generated/entity/services/driveService';
import { PipelineType as IngestionPipelineType } from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { MessagingServiceType } from '../generated/entity/services/messagingService';
import { PipelineServiceType } from '../generated/entity/services/pipelineService';
import { t } from './i18next/LocalUtil';
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

export const getServiceRouteFromServiceType = (type: ServiceTypes) => {
  switch (type) {
    case ServiceCategory.MESSAGING_SERVICES:
      return GlobalSettingOptions.MESSAGING;
    case ServiceCategory.DASHBOARD_SERVICES:
      return GlobalSettingOptions.DASHBOARDS;
    case ServiceCategory.PIPELINE_SERVICES:
      return GlobalSettingOptions.PIPELINES;
    case ServiceCategory.ML_MODEL_SERVICES:
      return GlobalSettingOptions.MLMODELS;
    case ServiceCategory.METADATA_SERVICES:
      return GlobalSettingOptions.METADATA;
    case ServiceCategory.STORAGE_SERVICES:
      return GlobalSettingOptions.STORAGES;
    case ServiceCategory.SEARCH_SERVICES:
      return GlobalSettingOptions.SEARCH;
    case ServiceCategory.API_SERVICES:
      return GlobalSettingOptions.APIS;
    case ServiceCategory.DRIVE_SERVICES:
      return GlobalSettingOptions.DRIVES;
    case ServiceCategory.SECURITY_SERVICES:
      return GlobalSettingOptions.SECURITY;
    case ServiceCategory.DATABASE_SERVICES:
    default:
      return GlobalSettingOptions.DATABASES;
  }
};

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

export const getResourceEntityFromServiceCategory = (
  category: string | ServiceCategory
) => {
  switch (category) {
    case 'dashboards':
    case ServiceCategory.DASHBOARD_SERVICES:
      return ResourceEntity.DASHBOARD_SERVICE;

    case 'databases':
    case ServiceCategory.DATABASE_SERVICES:
      return ResourceEntity.DATABASE_SERVICE;

    case 'mlModels':
    case ServiceCategory.ML_MODEL_SERVICES:
      return ResourceEntity.ML_MODEL_SERVICE;

    case 'messaging':
    case ServiceCategory.MESSAGING_SERVICES:
      return ResourceEntity.MESSAGING_SERVICE;

    case 'pipelines':
    case ServiceCategory.PIPELINE_SERVICES:
      return ResourceEntity.PIPELINE_SERVICE;

    case 'metadata':
    case ServiceCategory.METADATA_SERVICES:
      return ResourceEntity.METADATA_SERVICE;

    case 'storageServices':
    case ServiceCategory.STORAGE_SERVICES:
      return ResourceEntity.STORAGE_SERVICE;

    case 'searchIndex':
    case ServiceCategory.SEARCH_SERVICES:
      return ResourceEntity.SEARCH_SERVICE;

    case ServiceCategory.API_SERVICES:
      return ResourceEntity.API_SERVICE;

    case 'directories':
    case 'files':
    case 'spreadsheets':
    case 'worksheets':
    case ServiceCategory.DRIVE_SERVICES:
      return ResourceEntity.DRIVE_SERVICE;
  }

  return ResourceEntity.DATABASE_SERVICE;
};

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

export const getServiceCategoryFromEntityType = (
  entityType: EntityType
): string => {
  switch (entityType) {
    case EntityType.DASHBOARD_SERVICE:
      return ServiceCategory.DASHBOARD_SERVICES;
    case EntityType.MESSAGING_SERVICE:
      return ServiceCategory.MESSAGING_SERVICES;
    case EntityType.PIPELINE_SERVICE:
      return ServiceCategory.PIPELINE_SERVICES;
    case EntityType.MLMODEL_SERVICE:
      return ServiceCategory.ML_MODEL_SERVICES;
    case EntityType.STORAGE_SERVICE:
      return ServiceCategory.STORAGE_SERVICES;
    case EntityType.METADATA_SERVICE:
      return ServiceCategory.METADATA_SERVICES;
    case EntityType.SEARCH_SERVICE:
      return ServiceCategory.SEARCH_SERVICES;
    case EntityType.API_SERVICE:
      return ServiceCategory.API_SERVICES;
    case EntityType.DRIVE_SERVICE:
      return ServiceCategory.DRIVE_SERVICES;
    case EntityType.SECURITY_SERVICE:
      return ServiceCategory.SECURITY_SERVICES;
    case EntityType.DATABASE_SERVICE:
    default:
      return ServiceCategory.DATABASE_SERVICES;
  }
};

export const getEntityTypeFromServiceCategory = (
  serviceCategory: ServiceTypes
) => {
  switch (serviceCategory) {
    case ServiceCategory.DASHBOARD_SERVICES:
      return EntityType.DASHBOARD_SERVICE;
    case ServiceCategory.MESSAGING_SERVICES:
      return EntityType.MESSAGING_SERVICE;
    case ServiceCategory.PIPELINE_SERVICES:
      return EntityType.PIPELINE_SERVICE;
    case ServiceCategory.ML_MODEL_SERVICES:
      return EntityType.MLMODEL_SERVICE;
    case ServiceCategory.METADATA_SERVICES:
      return EntityType.METADATA_SERVICE;
    case ServiceCategory.STORAGE_SERVICES:
      return EntityType.STORAGE_SERVICE;
    case ServiceCategory.SEARCH_SERVICES:
      return EntityType.SEARCH_SERVICE;
    case ServiceCategory.API_SERVICES:
      return EntityType.API_SERVICE;
    case ServiceCategory.DRIVE_SERVICES:
      return EntityType.DRIVE_SERVICE;
    case ServiceCategory.SECURITY_SERVICES:
      return EntityType.SECURITY_SERVICE;
    case ServiceCategory.DATABASE_SERVICES:
    default:
      return EntityType.DATABASE_SERVICE;
  }
};

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
