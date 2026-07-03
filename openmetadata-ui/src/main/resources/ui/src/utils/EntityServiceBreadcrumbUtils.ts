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

import { startCase } from 'lodash';
import type { TitleLink } from '../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import type { SourceType } from '../components/SearchedData/SearchedData.interface';
import { GlobalSettingsMenuCategory } from '../constants/GlobalSettings.constants';
import { EntityType } from '../enums/entity.enum';
import { ServiceCategory, ServiceCategoryPlural } from '../enums/service.enum';
import type { Database } from '../generated/entity/data/database';
import type { DatabaseSchema } from '../generated/entity/data/databaseSchema';
import { getBreadcrumbForEntitiesWithServiceOnly } from './EntityDataBreadcrumbUtils';
import { getEntityLinkFromType } from './EntityLinkUtils';
import { getEntityName } from './EntityNameUtils';
import {
  getEntityDetailsPath,
  getServiceDetailsPath,
  getSettingPath,
} from './RouterUtils';
import {
  getEntityTypeFromServiceCategory,
  getServiceRouteFromServiceType,
} from './ServicePureUtils';

export const getServiceCategoryBreadcrumb = (
  serviceCategory: ServiceCategory
): TitleLink[] => [
  {
    name: startCase(serviceCategory),
    url: getSettingPath(
      GlobalSettingsMenuCategory.SERVICES,
      getServiceRouteFromServiceType(serviceCategory)
    ),
    iconType: getEntityTypeFromServiceCategory(serviceCategory),
  },
];

export const getBreadcrumbForDatabaseService = (
  entityName: string,
  fqn: string,
  includeCurrent: boolean
) => {
  const items = getServiceCategoryBreadcrumb(ServiceCategory.DATABASE_SERVICES);

  if (includeCurrent) {
    items.push({
      name: entityName,
      url: getServiceDetailsPath(fqn, ServiceCategory.DATABASE_SERVICES),
      isServiceBreadcrumb: true,
    });
  }

  return items;
};

export const getBreadcrumbForDatabase = (entity: Database) => [
  ...getServiceCategoryBreadcrumb(ServiceCategory.DATABASE_SERVICES),
  ...getBreadcrumbForEntitiesWithServiceOnly(entity),
  {
    name: entity.name,
    url: getEntityLinkFromType(
      entity.fullyQualifiedName ?? '',
      ((entity as SourceType).entityType as EntityType) ?? EntityType.DATABASE
    ),
    iconType:
      ((entity as SourceType).entityType as EntityType) ?? EntityType.DATABASE,
  },
];

export const getBreadcrumbForDatabaseSchema = (entity: DatabaseSchema) => [
  ...getServiceCategoryBreadcrumb(ServiceCategory.DATABASE_SERVICES),
  {
    name: getEntityName(entity.service),
    url: entity.service?.name
      ? getServiceDetailsPath(
          entity.service?.name ?? '',
          ServiceCategoryPlural[
            entity.service?.type as keyof typeof ServiceCategoryPlural
          ]
        )
      : '',
    isServiceBreadcrumb: true,
  },
  {
    name: getEntityName(entity.database),
    url: getEntityDetailsPath(
      EntityType.DATABASE,
      entity.database?.fullyQualifiedName ?? ''
    ),
    iconType: EntityType.DATABASE,
  },
  {
    name: entity.name,
    url: getEntityLinkFromType(
      entity.fullyQualifiedName ?? '',
      ((entity as unknown as SourceType).entityType as EntityType) ??
        EntityType.DATABASE_SCHEMA
    ),
    iconType:
      ((entity as unknown as SourceType).entityType as EntityType) ??
      EntityType.DATABASE_SCHEMA,
  },
];
