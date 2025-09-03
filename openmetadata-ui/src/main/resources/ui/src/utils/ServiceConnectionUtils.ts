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
import { MetadataServiceType } from '../generated/entity/services/metadataService';
import { Type as SecurityServiceType } from '../generated/entity/services/securityService';
import { ConfigData, ServicesType } from '../interface/service.interface';
import serviceUtilClassBase from './ServiceUtilClassBase';

export const getConnectionSchemas = ({
  data,
  serviceCategory,
  serviceType,
}: {
  data?: ServicesType;
  serviceType: string;
  serviceCategory: ServiceCategory;
}) => {
  const config = isNil(data)
    ? ({} as ConfigData)
    : (data.connection?.config as ConfigData);

  let connSch = {
    schema: {} as Record<string, any>,
    uiSchema: {} as Record<string, any>,
  };

  const validConfig = cloneDeep(config || {});

  for (const [key, value] of Object.entries(validConfig)) {
    if (isNil(value)) {
      delete validConfig[key as keyof ConfigData];
    }
  }

  switch (serviceCategory) {
    case ServiceCategory.DATABASE_SERVICES: {
      connSch = serviceUtilClassBase.getDatabaseServiceConfig(
        serviceType as DatabaseServiceType
      );

      break;
    }
    case ServiceCategory.MESSAGING_SERVICES: {
      connSch = serviceUtilClassBase.getMessagingServiceConfig(
        serviceType as MessagingServiceType
      );

      break;
    }
    case ServiceCategory.DASHBOARD_SERVICES: {
      connSch = serviceUtilClassBase.getDashboardServiceConfig(
        serviceType as DashboardServiceType
      );

      break;
    }
    case ServiceCategory.PIPELINE_SERVICES: {
      connSch = serviceUtilClassBase.getPipelineServiceConfig(
        serviceType as PipelineServiceType
      );

      break;
    }
    case ServiceCategory.ML_MODEL_SERVICES: {
      connSch = serviceUtilClassBase.getMlModelServiceConfig(
        serviceType as MlModelServiceType
      );

      break;
    }
    case ServiceCategory.METADATA_SERVICES: {
      connSch = serviceUtilClassBase.getMetadataServiceConfig(
        serviceType as MetadataServiceType
      );

      break;
    }
    case ServiceCategory.STORAGE_SERVICES: {
      connSch = serviceUtilClassBase.getStorageServiceConfig(
        serviceType as StorageServiceType
      );

      break;
    }
    case ServiceCategory.SEARCH_SERVICES: {
      connSch = serviceUtilClassBase.getSearchServiceConfig(
        serviceType as SearchServiceType
      );

      break;
    }

    case ServiceCategory.API_SERVICES: {
      connSch = serviceUtilClassBase.getAPIServiceConfig(
        serviceType as APIServiceType
      );

      break;
    }

    case ServiceCategory.SECURITY_SERVICES: {
      connSch = serviceUtilClassBase.getSecurityServiceConfig(
        serviceType as SecurityServiceType
      );

      break;
    }
  }

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
  schema?: Record<string, any>,
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
  uiSchema: Record<string, any>
) => {
  // object with all the default filter fields hidden
  const uiSchemaWithAllDefaultFilterFieldsHidden = reduce(
    SERVICE_FILTER_PATTERN_FIELDS,
    (acc, field) => {
      acc[field] = {
        'ui:widget': 'hidden',
        'ui:hideError': true,
      };

      return acc;
    },
    {} as Record<string, any>
  );

  // object with all the default filter fields hidden nested under all the ServiceNestedConnectionFields
  const uiSchemaWithNestedDefaultFilterFieldsHidden = reduce(
    Object.values(ServiceNestedConnectionFields),
    (acc, field) => {
      acc[field] = {
        ...uiSchema[field],
        ...uiSchemaWithAllDefaultFilterFieldsHidden,
      };

      return acc;
    },
    {} as Record<string, any>
  );

  return {
    ...uiSchema,
    ...uiSchemaWithNestedDefaultFilterFieldsHidden,
  };
};
