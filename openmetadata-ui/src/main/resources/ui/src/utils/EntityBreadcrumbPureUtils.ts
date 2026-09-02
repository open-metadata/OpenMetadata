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
import type { To } from 'react-router-dom';
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

type BreadcrumbLink = {
  name: string;
  url: To;
  iconType?: EntityType | string;
  isServiceBreadcrumb?: boolean;
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
): BreadcrumbLink[] => {
  const getSimpleName = () =>
    getEntityName(entity as { name?: string; displayName?: string });

  const serviceCategoryBreadcrumbBuilders: Partial<
    Record<EntityType, () => BreadcrumbLink[]>
  > = {
    [EntityType.DASHBOARD_SERVICE]: () =>
      getServiceCategoryBreadcrumb(ServiceCategory.DASHBOARD_SERVICES),
    [EntityType.MESSAGING_SERVICE]: () =>
      getServiceCategoryBreadcrumb(ServiceCategory.MESSAGING_SERVICES),
    [EntityType.PIPELINE_SERVICE]: () =>
      getServiceCategoryBreadcrumb(ServiceCategory.PIPELINE_SERVICES),
    [EntityType.MLMODEL_SERVICE]: () =>
      getServiceCategoryBreadcrumb(ServiceCategory.ML_MODEL_SERVICES),
    [EntityType.METADATA_SERVICE]: () =>
      getServiceCategoryBreadcrumb(ServiceCategory.METADATA_SERVICES),
    [EntityType.STORAGE_SERVICE]: () =>
      getServiceCategoryBreadcrumb(ServiceCategory.STORAGE_SERVICES),
    [EntityType.SEARCH_SERVICE]: () =>
      getServiceCategoryBreadcrumb(ServiceCategory.SEARCH_SERVICES),
    [EntityType.API_SERVICE]: () =>
      getServiceCategoryBreadcrumb(ServiceCategory.API_SERVICES),
    [EntityType.SECURITY_SERVICE]: () =>
      getServiceCategoryBreadcrumb(ServiceCategory.SECURITY_SERVICES),
    [EntityType.DRIVE_SERVICE]: () =>
      getServiceCategoryBreadcrumb(ServiceCategory.DRIVE_SERVICES),
  };

  const getBreadcrumbForTagEntity = (): BreadcrumbLink[] => {
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
  };

  const getBreadcrumbForTableColumn = (): BreadcrumbLink[] => {
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
              isServiceBreadcrumb: true,
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
              iconType: EntityType.DATABASE,
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
              iconType: EntityType.DATABASE_SCHEMA,
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
              iconType: EntityType.TABLE,
            },
          ]
        : []),
      ...(includeCurrent
        ? [
            {
              name: entity.name,
              url: '',
              iconType: EntityType.TABLE_COLUMN,
            },
          ]
        : []),
    ];
  };

  const breadcrumbBuilders: Partial<
    Record<EntityType, () => BreadcrumbLink[]>
  > = {
    ...serviceCategoryBreadcrumbBuilders,
    [EntityType.CHART]: () => getBreadcrumbForChart(entity as Chart),
    [EntityType.TABLE]: () =>
      getBreadcrumbForTable(entity as Table, includeCurrent),
    [EntityType.STORED_PROCEDURE]: () =>
      getBreadcrumbForTable(entity as Table, includeCurrent),
    [EntityType.GLOSSARY]: () =>
      getBreadcrumbForGlossaryOrTerm(entity as GlossaryTerm),
    [EntityType.GLOSSARY_TERM]: () =>
      getBreadcrumbForGlossaryOrTerm(entity as GlossaryTerm),
    [EntityType.TAG]: getBreadcrumbForTagEntity,
    [EntityType.CLASSIFICATION]: () =>
      getBreadcrumbForClassification(getSimpleName()),
    [EntityType.DATABASE]: () =>
      getBreadcrumbForDatabase(entity as Database, includeCurrent),
    [EntityType.DATABASE_SCHEMA]: () =>
      getBreadcrumbForDatabaseSchema(entity as DatabaseSchema, includeCurrent),
    [EntityType.DATABASE_SERVICE]: () =>
      getBreadcrumbForDatabaseService(entity.name, entity.name, includeCurrent),
    [EntityType.CONTAINER]: () => {
      const data = entity as Container;

      return getBreadcrumbForEntityWithParent({
        entity: data,
        entityType: EntityType.CONTAINER,
        includeCurrent: true,
        parents: isUndefined(data.parent) ? [] : [data.parent],
      });
    },
    [EntityType.DIRECTORY]: () => {
      const data = entity as Directory;

      return getBreadcrumbForEntityWithParent({
        entity: data,
        entityType: EntityType.DIRECTORY,
        includeCurrent,
        parents: isUndefined(data.parent) ? [] : [data.parent],
      });
    },
    [EntityType.FILE]: () => {
      const data = entity as File;

      return getBreadcrumbForEntityWithParent({
        entity: data,
        entityType: EntityType.DIRECTORY,
        includeCurrent,
        parents: isUndefined(data.directory) ? [] : [data.directory],
      });
    },
    [EntityType.SPREADSHEET]: () => {
      const data = entity as Spreadsheet;

      return getBreadcrumbForEntityWithParent({
        entity: data,
        entityType: EntityType.DIRECTORY,
        includeCurrent,
        parents: isUndefined(data.directory) ? [] : [data.directory],
      });
    },
    [EntityType.WORKSHEET]: () => {
      const data = entity as Worksheet;

      return getBreadcrumbForEntityWithParent({
        entity: data,
        entityType: EntityType.SPREADSHEET,
        includeCurrent,
        parents: isUndefined(data.spreadsheet) ? [] : [data.spreadsheet],
      });
    },
    [EntityType.DOMAIN]: () => getBreadcrumbForDomain(),
    [EntityType.DATA_PRODUCT]: () =>
      getBreadcrumbForDataProduct(entity as DataProduct),
    [EntityType.TEST_CASE]: () => getBreadcrumbForTestCase(entity as TestCase),
    [EntityType.EVENT_SUBSCRIPTION]: () =>
      getBreadcrumbForEventSubscription(
        entity as EventSubscription,
        entity.fullyQualifiedName ?? '',
        entity as SearchSourceAlias
      ),
    [EntityType.TEST_SUITE]: () =>
      getBreadcrumbForTestSuite(entity as TestSuite),
    [EntityType.BOT]: () =>
      getBreadcrumbForBot(entity.name, entity.fullyQualifiedName ?? ''),
    [EntityType.TEAM]: () => getBreadcrumbForTeam(entity as Team),
    [EntityType.APPLICATION]: () =>
      getBreadcrumbForApplication(
        getSimpleName(),
        entity.fullyQualifiedName ?? ''
      ),
    [EntityType.PERSONA]: () =>
      getBreadcrumbForPersona(getSimpleName(), entity.fullyQualifiedName ?? ''),
    [EntityType.ROLE]: () =>
      getBreadcrumbForRole(getSimpleName(), entity.fullyQualifiedName ?? ''),
    [EntityType.POLICY]: () =>
      getBreadcrumbForPolicy(getSimpleName(), entity.fullyQualifiedName ?? ''),
    [EntityType.API_COLLECTION]: () =>
      getBreadCrumbForAPICollection(entity as APICollection),
    [EntityType.API_ENDPOINT]: () =>
      getBreadCrumbForAPIEndpoint(entity as APIEndpoint),
    [EntityType.METRIC]: () =>
      getBreadcrumbForMetric(entity.name, includeCurrent),
    [EntityType.KPI]: () => getBreadCrumbForKpi(entity as Kpi),
    [EntityType.KNOWLEDGE_PAGE]: () =>
      getBreadcrumbForKnowledgePage(getSimpleName(), includeCurrent),
    [EntityType.TABLE_COLUMN]: getBreadcrumbForTableColumn,
  };

  const builder = entityType ? breadcrumbBuilders[entityType] : undefined;

  return (
    builder ??
    (() =>
      getBreadcrumbForEntitiesWithServiceOnly(entity as Topic, includeCurrent))
  )();
};
