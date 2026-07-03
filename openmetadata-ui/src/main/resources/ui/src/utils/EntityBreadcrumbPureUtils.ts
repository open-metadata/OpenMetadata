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

import { isUndefined } from 'lodash';
import type { DataAssetsWithoutServiceField } from '../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import type { SearchedDataProps } from '../components/SearchedData/SearchedData.interface';
import { EntityType } from '../enums/entity.enum';
import { ServiceCategory, ServiceCategoryPlural } from '../enums/service.enum';
import type { Kpi } from '../generated/dataInsight/kpi/kpi';
import type { APICollection } from '../generated/entity/data/apiCollection';
import type { APIEndpoint } from '../generated/entity/data/apiEndpoint';
import type { Chart } from '../generated/entity/data/chart';
import type { Container } from '../generated/entity/data/container';
import type { DashboardDataModel } from '../generated/entity/data/dashboardDataModel';
import type { Database } from '../generated/entity/data/database';
import type { DatabaseSchema } from '../generated/entity/data/databaseSchema';
import type { Directory } from '../generated/entity/data/directory';
import type { File } from '../generated/entity/data/file';
import type { GlossaryTerm } from '../generated/entity/data/glossaryTerm';
import type { SearchIndex as SearchIndexAsset } from '../generated/entity/data/searchIndex';
import type { Spreadsheet } from '../generated/entity/data/spreadsheet';
import type { StoredProcedure } from '../generated/entity/data/storedProcedure';
import type { Table } from '../generated/entity/data/table';
import type { Topic } from '../generated/entity/data/topic';
import type { Worksheet } from '../generated/entity/data/worksheet';
import type { DataProduct } from '../generated/entity/domains/dataProduct';
import type { Team } from '../generated/entity/teams/team';
import type { EventSubscription } from '../generated/events/eventSubscription';
import type { TestCase, TestSuite } from '../generated/tests/testCase';
import type {
  SearchSourceAlias,
  TableColumnSearchSource,
} from '../interface/search.interface';
import {
  getBreadCrumbForAPICollection,
  getBreadCrumbForAPIEndpoint,
  getBreadcrumbForChart,
  getBreadcrumbForEntitiesWithServiceOnly,
  getBreadcrumbForEntityWithParent,
  getBreadcrumbForTable,
} from './EntityDataBreadcrumbUtils';
import {
  getBreadcrumbForApplication,
  getBreadcrumbForBot,
  getBreadcrumbForClassification,
  getBreadcrumbForDataProduct,
  getBreadcrumbForDomain,
  getBreadcrumbForEventSubscription,
  getBreadcrumbForGlossaryOrTerm,
  getBreadcrumbForKnowledgePage,
  getBreadCrumbForKpi,
  getBreadcrumbForMetric,
  getBreadcrumbForPersona,
  getBreadcrumbForPolicy,
  getBreadcrumbForRole,
  getBreadcrumbForTag,
  getBreadcrumbForTeam,
  getBreadcrumbForTestCase,
  getBreadcrumbForTestSuite,
} from './EntityGovernanceBreadcrumbUtils';
import { getEntityName } from './EntityNameUtils';
import {
  getBreadcrumbForDatabase,
  getBreadcrumbForDatabaseSchema,
  getBreadcrumbForDatabaseService,
  getServiceCategoryBreadcrumb,
} from './EntityServiceBreadcrumbUtils';
import { getEntityDetailsPath, getServiceDetailsPath } from './RouterUtils';
import { getEntityTypeFromServiceCategory } from './ServicePureUtils';

export const isServiceBreadcrumbHref = (href?: string) =>
  href ? /^\/service\/[^/]+\/[^/]+/.test(href) : false;

/** Normalises a breadcrumb url (string or pathname object) to a plain href string. */
export const getBreadcrumbHref = (
  url: string | { pathname?: string }
): string => (typeof url === 'string' ? url : url.pathname ?? '');

/**
 * Derives the entity type from a breadcrumb href for icon lookup.
 *
 * URL shapes produced by the breadcrumb utilities:
 *   /<entityType>/<fqn>            – getEntityDetailsPath; first segment = EntityType value
 *   /service/<category>/<name>     – getServiceDetailsPath; service instance crumb handled
 *                                    separately in getServiceBreadcrumbIcon, not here
 *   /settings/services/<category>  – category listing page; third segment = ServiceCategory value
 *
 * Special case: "/tags/<fqn>" uses "tags" as the route prefix but the enum value is
 * "classification", so we map it explicitly instead of relying on the segment check.
 */
