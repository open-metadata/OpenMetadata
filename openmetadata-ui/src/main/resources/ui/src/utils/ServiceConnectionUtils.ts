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
import { cloneDeep, isNil, reduce } from 'lodash';
import { SERVICE_FILTER_PATTERN_FIELDS } from '../constants/ServiceConnection.constants';
import {
  ServiceCategory,
  ServiceNestedConnectionFields,
} from '../enums/service.enum';
import { ServiceConnectionFilterPatternFields } from '../enums/ServiceConnection.enum';
import { APIServiceType } from '../generated/entity/data/apiCollection';
import { StorageServiceType } from '../generated/entity/data/container';
import { DashboardServiceType } from '../generated/entity/data/dashboard';
import { DatabaseServiceType } from '../generated/entity/data/database';
import { MlModelServiceType } from '../generated/entity/data/mlmodel';
import { PipelineServiceType } from '../generated/entity/data/pipeline';
import { SearchServiceType } from '../generated/entity/data/searchIndex';
import { MessagingServiceType } from '../generated/entity/data/topic';
import { DriveServiceType } from '../generated/entity/services/driveService';
import { MetadataServiceType } from '../generated/entity/services/metadataService';
import { Type as SecurityServiceType } from '../generated/entity/services/securityService';
import { ConfigData, ServicesType } from '../interface/service.interface';
import serviceUtilClassBase from './ServiceUtilClassBase';

export type ConnectionSchemaResult = {
  connSch: {
    schema: Record<string, unknown>;
    uiSchema: Record<string, unknown>;
  };
  validConfig: ConfigData;
};

export const EMPTY_CONNECTION_SCHEMA: ConnectionSchemaResult['connSch'] = {
  schema: {},
  uiSchema: {},
};

export const buildValidConfig = (data?: ServicesType): ConfigData => {
  const config = isNil(data)
    ? ({} as ConfigData)
    : (data.connection?.config as ConfigData);
  const validConfig = cloneDeep(config || {});
  for (const [key, value] of Object.entries(validConfig)) {
    if (isNil(value)) {
      delete validConfig[key as keyof ConfigData];
    }
  }

  return validConfig;
};

export const loadConnectionSchema = async (
  serviceCategory: ServiceCategory,
  serviceType: string
): Promise<ConnectionSchemaResult['connSch']> => {
  switch (serviceCategory) {
    case ServiceCategory.DATABASE_SERVICES:
      return serviceUtilClassBase.getDatabaseServiceConfig(
        serviceType as DatabaseServiceType
      );
    case ServiceCategory.MESSAGING_SERVICES:
      return serviceUtilClassBase.getMessagingServiceConfig(
        serviceType as MessagingServiceType
      );
    case ServiceCategory.DASHBOARD_SERVICES:
      return serviceUtilClassBase.getDashboardServiceConfig(
        serviceType as DashboardServiceType
      );
    case ServiceCategory.PIPELINE_SERVICES:
      return serviceUtilClassBase.getPipelineServiceConfig(
        serviceType as PipelineServiceType
      );
    case ServiceCategory.ML_MODEL_SERVICES:
      return serviceUtilClassBase.getMlModelServiceConfig(
        serviceType as MlModelServiceType
      );
    case ServiceCategory.METADATA_SERVICES:
      return serviceUtilClassBase.getMetadataServiceConfig(
        serviceType as MetadataServiceType
      );
    case ServiceCategory.STORAGE_SERVICES:
      return serviceUtilClassBase.getStorageServiceConfig(
        serviceType as StorageServiceType
      );
    case ServiceCategory.SEARCH_SERVICES:
      return serviceUtilClassBase.getSearchServiceConfig(
        serviceType as SearchServiceType
      );
    case ServiceCategory.API_SERVICES:
      return serviceUtilClassBase.getAPIServiceConfig(
        serviceType as APIServiceType
      );
    case ServiceCategory.SECURITY_SERVICES:
      return serviceUtilClassBase.getSecurityServiceConfig(
        serviceType as SecurityServiceType
      );
    case ServiceCategory.DRIVE_SERVICES:
      return serviceUtilClassBase.getDriveServiceConfig(
        serviceType as DriveServiceType
      );
    default:
      return EMPTY_CONNECTION_SCHEMA;
  }
};

export const getConnectionSchemas = async ({
  data,
  serviceCategory,
  serviceType,
}: {
  data?: ServicesType;
  serviceType: string;
  serviceCategory: ServiceCategory;
}): Promise<ConnectionSchemaResult> => {
  const validConfig = buildValidConfig(data);
  const connSch = await loadConnectionSchema(serviceCategory, serviceType);

  return { connSch, validConfig };
};

/**
 * Filters the schema to remove default filters
 * @param schema - The schema to filter
 * @param removeDefaultFilters - Whether to remove default filter fields,
 * if true, it will remove the fields that are in the SERVICE_FILTER_PATTERN_FIELDS
 * if false, it will keep only fields that are in the SERVICE_FILTER_PATTERN_FIELDS
 * @returns The filtered schema
 */
export const getFilteredSchema = (
  schema?: Record<string, unknown>,
  removeDefaultFilters = true
) =>
  Object.fromEntries(
    Object.entries(schema ?? {}).filter(([key]) => {
      const isFiltersField = SERVICE_FILTER_PATTERN_FIELDS.includes(
        key as ServiceConnectionFilterPatternFields
      );

      return removeDefaultFilters ? !isFiltersField : isFiltersField;
    })
  );

/**
 * Hides all the default filter fields in the UI Schema nested under all the ServiceNestedConnectionFields
 * @param uiSchema - The UI Schema to hide the default filter fields
 * @returns The UI Schema with all the default filter fields hidden
 */
export const getUISchemaWithNestedDefaultFilterFieldsHidden = (
  uiSchema: Record<string, unknown>
) => {
  const uiSchemaWithAllDefaultFilterFieldsHidden = reduce(
    SERVICE_FILTER_PATTERN_FIELDS,
    (acc, field) => {
      acc[field] = {
        'ui:widget': 'hidden',
        'ui:hideError': true,
      };

      return acc;
    },
    {} as Record<string, unknown>
  );

  const uiSchemaWithNestedDefaultFilterFieldsHidden = reduce(
    Object.values(ServiceNestedConnectionFields),
    (acc, field) => {
      acc[field] = {
        ...(uiSchema[field] as Record<string, unknown> | undefined),
        ...uiSchemaWithAllDefaultFilterFieldsHidden,
      };

      return acc;
    },
    {} as Record<string, unknown>
  );

  return {
    ...uiSchema,
    ...uiSchemaWithNestedDefaultFilterFieldsHidden,
  };
};
