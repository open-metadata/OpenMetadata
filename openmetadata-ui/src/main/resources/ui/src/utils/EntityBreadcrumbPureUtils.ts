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

import { isUndefined, startCase } from 'lodash';
import type { TitleLink } from '../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import type { DataAssetsWithoutServiceField } from '../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import type { EntityWithServices } from '../components/Explore/ExplorePage.interface';
import type {
  SearchedDataProps,
  SourceType,
} from '../components/SearchedData/SearchedData.interface';
import { ROUTES } from '../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../constants/GlobalSettings.constants';
import { EntityTabs, EntityType } from '../enums/entity.enum';
import { ServiceCategory, ServiceCategoryPlural } from '../enums/service.enum';
import type { Kpi } from '../generated/dataInsight/kpi/kpi';
import type { Classification } from '../generated/entity/classification/classification';
import type { Tag } from '../generated/entity/classification/tag';
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
import {
  AlertType,
  type EventSubscription,
} from '../generated/events/eventSubscription';
import type { TestCase, TestSuite } from '../generated/tests/testCase';
import type { EntityReference } from '../generated/type/entityUsage';
import { DataInsightTabs } from '../interface/data-insight.interface';
import type {
  SearchSourceAlias,
  TableColumnSearchSource,
} from '../interface/search.interface';
import { DataQualityPageTabs } from '../pages/DataQuality/DataQualityPage.interface';
import { getDataInsightPathWithFqn } from './DataInsightUtils';
import { getEntityName } from './EntityNameUtils';
import Fqn from './Fqn';
import i18n from './i18next/LocalUtil';
import { getKnowledgePagePath } from './KnowledgePageUtils';
import {
  getApplicationDetailsPath,
  getBotsPagePath,
  getBotsPath,
  getClassificationTagPath,
  getDataProductDetailsPath,
  getDataQualityPagePath,
  getDomainDetailsPath,
  getDomainPath,
  getEntityDetailsPath,
  getGlossaryPath,
  getGlossaryTermDetailsPath,
  getKpiPath,
  getNotificationAlertDetailsPath,
  getObservabilityAlertDetailsPath,
  getPersonaDetailsPath,
  getPolicyWithFqnPath,
  getRoleWithFqnPath,
  getServiceDetailsPath,
  getSettingPath,
  getTagsDetailsPath,
  getTeamsWithFqnPath,
  getTestCaseDetailPagePath,
} from './RouterUtils';
import { getServiceRouteFromServiceType } from './ServiceUtils';

const { t } = i18n;