export const getEntityTypeForIcon = (href: string): EntityType | undefined => {
  const segments = href.split('/').filter(Boolean);

  // /settings/services/<category> → resolve to the corresponding service EntityType
  if (segments[0] === 'settings' && segments[1] === 'services' && segments[2]) {
    return getEntityTypeFromServiceCategory(segments[2] as ServiceCategory);
  }

  // Route prefix "tags" does not match EntityType.CLASSIFICATION ("classification")
  if (segments[0] === 'tags') {
    return EntityType.CLASSIFICATION;
  }

  // For all other paths the first segment equals the EntityType enum value directly
  const segment = segments[0] as EntityType;

  return Object.values(EntityType).includes(segment) ? segment : undefined;
};

export const getEntityBreadcrumbs = (
  entity:
    | SearchedDataProps['data'][number]['_source']
    | DashboardDataModel
    | StoredProcedure
    | Database
    | DatabaseSchema
    | SearchIndexAsset
    | DataAssetsWithoutServiceField
    | APICollection
    | APIEndpoint,
  entityType?: EntityType,
  includeCurrent = false
) => {
  switch (entityType) {
    case EntityType.CHART:
      return getBreadcrumbForChart(entity as Chart);
    case EntityType.TABLE:
    case EntityType.STORED_PROCEDURE:
      return getBreadcrumbForTable(entity as Table, includeCurrent);
    case EntityType.GLOSSARY:
    case EntityType.GLOSSARY_TERM:
      return getBreadcrumbForGlossaryOrTerm(entity as GlossaryTerm);
    case EntityType.TAG: {
      const tag = entity as unknown as {
        classification?: {
          fullyQualifiedName?: string;
          displayName?: string;
          name?: string;
        };
        name: string;
        fullyQualifiedName?: string;
      };

      return getBreadcrumbForTag(
        getEntityName(tag.classification),
        tag.classification?.fullyQualifiedName ?? '',
        tag.name,
        tag.fullyQualifiedName ?? ''
      );
    }
    case EntityType.CLASSIFICATION:
      return getBreadcrumbForClassification(
        getEntityName(entity as { name?: string; displayName?: string })
      );
    case EntityType.DATABASE:
      return getBreadcrumbForDatabase(entity as Database);
    case EntityType.DATABASE_SCHEMA:
      return getBreadcrumbForDatabaseSchema(entity as DatabaseSchema);
    case EntityType.DATABASE_SERVICE:
      return getBreadcrumbForDatabaseService(
        entity.name,
        entity.name,
        includeCurrent
      );
    case EntityType.DASHBOARD_SERVICE:
      return getServiceCategoryBreadcrumb(ServiceCategory.DASHBOARD_SERVICES);
    case EntityType.MESSAGING_SERVICE:
      return getServiceCategoryBreadcrumb(ServiceCategory.MESSAGING_SERVICES);
    case EntityType.PIPELINE_SERVICE:
      return getServiceCategoryBreadcrumb(ServiceCategory.PIPELINE_SERVICES);
    case EntityType.MLMODEL_SERVICE:
      return getServiceCategoryBreadcrumb(ServiceCategory.ML_MODEL_SERVICES);
    case EntityType.METADATA_SERVICE:
      return getServiceCategoryBreadcrumb(ServiceCategory.METADATA_SERVICES);
    case EntityType.STORAGE_SERVICE:
      return getServiceCategoryBreadcrumb(ServiceCategory.STORAGE_SERVICES);
    case EntityType.SEARCH_SERVICE:
      return getServiceCategoryBreadcrumb(ServiceCategory.SEARCH_SERVICES);
    case EntityType.API_SERVICE:
      return getServiceCategoryBreadcrumb(ServiceCategory.API_SERVICES);
    case EntityType.SECURITY_SERVICE:
      return getServiceCategoryBreadcrumb(ServiceCategory.SECURITY_SERVICES);
    case EntityType.DRIVE_SERVICE:
      return getServiceCategoryBreadcrumb(ServiceCategory.DRIVE_SERVICES);
    case EntityType.CONTAINER: {
      const data = entity as Container;

      return getBreadcrumbForEntityWithParent({
        entity: data,
        entityType: EntityType.CONTAINER,
        includeCurrent: true,
        parents: isUndefined(data.parent) ? [] : [data.parent],
      });
    }
    case EntityType.DIRECTORY: {
      const data = entity as Directory;

      return getBreadcrumbForEntityWithParent({
        entity: data,
        entityType: EntityType.DIRECTORY,
        includeCurrent,
        parents: isUndefined(data.parent) ? [] : [data.parent],
      });
    }
    case EntityType.FILE: {
      const data = entity as File;

      return getBreadcrumbForEntityWithParent({
        entity: data,
        entityType: EntityType.DIRECTORY,
        includeCurrent,
        parents: isUndefined(data.directory) ? [] : [data.directory],
      });
    }
    case EntityType.SPREADSHEET: {
      const data = entity as Spreadsheet;

      return getBreadcrumbForEntityWithParent({
        entity: data,
        entityType: EntityType.DIRECTORY,
        includeCurrent,
        parents: isUndefined(data.directory) ? [] : [data.directory],
      });
    }
    case EntityType.WORKSHEET: {
      const data = entity as Worksheet;

      return getBreadcrumbForEntityWithParent({
        entity: data,
        entityType: EntityType.SPREADSHEET,
        includeCurrent,
        parents: isUndefined(data.spreadsheet) ? [] : [data.spreadsheet],
      });
    }
    case EntityType.DOMAIN:
      return getBreadcrumbForDomain();
    case EntityType.DATA_PRODUCT:
      return getBreadcrumbForDataProduct(entity as DataProduct);
    case EntityType.TEST_CASE:
      return getBreadcrumbForTestCase(entity as TestCase);
    case EntityType.EVENT_SUBSCRIPTION:
      return getBreadcrumbForEventSubscription(
        entity as EventSubscription,
        entity.fullyQualifiedName ?? '',
        entity as SearchSourceAlias
      );
    case EntityType.TEST_SUITE:
      return getBreadcrumbForTestSuite(entity as TestSuite);
    case EntityType.BOT:
      return getBreadcrumbForBot(entity.name, entity.fullyQualifiedName ?? '');
    case EntityType.TEAM:
      return getBreadcrumbForTeam(entity as Team);
    case EntityType.APPLICATION:
      return getBreadcrumbForApplication(
        getEntityName(entity as { name?: string; displayName?: string }),
        entity.fullyQualifiedName ?? ''
      );
    case EntityType.PERSONA:
      return getBreadcrumbForPersona(
        getEntityName(entity as { name?: string; displayName?: string }),
        entity.fullyQualifiedName ?? ''
      );
    case EntityType.ROLE:
      return getBreadcrumbForRole(
        getEntityName(entity as { name?: string; displayName?: string }),
        entity.fullyQualifiedName ?? ''
      );
    case EntityType.POLICY:
      return getBreadcrumbForPolicy(
        getEntityName(entity as { name?: string; displayName?: string }),
        entity.fullyQualifiedName ?? ''
      );
    case EntityType.API_COLLECTION:
      return getBreadCrumbForAPICollection(entity as APICollection);
    case EntityType.API_ENDPOINT:
      return getBreadCrumbForAPIEndpoint(entity as APIEndpoint);
    case EntityType.METRIC:
      return getBreadcrumbForMetric(entity.name);
    case EntityType.KPI:
      return getBreadCrumbForKpi(entity as Kpi);
    case EntityType.KNOWLEDGE_PAGE:
      return getBreadcrumbForKnowledgePage(
        getEntityName(entity as { name?: string; displayName?: string }),
        includeCurrent
      );
    case EntityType.TABLE_COLUMN: {
      const columnData = entity as TableColumnSearchSource;

      return [
        ...(columnData.service
          ? [
              {
                name: getEntityName(columnData.service),
                url: columnData.service?.name
                  ? getServiceDetailsPath(
                      columnData.service?.name,
                      ServiceCategoryPlural[
                        columnData.service
                          ?.type as keyof typeof ServiceCategoryPlural
                      ]
                    )
                  : '',
              },
            ]
          : []),
        ...(columnData.database
          ? [
              {
                name: getEntityName(columnData.database),
                url: getEntityDetailsPath(
                  EntityType.DATABASE,
                  columnData.database?.fullyQualifiedName ?? ''
                ),
              },
            ]
          : []),
        ...(columnData.databaseSchema
          ? [
              {
                name: getEntityName(columnData.databaseSchema),
                url: getEntityDetailsPath(
                  EntityType.DATABASE_SCHEMA,
                  columnData.databaseSchema?.fullyQualifiedName ?? ''
                ),
              },
            ]
          : []),
        ...(columnData.table
          ? [
              {
                name: getEntityName(columnData.table),
                url: getEntityDetailsPath(
                  EntityType.TABLE,
                  columnData.table?.fullyQualifiedName ?? ''
                ),
              },
            ]
          : []),
        ...(includeCurrent
          ? [
              {
                name: entity.name,
                url: '',
              },
            ]
          : []),
      ];
    }
    case EntityType.TOPIC:
    case EntityType.DASHBOARD:
    case EntityType.PIPELINE:
    case EntityType.MLMODEL:
    case EntityType.DASHBOARD_DATA_MODEL:
    case EntityType.SEARCH_INDEX:
    default:
      return getBreadcrumbForEntitiesWithServiceOnly(
        entity as Topic,
        includeCurrent
      );
  }
};
