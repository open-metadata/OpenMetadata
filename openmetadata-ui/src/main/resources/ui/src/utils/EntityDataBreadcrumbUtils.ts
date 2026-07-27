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
import type { EntityWithServices } from '../components/Explore/ExplorePage.interface';
import type { SourceType } from '../components/SearchedData/SearchedData.interface';
import { GlobalSettingsMenuCategory } from '../constants/GlobalSettings.constants';
import { EntityType } from '../enums/entity.enum';
import { ServiceCategory, ServiceCategoryPlural } from '../enums/service.enum';
import type { APICollection } from '../generated/entity/data/apiCollection';
import type { APIEndpoint } from '../generated/entity/data/apiEndpoint';
import type { Chart } from '../generated/entity/data/chart';
import type { Container } from '../generated/entity/data/container';
import type { Directory } from '../generated/entity/data/directory';
import type { File } from '../generated/entity/data/file';
import type { Table } from '../generated/entity/data/table';
import type { EntityReference } from '../generated/type/entityUsage';
import { getEntityLinkFromType } from './EntityLinkUtils';
import { getEntityName } from './EntityNameUtils';
import {
  getEntityDetailsPath,
  getServiceDetailsPath,
  getSettingPath,
} from './RouterUtils';
import { getServiceRouteFromServiceType } from './ServicePureUtils';

export const getBreadcrumbForTable = (
  entity: Table,
  includeCurrent = false
) => {
  const { service, database, databaseSchema } = entity;

  return [
    {
      name: getEntityName(service),
      url: service?.name
        ? getServiceDetailsPath(
            service?.name,
            ServiceCategory.DATABASE_SERVICES
          )
        : '',
      isServiceBreadcrumb: true,
    },
    {
      name: getEntityName(database),
      url: getEntityDetailsPath(
        EntityType.DATABASE,
        database?.fullyQualifiedName ?? ''
      ),
      iconType: EntityType.DATABASE,
    },
    {
      name: getEntityName(databaseSchema),
      url: getEntityDetailsPath(
        EntityType.DATABASE_SCHEMA,
        databaseSchema?.fullyQualifiedName ?? ''
      ),
      iconType: EntityType.DATABASE_SCHEMA,
    },
    ...(includeCurrent
      ? [
          {
            name: entity.name,
            url: getEntityLinkFromType(
              entity.fullyQualifiedName ?? '',
              ((entity as SourceType).entityType as EntityType) ??
                EntityType.TABLE
            ),
            iconType:
              ((entity as SourceType).entityType as EntityType) ??
              EntityType.TABLE,
          },
        ]
      : []),
  ];
};

export const getBreadcrumbForChart = (entity: Chart) => {
  const { service } = entity;

  return [
    {
      name: getEntityName(service),
      url: getServiceDetailsPath(
        service?.name ?? '',
        ServiceCategoryPlural[
          service?.type as keyof typeof ServiceCategoryPlural
        ]
      ),
      isServiceBreadcrumb: true,
    },
  ];
};

export const getBreadCrumbForAPICollection = (entity: APICollection) => {
  const { service } = entity;

  return [
    {
      name: startCase(ServiceCategory.API_SERVICES),
      url: getSettingPath(
        GlobalSettingsMenuCategory.SERVICES,
        getServiceRouteFromServiceType(ServiceCategory.API_SERVICES)
      ),
      iconType: EntityType.API_SERVICE,
    },
    {
      name: getEntityName(service),
      url: service?.name
        ? getServiceDetailsPath(
            service?.name ?? '',
            ServiceCategoryPlural[
              service?.type as keyof typeof ServiceCategoryPlural
            ]
          )
        : '',
      isServiceBreadcrumb: true,
    },
  ];
};

export const getBreadCrumbForAPIEndpoint = (entity: APIEndpoint) => {
  const { service, apiCollection } = entity;

  return [
    {
      name: startCase(ServiceCategory.API_SERVICES),
      url: getSettingPath(
        GlobalSettingsMenuCategory.SERVICES,
        getServiceRouteFromServiceType(ServiceCategory.API_SERVICES)
      ),
      iconType: EntityType.API_SERVICE,
    },
    {
      name: getEntityName(service),
      url: service?.name
        ? getServiceDetailsPath(
            service?.name ?? '',
            ServiceCategoryPlural[
              service?.type as keyof typeof ServiceCategoryPlural
            ]
          )
        : '',
      isServiceBreadcrumb: true,
    },
    {
      name: getEntityName(apiCollection),
      url: getEntityDetailsPath(
        EntityType.API_COLLECTION,
        apiCollection?.fullyQualifiedName ?? ''
      ),
      iconType: EntityType.API_COLLECTION,
    },
  ];
};

export const getBreadcrumbForEntitiesWithServiceOnly = (
  entity: EntityWithServices,
  includeCurrent = false
) => {
  const { service } = entity;

  return [
    {
      name: getEntityName(service),
      url: service?.name
        ? getServiceDetailsPath(
            service?.name,
            ServiceCategoryPlural[
              service?.type as keyof typeof ServiceCategoryPlural
            ]
          )
        : '',
      isServiceBreadcrumb: true,
    },
    ...(includeCurrent
      ? [
          {
            name: entity.name,
            url: getEntityLinkFromType(
              entity.fullyQualifiedName ?? '',
              (entity as SourceType).entityType as EntityType
            ),
          },
        ]
      : []),
  ];
};

export function getBreadcrumbForEntityWithParent<
  T extends Container | Directory | File
>(data: {
  entity: T;
  entityType: EntityType;
  includeCurrent?: boolean;
  parents?: Container[] | EntityReference[];
}) {
  const { entity, entityType, includeCurrent = false, parents = [] } = data;
  const { service } = entity;

  return [
    {
      name: getEntityName(service),
      url: service?.name
        ? getServiceDetailsPath(
            service?.name,
            ServiceCategoryPlural[
              service?.type as keyof typeof ServiceCategoryPlural
            ]
          )
        : '',
      isServiceBreadcrumb: true,
    },
    ...(parents.length > 0
      ? parents.map((parent) => ({
          name: getEntityName(parent),
          url: getEntityLinkFromType(
            parent?.fullyQualifiedName ?? '',
            entityType
          ),
          iconType: entityType,
        }))
      : []),
    ...(includeCurrent
      ? [
          {
            name: entity.name,
            url: getEntityLinkFromType(
              entity.fullyQualifiedName ?? '',
              (entity as SourceType).entityType as EntityType
            ),
            iconType: (entity as SourceType).entityType as EntityType,
          },
        ]
      : []),
  ];
}