export const getEntityLinkFromType = (
  fullyQualifiedName: string,
  entityType: EntityType,
  entity?: SearchSourceAlias
) => {
  switch (entityType) {
    case EntityType.TABLE:
    case EntityType.TOPIC:
    case EntityType.DASHBOARD:
    case EntityType.CHART:
    case EntityType.PIPELINE:
    case EntityType.MLMODEL:
    case EntityType.CONTAINER:
    case EntityType.DATABASE:
    case EntityType.DATABASE_SCHEMA:
    case EntityType.DASHBOARD_DATA_MODEL:
    case EntityType.STORED_PROCEDURE:
    case EntityType.SEARCH_INDEX:
    case EntityType.API_COLLECTION:
    case EntityType.API_ENDPOINT:
    case EntityType.DIRECTORY:
    case EntityType.FILE:
    case EntityType.SPREADSHEET:
    case EntityType.WORKSHEET:
      return getEntityDetailsPath(entityType, fullyQualifiedName);
    case EntityType.METRIC:
      return getEntityDetailsPath(entityType, fullyQualifiedName);
    case EntityType.DATA_PRODUCT:
      return getDataProductDetailsPath(fullyQualifiedName);
    case EntityType.GLOSSARY:
    case EntityType.GLOSSARY_TERM:
      return getGlossaryTermDetailsPath(fullyQualifiedName);
    case EntityType.TAG:
      return getClassificationTagPath(fullyQualifiedName);
    case EntityType.CLASSIFICATION:
      return getTagsDetailsPath(fullyQualifiedName);

    case EntityType.DATABASE_SERVICE:
      return getServiceDetailsPath(
        fullyQualifiedName,
        ServiceCategory.DATABASE_SERVICES
      );
    case EntityType.MESSAGING_SERVICE:
      return getServiceDetailsPath(
        fullyQualifiedName,
        ServiceCategory.MESSAGING_SERVICES
      );
    case EntityType.DASHBOARD_SERVICE:
      return getServiceDetailsPath(
        fullyQualifiedName,
        ServiceCategory.DASHBOARD_SERVICES
      );
    case EntityType.PIPELINE_SERVICE:
      return getServiceDetailsPath(
        fullyQualifiedName,
        ServiceCategory.PIPELINE_SERVICES
      );
    case EntityType.MLMODEL_SERVICE:
      return getServiceDetailsPath(
        fullyQualifiedName,
        ServiceCategory.ML_MODEL_SERVICES
      );
    case EntityType.STORAGE_SERVICE:
      return getServiceDetailsPath(
        fullyQualifiedName,
        ServiceCategory.STORAGE_SERVICES
      );
    case EntityType.SEARCH_SERVICE:
      return getServiceDetailsPath(
        fullyQualifiedName,
        ServiceCategory.SEARCH_SERVICES
      );
    case EntityType.METADATA_SERVICE:
      return getServiceDetailsPath(
        fullyQualifiedName,
        ServiceCategory.METADATA_SERVICES
      );
    case EntityType.API_SERVICE:
      return getServiceDetailsPath(
        fullyQualifiedName,
        ServiceCategory.API_SERVICES
      );
    case EntityType.DRIVE_SERVICE:
      return getServiceDetailsPath(
        fullyQualifiedName,
        ServiceCategory.DRIVE_SERVICES
      );
    case EntityType.BOT:
      return getBotsPath(fullyQualifiedName);
    case EntityType.TEAM:
      return getTeamsWithFqnPath(fullyQualifiedName);
    case EntityType.APPLICATION:
      return getApplicationDetailsPath(fullyQualifiedName);
    case EntityType.TEST_CASE:
      return getTestCaseDetailPagePath(fullyQualifiedName);
    case EntityType.TEST_SUITE:
      return getEntityDetailsPath(
        EntityType.TABLE,
        fullyQualifiedName,
        EntityTabs.PROFILER
      );
    case EntityType.DOMAIN:
      return getDomainDetailsPath(fullyQualifiedName);
    case EntityType.EVENT_SUBSCRIPTION:
      return (entity as EventSubscription)?.alertType ===
        AlertType.Observability
        ? getObservabilityAlertDetailsPath(fullyQualifiedName)
        : getNotificationAlertDetailsPath(fullyQualifiedName);
    case EntityType.ROLE:
      return getRoleWithFqnPath(fullyQualifiedName);
    case EntityType.POLICY:
      return getPolicyWithFqnPath(fullyQualifiedName);
    case EntityType.PERSONA:
      return getPersonaDetailsPath(fullyQualifiedName);
    case EntityType.KPI:
      return getKpiPath(fullyQualifiedName);
    case EntityType.KNOWLEDGE_PAGE:
      return getKnowledgePagePath(fullyQualifiedName);
    default:
      return '';
  }
};

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
    },
    {
      name: getEntityName(database),
      url: getEntityDetailsPath(
        EntityType.DATABASE,
        database?.fullyQualifiedName ?? ''
      ),
    },
    {
      name: getEntityName(databaseSchema),
      url: getEntityDetailsPath(
        EntityType.DATABASE_SCHEMA,
        databaseSchema?.fullyQualifiedName ?? ''
      ),
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
    },
    {
      name: getEntityName(apiCollection),
      url: getEntityDetailsPath(
        EntityType.API_COLLECTION,
        apiCollection?.fullyQualifiedName ?? ''
      ),
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
    },
    ...(parents.length > 0
      ? parents.map((parent) => ({
          name: getEntityName(parent),
          url: getEntityLinkFromType(
            parent?.fullyQualifiedName ?? '',
            entityType
          ),
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
          },
        ]
      : []),
  ];
}

export const getBreadcrumbForTestCase = (entity: TestCase): TitleLink[] => [
  {
    name: i18n.t('label.data-quality'),
    url: `${ROUTES.DATA_QUALITY}/${DataQualityPageTabs.TEST_CASES}`,
  },
  {
    name: entity.name,
    url: getEntityLinkFromType(
      entity.fullyQualifiedName ?? '',
      (entity as SourceType)?.entityType as EntityType
    ),
    options: {
      state: {
        breadcrumbData: [
          {
            name: i18n.t('label.data-quality'),
            url: `${ROUTES.DATA_QUALITY}/${DataQualityPageTabs.TEST_CASES}`,
          },
        ],
      },
    },
  },
];

