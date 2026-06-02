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
import { DataAssetsWithoutServiceField } from '../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { SearchedDataProps } from '../components/SearchedData/SearchedData.interface';
import { EntityType } from '../enums/entity.enum';
import { ServiceCategory, ServiceCategoryPlural } from '../enums/service.enum';
import { Kpi } from '../generated/dataInsight/kpi/kpi';
import { APICollection } from '../generated/entity/data/apiCollection';
import { APIEndpoint } from '../generated/entity/data/apiEndpoint';
import { Chart } from '../generated/entity/data/chart';
import { Container } from '../generated/entity/data/container';
import { DashboardDataModel } from '../generated/entity/data/dashboardDataModel';
import { Database } from '../generated/entity/data/database';
import { DatabaseSchema } from '../generated/entity/data/databaseSchema';
import { Directory } from '../generated/entity/data/directory';
import { File } from '../generated/entity/data/file';
import { GlossaryTerm } from '../generated/entity/data/glossaryTerm';
import { SearchIndex as SearchIndexAsset } from '../generated/entity/data/searchIndex';
import { Spreadsheet } from '../generated/entity/data/spreadsheet';
import { StoredProcedure } from '../generated/entity/data/storedProcedure';
import { Table } from '../generated/entity/data/table';
import { Topic } from '../generated/entity/data/topic';
import { Worksheet } from '../generated/entity/data/worksheet';
import { DataProduct } from '../generated/entity/domains/dataProduct';
import { Team } from '../generated/entity/teams/team';
import { EventSubscription } from '../generated/events/eventSubscription';
import { TestCase, TestSuite } from '../generated/tests/testCase';
import {
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
      return getBreadcrumbForClassification(getEntityName(entity as any));
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
        getEntityName(entity as any),
        entity.fullyQualifiedName ?? ''
      );
    case EntityType.PERSONA:
      return getBreadcrumbForPersona(
        getEntityName(entity as any),
        entity.fullyQualifiedName ?? ''
      );
    case EntityType.ROLE:
      return getBreadcrumbForRole(
        getEntityName(entity as any),
        entity.fullyQualifiedName ?? ''
      );
    case EntityType.POLICY:
      return getBreadcrumbForPolicy(
        getEntityName(entity as any),
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
        getEntityName(entity as any),
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