export const getBreadcrumbForTestSuite = (entity: TestSuite) => {
  return entity.basic
    ? [
        {
          name: getEntityName(entity.basicEntityReference),
          url: getEntityLinkFromType(
            entity.basicEntityReference?.fullyQualifiedName ?? '',
            EntityType.TABLE
          ),
        },
        {
          name: t('label.test-suite'),
          url: '',
        },
      ]
    : [
        {
          name: t('label.test-suite-plural'),
          url: getDataQualityPagePath(DataQualityPageTabs.TEST_SUITES),
        },
        {
          name: getEntityName(entity),
          url: '',
        },
      ];
};

export const getBreadCrumbForKpi = (entity: Kpi) => {
  return [
    {
      name: i18n.t('label.kpi-uppercase'),
      url: getDataInsightPathWithFqn(DataInsightTabs.KPIS),
    },
    {
      name: getEntityName(entity),
      url: getKpiPath(entity.name),
    },
  ];
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
      // eslint-disable-next-line no-case-declarations
      const glossary = (entity as GlossaryTerm).glossary;
      if (!glossary) {
        return [];
      }
      // eslint-disable-next-line no-case-declarations
      const fqnList = entity.fullyQualifiedName
        ? Fqn.split(entity.fullyQualifiedName)
        : [];
      // eslint-disable-next-line no-case-declarations
      const tree = fqnList.slice(1, fqnList.length);

      return [
        {
          name: glossary.fullyQualifiedName,
          url: getGlossaryPath(glossary.fullyQualifiedName),
        },
        ...tree.map((fqn, index, source) => ({
          name: fqn,
          url: getGlossaryPath(
            `${glossary.fullyQualifiedName}.${source
              .slice(0, index + 1)
              .join('.')}`
          ),
        })),
      ];
    case EntityType.TAG: {
      return [
        {
          name: getEntityName((entity as Tag).classification),
          url: getTagsDetailsPath(
            (entity as Tag).classification?.fullyQualifiedName ?? ''
          ),
        },
        {
          name: entity.name,
          url: getClassificationTagPath(entity.fullyQualifiedName ?? ''),
        },
      ];
    }

    case EntityType.CLASSIFICATION:
      return [
        {
          name: getEntityName(entity as Classification),
          url: '',
        },
      ];

    case EntityType.DATABASE:
      return [
        {
          name: startCase(ServiceCategory.DATABASE_SERVICES),
          url: getSettingPath(
            GlobalSettingsMenuCategory.SERVICES,
            getServiceRouteFromServiceType(ServiceCategory.DATABASE_SERVICES)
          ),
        },
        ...getBreadcrumbForEntitiesWithServiceOnly(entity as Database),
        {
          name: entity.name,
          url: getEntityLinkFromType(
            entity.fullyQualifiedName ?? '',
            ((entity as SourceType).entityType as EntityType) ??
              EntityType.DATABASE
          ),
        },
      ];

    case EntityType.DATABASE_SCHEMA:
      return [
        {
          name: startCase(ServiceCategory.DATABASE_SERVICES),
          url: getSettingPath(
            GlobalSettingsMenuCategory.SERVICES,
            getServiceRouteFromServiceType(ServiceCategory.DATABASE_SERVICES)
          ),
        },
        {
          name: getEntityName((entity as DatabaseSchema).service),
          url: (entity as DatabaseSchema).service?.name
            ? getServiceDetailsPath(
                (entity as DatabaseSchema).service?.name ?? '',
                ServiceCategoryPlural[
                  (entity as DatabaseSchema).service
                    ?.type as keyof typeof ServiceCategoryPlural
                ]
              )
            : '',
        },
        {
          name: getEntityName((entity as DatabaseSchema).database),
          url: getEntityDetailsPath(
            EntityType.DATABASE,
            (entity as DatabaseSchema).database?.fullyQualifiedName ?? ''
          ),
        },
        {
          name: entity.name,
          url: getEntityLinkFromType(
            entity.fullyQualifiedName ?? '',
            ((entity as SourceType).entityType as EntityType) ??
              EntityType.DATABASE_SCHEMA
          ),
        },
      ];

    case EntityType.DATABASE_SERVICE:
      return [
        {
          name: startCase(ServiceCategory.DATABASE_SERVICES),
          url: getSettingPath(
            GlobalSettingsMenuCategory.SERVICES,
            getServiceRouteFromServiceType(ServiceCategory.DATABASE_SERVICES)
          ),
        },
        ...(includeCurrent
          ? [
              {
                name: entity.name,
                url: getServiceDetailsPath(
                  entity?.name,
                  ServiceCategory.DATABASE_SERVICES
                ),
              },
            ]
          : []),
      ];

    case EntityType.DASHBOARD_SERVICE:
      return [
        {
          name: startCase(ServiceCategory.DASHBOARD_SERVICES),
          url: getSettingPath(
            GlobalSettingsMenuCategory.SERVICES,
            getServiceRouteFromServiceType(ServiceCategory.DASHBOARD_SERVICES)
          ),
        },
      ];

    case EntityType.MESSAGING_SERVICE:
      return [
        {
          name: startCase(ServiceCategory.MESSAGING_SERVICES),
          url: getSettingPath(
            GlobalSettingsMenuCategory.SERVICES,
            getServiceRouteFromServiceType(ServiceCategory.MESSAGING_SERVICES)
          ),
        },
      ];

    case EntityType.PIPELINE_SERVICE:
      return [
        {
          name: startCase(ServiceCategory.PIPELINE_SERVICES),
          url: getSettingPath(
            GlobalSettingsMenuCategory.SERVICES,
            getServiceRouteFromServiceType(ServiceCategory.PIPELINE_SERVICES)
          ),
        },
      ];

    case EntityType.MLMODEL_SERVICE:
      return [
        {
          name: startCase(ServiceCategory.ML_MODEL_SERVICES),
          url: getSettingPath(
            GlobalSettingsMenuCategory.SERVICES,
            getServiceRouteFromServiceType(ServiceCategory.ML_MODEL_SERVICES)
          ),
        },
      ];

    case EntityType.METADATA_SERVICE:
      return [
        {
          name: startCase(ServiceCategory.METADATA_SERVICES),
          url: getSettingPath(
            GlobalSettingsMenuCategory.SERVICES,
            getServiceRouteFromServiceType(ServiceCategory.METADATA_SERVICES)
          ),
        },
      ];

    case EntityType.STORAGE_SERVICE:
      return [
        {
          name: startCase(ServiceCategory.STORAGE_SERVICES),
          url: getSettingPath(
            GlobalSettingsMenuCategory.SERVICES,
            getServiceRouteFromServiceType(ServiceCategory.STORAGE_SERVICES)
          ),
        },
      ];

    case EntityType.SEARCH_SERVICE:
      return [
        {
          name: startCase(ServiceCategory.SEARCH_SERVICES),
          url: getSettingPath(
            GlobalSettingsMenuCategory.SERVICES,
            getServiceRouteFromServiceType(ServiceCategory.SEARCH_SERVICES)
          ),
        },
      ];
    case EntityType.API_SERVICE:
      return [
        {
          name: startCase(ServiceCategory.API_SERVICES),
          url: getSettingPath(
            GlobalSettingsMenuCategory.SERVICES,
            getServiceRouteFromServiceType(ServiceCategory.API_SERVICES)
          ),
        },
      ];

    case EntityType.SECURITY_SERVICE:
      return [
        {
          name: startCase(ServiceCategory.SECURITY_SERVICES),
          url: getSettingPath(
            GlobalSettingsMenuCategory.SERVICES,
            getServiceRouteFromServiceType(ServiceCategory.SECURITY_SERVICES)
          ),
        },
      ];

    case EntityType.DRIVE_SERVICE:
      return [
        {
          name: startCase(ServiceCategory.DRIVE_SERVICES),
          url: getSettingPath(
            GlobalSettingsMenuCategory.SERVICES,
            getServiceRouteFromServiceType(ServiceCategory.DRIVE_SERVICES)
          ),
        },
      ];

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
      return [
        {
          name: i18n.t('label.domain-plural'),
          url: getDomainPath(),
        },
      ];

    case EntityType.DATA_PRODUCT: {
      const data = entity as DataProduct;
      if (!data.domains?.length) {
        return [];
      }

      return [
        {
          name: getEntityName(data.domains[0]),
          url: getDomainPath(data.domains[0].fullyQualifiedName),
        },
      ];
    }

    case EntityType.TEST_CASE: {
      return getBreadcrumbForTestCase(entity as TestCase);
    }
    case EntityType.EVENT_SUBSCRIPTION: {
      return [
        {
          name: startCase(EntityType.ALERT),
          url:
            (entity as EventSubscription).alertType === AlertType.Observability
              ? ROUTES.OBSERVABILITY_ALERTS
              : ROUTES.NOTIFICATION_ALERT_LIST,
        },
        {
          name: entity.name,
          url: getEntityLinkFromType(
            entity.fullyQualifiedName ?? '',
            (entity as SourceType).entityType as EntityType,
            entity as SearchSourceAlias
          ),
        },
      ];
    }

    case EntityType.TEST_SUITE: {
      return getBreadcrumbForTestSuite(entity as TestSuite);
    }

    case EntityType.BOT: {
      return [
        {
          name: startCase(EntityType.BOT),
          url: getBotsPagePath(),
        },
        {
          name: entity.name,
          url: getBotsPath(entity.fullyQualifiedName ?? ''),
        },
      ];
    }

    case EntityType.TEAM: {
      return [
        {
          name: getEntityName((entity as Team).parents?.[0]),
          url: getTeamsWithFqnPath(
            (entity as Team).parents?.[0].fullyQualifiedName ?? ''
          ),
        },
        {
          name: getEntityName(entity),
          url: getTeamsWithFqnPath(entity.fullyQualifiedName ?? ''),
        },
      ];
    }

    case EntityType.APPLICATION: {
      return [
        {
          name: i18n.t('label.application-plural'),
          url: getSettingPath(GlobalSettingsMenuCategory.APPLICATIONS),
        },
        {
          name: getEntityName(entity),
          url: getApplicationDetailsPath(entity.fullyQualifiedName ?? ''),
        },
      ];
    }

    case EntityType.PERSONA: {
      return [
        {
          name: i18n.t('label.persona-plural'),
          url: getSettingPath(
            GlobalSettingsMenuCategory.MEMBERS,
            GlobalSettingOptions.PERSONA
          ),
        },
        {
          name: getEntityName(entity),
          url: getPersonaDetailsPath(entity.fullyQualifiedName ?? ''),
        },
      ];
    }

    case EntityType.ROLE: {
      return [
        {
          name: i18n.t('label.role-plural'),
          url: getSettingPath(
            GlobalSettingsMenuCategory.ACCESS,
            GlobalSettingOptions.ROLES
          ),
        },
        {
          name: getEntityName(entity),
          url: getRoleWithFqnPath(entity.fullyQualifiedName ?? ''),
        },
      ];
    }

    case EntityType.POLICY: {
      return [
        {
          name: i18n.t('label.policy-plural'),
          url: getSettingPath(
            GlobalSettingsMenuCategory.ACCESS,
            GlobalSettingOptions.POLICIES
          ),
        },
        {
          name: getEntityName(entity),
          url: getPolicyWithFqnPath(entity.fullyQualifiedName ?? ''),
        },
      ];
    }

    case EntityType.API_COLLECTION:
      return getBreadCrumbForAPICollection(entity as APICollection);

    case EntityType.API_ENDPOINT:
      return getBreadCrumbForAPIEndpoint(entity as APIEndpoint);

    case EntityType.METRIC: {
      return [
        {
          name: t('label.metric-plural'),
          url: ROUTES.METRICS,
        },
        {
          name: entity.name,
          url: '',
        },
      ];
    }

    case EntityType.KPI:
      return getBreadCrumbForKpi(entity as Kpi);

    case EntityType.KNOWLEDGE_PAGE:
      return [
        {
          name: i18n.t('label.knowledge-center'),
          url: ROUTES.KNOWLEDGE_CENTER,
        },
        {
          name: getEntityName(entity),
          url: '',
          activeTitle: Boolean(includeCurrent),
        },
      ];

    case EntityType.TABLE_COLUMN: {
      const columnData = entity as TableColumnSearchSource;
      const service = columnData.service;
      const database = columnData.database;
      const databaseSchema = columnData.databaseSchema;
      const table = columnData.table;

      return [
        ...(service
          ? [
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
              },
            ]
          : []),
        ...(database
          ? [
              {
                name: getEntityName(database),
                url: getEntityDetailsPath(
                  EntityType.DATABASE,
                  database?.fullyQualifiedName ?? ''
                ),
              },
            ]
          : []),
        ...(databaseSchema
          ? [
              {
                name: getEntityName(databaseSchema),
                url: getEntityDetailsPath(
                  EntityType.DATABASE_SCHEMA,
                  databaseSchema?.fullyQualifiedName ?? ''
                ),
              },
            ]
          : []),
        ...(table
          ? [
              {
                name: getEntityName(table),
                url: getEntityDetailsPath(
                  EntityType.TABLE,
                  table?.fullyQualifiedName ?? ''
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
