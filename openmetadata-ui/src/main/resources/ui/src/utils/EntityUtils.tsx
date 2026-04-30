/*
 *  Copyright 2022 Collate.
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

import { Popover, Space, Typography } from 'antd';
import { isEmpty, isUndefined, lowerCase, startCase } from 'lodash';
import { EntityDetailUnion } from 'Models';
import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Node } from 'reactflow';
import { TitleLink } from '../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import { DataAssetsWithoutServiceField } from '../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVoteType } from '../components/Database/TableQueries/TableQueries.interface';
import {
  CUSTOM_PROPERTIES_TABS_SET,
  LINEAGE_TABS_SET,
  SCHEMA_TABS_SET,
} from '../components/Entity/EntityRightPanel/EntityRightPanelVerticalNav.constants';
import { EntityWithServices } from '../components/Explore/ExplorePage.interface';
import {
  SearchedDataProps,
  SourceType,
} from '../components/SearchedData/SearchedData.interface';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import {
  DEFAULT_DOMAIN_VALUE,
  PLACEHOLDER_ROUTE_ENTITY_TYPE,
  PLACEHOLDER_ROUTE_FQN,
  ROUTES,
} from '../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../constants/GlobalSettings.constants';
import {
  EntityLineageNodeType,
  EntityTabs,
  EntityType,
  FqnPart,
} from '../enums/entity.enum';
import { ServiceCategory, ServiceCategoryPlural } from '../enums/service.enum';
import { Kpi } from '../generated/dataInsight/kpi/kpi';
import { Classification } from '../generated/entity/classification/classification';
import { Tag } from '../generated/entity/classification/tag';
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
import {
  SearchIndex as SearchIndexAsset,
  SearchIndexField,
} from '../generated/entity/data/searchIndex';
import { Spreadsheet } from '../generated/entity/data/spreadsheet';
import { StoredProcedure } from '../generated/entity/data/storedProcedure';
import {
  Column,
  ColumnJoins,
  JoinedWith,
  Table,
} from '../generated/entity/data/table';
import { Topic } from '../generated/entity/data/topic';
import { Worksheet } from '../generated/entity/data/worksheet';
import { DataProduct } from '../generated/entity/domains/dataProduct';
import { Team } from '../generated/entity/teams/team';
import {
  AlertType,
  EventSubscription,
} from '../generated/events/eventSubscription';
import { TestCase, TestSuite } from '../generated/tests/testCase';
import { EntityReference } from '../generated/type/entityUsage';
import { TagLabel } from '../generated/type/tagLabel';
import { Votes } from '../generated/type/votes';
import { DataInsightTabs } from '../interface/data-insight.interface';
import {
  SearchSourceAlias,
  TableColumnSearchSource,
} from '../interface/search.interface';
import { DataQualityPageTabs } from '../pages/DataQuality/DataQualityPage.interface';
import {
  getPartialNameFromTableFQN,
  getTableFQNFromColumnFQN,
} from './CommonUtils';
import { getDataInsightPathWithFqn } from './DataInsightUtils';
import EntityLink from './EntityLink';
import Fqn from './Fqn';
import i18n from './i18next/LocalUtil';
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
import { getEncodedFqn } from './StringsUtils';
import { getDataTypeString, getTagsWithoutTier } from './TableUtils';
import { getTableTags } from './TagsUtils';

const { t } = i18n;

export enum DRAWER_NAVIGATION_OPTIONS {
  explore = 'Explore',
  lineage = 'Lineage',
}

/**
 * Take entity reference as input and return name for entity
 * @param entity - entity reference
 * @returns - entity name
 */
export const getEntityName = (entity?: {
  name?: string;
  displayName?: string;
}) => {
  return entity?.displayName || entity?.name || '';
};

export const getDomainDisplayName = (
  activeDomainEntityRef?: EntityReference,
  activeDomain?: string
) => {
  if (activeDomainEntityRef) {
    return getEntityName(activeDomainEntityRef);
  }

  return activeDomain === DEFAULT_DOMAIN_VALUE
    ? t('label.all-domain-plural')
    : activeDomain;
};

export const getEntityLabel = (entity: {
  displayName?: string;
  name?: string;
  fullyQualifiedName?: string;
}): JSX.Element => (
  <Space className="w-full whitespace-normal" direction="vertical" size={0}>
    <Typography.Paragraph className="m-b-0">
      {getEntityName(entity)}
    </Typography.Paragraph>
    <Typography.Paragraph className="text-grey-muted text-xs">
      {entity?.fullyQualifiedName}
    </Typography.Paragraph>
  </Space>
);

export const getEntityTags = (
  type: string,
  entityDetail: EntityDetailUnion
): Array<TagLabel> => {
  switch (type) {
    case EntityType.TABLE: {
      const tableTags: Array<TagLabel> = [
        ...getTableTags((entityDetail as Table).columns ?? []),
        ...(entityDetail.tags ?? []),
      ];

      return tableTags;
    }
    case EntityType.DASHBOARD:
    case EntityType.SEARCH_INDEX:
    case EntityType.PIPELINE:
      return getTagsWithoutTier(entityDetail.tags ?? []);

    case EntityType.TOPIC:
    case EntityType.MLMODEL:
    case EntityType.STORED_PROCEDURE:
    case EntityType.DASHBOARD_DATA_MODEL: {
      return entityDetail.tags ?? [];
    }

    default:
      return [];
  }
};

export const ENTITY_LINK_SEPARATOR = '::';

export const getEntityFeedLink = (
  type?: string,
  fqn?: string,
  field?: string
): string => {
  if (isUndefined(type) || isUndefined(fqn)) {
    return '';
  }

  return `<#E${ENTITY_LINK_SEPARATOR}${type}${ENTITY_LINK_SEPARATOR}${fqn}${
    field ? `${ENTITY_LINK_SEPARATOR}${field}` : ''
  }>`;
};

/*
  params: userName - fullyQualifiedName
  return : <#E::user::userName>
*/
export const getEntityUserLink = (userName: string): string => {
  return `<#E${ENTITY_LINK_SEPARATOR}user${ENTITY_LINK_SEPARATOR}${userName}>`;
};

export const getTitleCase = (text?: string) => {
  return text ? startCase(text) : '';
};

/**
 * It searches for a given text in a given table and returns a new table with only the columns that
 * contain the given text
 * @param {Column[]} table - Column[] - the table to search in
 * @param {string} searchText - The text to search for.
 * @returns An array of columns that have been searched for a specific string.
 */
export const searchInColumns = <T extends Column | SearchIndexField>(
  table: T[],
  searchText: string
): T[] => {
  const searchedValue: T[] = table.reduce((searchedCols, column) => {
    const searchLowerCase = lowerCase(searchText);
    const isContainData =
      lowerCase(column.name).includes(searchLowerCase) ||
      lowerCase(column.displayName).includes(searchLowerCase) ||
      lowerCase(column.description).includes(searchLowerCase) ||
      lowerCase(getDataTypeString(column.dataType)).includes(searchLowerCase);

    if (isContainData) {
      return [...searchedCols, column];
    } else if (!isUndefined(column.children)) {
      const searchedChildren = searchInColumns<T>(
        column.children as T[],
        searchText
      );
      if (searchedChildren.length > 0) {
        return [
          ...searchedCols,
          {
            ...column,
            children: searchedChildren,
          },
        ];
      }
    }

    return searchedCols;
  }, [] as T[]);

  return searchedValue;
};

/**
 * It checks if a column has a join
 * @param {string} columnName - The name of the column you want to check if joins are available for.
 * @param joins - Array<ColumnJoins>
 * @returns A boolean value.
 */
export const checkIfJoinsAvailable = (
  columnName: string,
  joins: Array<ColumnJoins>
): boolean => {
  return (
    joins &&
    Boolean(joins.length) &&
    Boolean(joins.some((join) => join.columnName === columnName))
  );
};

/**
 * It takes a column name and a list of joins and returns the list of joinedWith for the column name
 * @param {string} columnName - The name of the column you want to get the frequently joined with
 * columns for.
 * @param joins - Array<ColumnJoins>
 * @returns An array of joinedWith objects
 */
export const getFrequentlyJoinedWithColumns = (
  columnName: string,
  joins: Array<ColumnJoins>
): Array<JoinedWith> => {
  return (
    (joins &&
      Boolean(joins.length) &&
      joins?.find((join) => join.columnName === columnName)?.joinedWith) ||
    []
  );
};

export const getFrequentlyJoinedColumns = (
  columnName: string,
  joins: Array<ColumnJoins>,
  columnLabel: string
) => {
  const frequentlyJoinedWithColumns = getFrequentlyJoinedWithColumns(
    columnName,
    joins
  );

  return checkIfJoinsAvailable(columnName, joins) ? (
    <div className="m-t-sm" data-testid="frequently-joined-columns">
      <span className="text-grey-muted m-r-xss">{columnLabel}:</span>
      <span>
        {frequentlyJoinedWithColumns.slice(0, 3).map((columnJoin, index) => (
          <Fragment key={columnJoin.fullyQualifiedName}>
            {index > 0 && <span className="m-r-xss">,</span>}
            <Link
              className="link-text"
              to={getEntityDetailsPath(
                EntityType.TABLE,
                columnJoin.fullyQualifiedName
              )}>
              {getPartialNameFromTableFQN(
                columnJoin.fullyQualifiedName,
                [
                  FqnPart.Database,
                  FqnPart.Table,
                  FqnPart.Schema,
                  FqnPart.Column,
                ],
                FQN_SEPARATOR_CHAR
              )}
            </Link>
          </Fragment>
        ))}

        {frequentlyJoinedWithColumns.length > 3 && (
          <Popover
            content={
              <div className="text-left">
                {frequentlyJoinedWithColumns?.slice(3).map((columnJoin) => (
                  <Fragment key={columnJoin.fullyQualifiedName}>
                    <a
                      className="link-text d-block p-y-xss"
                      href={getEntityDetailsPath(
                        EntityType.TABLE,
                        getTableFQNFromColumnFQN(
                          columnJoin?.fullyQualifiedName
                        ),
                        getPartialNameFromTableFQN(
                          columnJoin?.fullyQualifiedName,
                          [FqnPart.Column]
                        )
                      )}>
                      {getPartialNameFromTableFQN(
                        columnJoin?.fullyQualifiedName,
                        [FqnPart.Database, FqnPart.Table, FqnPart.Column]
                      )}
                    </a>
                  </Fragment>
                ))}
              </div>
            }
            placement="bottom"
            trigger="click">
            <span className="show-more m-l-xss text-underline">...</span>
          </Popover>
        )}
      </span>
    </div>
  ) : null;
};

/**
 * Convert entity to EntityReference
 * @param entities -- T extends EntityReference
 * @param type -- EntityType
 * @returns EntityReference
 */
export const getEntityReferenceFromEntity = <
  T extends Omit<EntityReference, 'type'>
>(
  entity: T,
  type: EntityType
): EntityReference => {
  return {
    id: entity.id,
    type,
    deleted: entity.deleted,
    description: entity.description,
    displayName: entity.displayName,
    fullyQualifiedName: entity.fullyQualifiedName,
    href: entity.href,
    name: entity.name,
  };
};

/**
 * Convert all the entity list to EntityReferenceList
 * @param entities -- T extends EntityReference
 * @param type -- EntityType
 * @returns EntityReference[]
 */
export const getEntityReferenceListFromEntities = <
  T extends Omit<EntityReference, 'type'>
>(
  entities: T[],
  type: EntityType
) => {
  if (isEmpty(entities)) {
    return [] as EntityReference[];
  }

  return entities.map((entity) => getEntityReferenceFromEntity(entity, type));
};

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
        entityType: EntityType.DIRECTORY, // Since parent will be directory
        includeCurrent,
        parents: isUndefined(data.directory) ? [] : [data.directory],
      });
    }

    case EntityType.SPREADSHEET: {
      const data = entity as Spreadsheet;

      return getBreadcrumbForEntityWithParent({
        entity: data,
        entityType: EntityType.DIRECTORY, // Since parent will be directory
        includeCurrent,
        parents: isUndefined(data.directory) ? [] : [data.directory],
      });
    }

    case EntityType.WORKSHEET: {
      const data = entity as Worksheet;

      return getBreadcrumbForEntityWithParent({
        entity: data,
        entityType: EntityType.SPREADSHEET, // Since parent will be spreadsheet
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

    case EntityType.TABLE_COLUMN: {
      // Column breadcrumb: Service > Database > Schema > Table > Column
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
                url: '', // Columns don't have their own page
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

export const getBreadcrumbsFromFqn = (fqn: string, includeCurrent = false) => {
  const fqnList = Fqn.split(fqn);
  if (!includeCurrent) {
    fqnList.pop();
  }

  return [
    ...fqnList.map((fqn) => ({
      name: fqn,
      url: '',
    })),
  ];
};

/**
 * Take entity vote and userId as input and return name for vote status type
 * @param votes - entity votes
 * @param userId - current user id
 * @returns - vote status type
 */
export const getEntityVoteStatus = (userId: string, votes?: Votes) => {
  if (isUndefined(votes)) {
    return QueryVoteType.unVoted;
  }

  const upVoters = votes.upVoters ?? [];
  const downVoters = votes.downVoters ?? [];

  if (upVoters.some((user) => user.id === userId)) {
    return QueryVoteType.votedUp;
  } else if (downVoters.some((user) => user.id === userId)) {
    return QueryVoteType.votedDown;
  } else {
    return QueryVoteType.unVoted;
  }
};

export const highlightEntityNameAndDescription = (
  entity: SearchedDataProps['data'][number]['_source'],
  highlight: SearchedDataProps['data'][number]['highlight']
): SearchedDataProps['data'][number]['_source'] => {
  let entityDescription = entity.description ?? '';
  const descHighlights = highlight?.description ?? [];

  if (descHighlights.length > 0) {
    const matchTextArr = descHighlights.map((val: string) =>
      val.replace(/<\/?span(.*?)>/g, '')
    );

    matchTextArr.forEach((text: string, i: number) => {
      entityDescription = entityDescription.replace(text, descHighlights[i]);
    });
  }

  let entityDisplayName = getEntityName(entity);
  if (!isUndefined(highlight)) {
    entityDisplayName =
      highlight?.displayName?.join(' ') ||
      highlight?.name?.join(' ') ||
      entityDisplayName;
  }

  return {
    ...entity,
    displayName: entityDisplayName,
    description: entityDescription,
  };
};

export const columnSorter = (
  col1: { name: string; displayName?: string },
  col2: { name: string; displayName?: string }
) => {
  const name1 = getEntityName(col1);
  const name2 = getEntityName(col2);

  return name1.localeCompare(name2);
};

/**
 * Retrieves the column name from an entity link.
 * @param entityLink The entity link string.
 * @returns The column name extracted from the entity link.
 */
export const getColumnNameFromEntityLink = (entityLink: string) => {
  return EntityLink.getTableColumnName(entityLink);
};

export const getEntityNameLabel = (entityName?: string) => {
  const entityNameLabels = {
    table: t('label.table'),
    topic: t('label.topic'),
    pipeline: t('label.pipeline'),
    container: t('label.container'),
    dashboard: t('label.dashboard'),
    testCase: t('label.test-case'),
    testSuite: t('label.test-suite'),
    dataContract: t('label.data-contract'),
    ingestionPipeline: t('label.ingestion-pipeline'),
    all: t('label.all'),
    announcement: t('label.announcement'),
    chart: t('label.chart'),
    conversation: t('label.conversation'),
    dashboardDataModel: t('label.data-model'),
    databaseSchema: t('label.database-schema'),
    databaseService: t('label.entity-service', {
      entity: t('label.database'),
    }),
    dashboardService: t('label.entity-service', {
      entity: t('label.dashboard'),
    }),
    messagingService: t('label.entity-service', {
      entity: t('label.messaging'),
    }),
    mlmodelService: t('label.entity-service', {
      entity: t('label.ml-model'),
    }),
    pipelineService: t('label.entity-service', {
      entity: t('label.pipeline'),
    }),
    storageService: t('label.entity-service', {
      entity: t('label.storage'),
    }),
    searchService: t('label.entity-service', { entity: t('label.search') }),
    metadataService: t('label.entity-service', {
      entity: t('label.metadata'),
    }),
    driveService: t('label.entity-service', {
      entity: t('label.drive'),
    }),
    glossary: t('label.glossary'),
    glossaryTerm: t('label.glossary-term'),
    tag: t('label.tag'),
    tagCategory: t('label.classification'),
    user: t('label.user'),
    domain: t('label.domain'),
    dataProduct: t('label.data-product'),
    storedProcedure: t('label.stored-procedure'),
    searchIndex: t('label.search-index'),
    task: t('label.task'),
    mlmodel: t('label.ml-model'),
    location: t('label.location'),
    database: t('label.database'),
    alert: t('label.alert-plural'),
    query: t('label.query'),
    THREAD: t('label.thread'),
    app: t('label.application'),
    apiCollection: t('label.api-collection'),
    apiEndpoint: t('label.api-endpoint'),
    metric: t('label.metric'),
    page: t('label.knowledge-page'),
    directory: t('label.directory'),
    file: t('label.file'),
    spreadsheet: t('label.spreadsheet'),
    worksheet: t('label.worksheet'),
    tableColumn: t('label.column'),
  };

  return (
    entityNameLabels[entityName as keyof typeof entityNameLabels] ||
    startCase(entityName)
  );
};

export const getPluralizeEntityName = (entityType?: string) => {
  const entityNameLabels = {
    [EntityType.TABLE]: t('label.table-plural'),
    [EntityType.TABLE_COLUMN]: t('label.column-plural'),
    [EntityType.TOPIC]: t('label.topic-plural'),
    [EntityType.PIPELINE]: t('label.pipeline-plural'),
    [EntityType.CONTAINER]: t('label.container-plural'),
    [EntityType.DASHBOARD]: t('label.dashboard-plural'),
    [EntityType.CHART]: t('label.chart-plural'),
    [EntityType.STORED_PROCEDURE]: t('label.stored-procedure-plural'),
    [EntityType.MLMODEL]: t('label.ml-model-plural'),
    [EntityType.DASHBOARD_DATA_MODEL]: t('label.data-model-plural'),
    [EntityType.SEARCH_INDEX]: t('label.search-index-plural'),
    [EntityType.API_COLLECTION]: t('label.api-collection-plural'),
    [EntityType.API_ENDPOINT]: t('label.api-endpoint-plural'),
    [EntityType.METRIC]: t('label.metric-plural'),
    [EntityType.DIRECTORY]: t('label.directory-plural'),
    [EntityType.FILE]: t('label.file-plural'),
    [EntityType.SPREADSHEET]: t('label.spreadsheet-plural'),
    [EntityType.WORKSHEET]: t('label.worksheet-plural'),
  };

  return (
    entityNameLabels[entityType as keyof typeof entityNameLabels] ||
    getEntityNameLabel(entityType)
  );
};

export const getColumnSorter = <T, K extends keyof T>(field: K) => {
  return (a: T, b: T) => {
    const aValue = a[field];
    const bValue = b[field];
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return aValue.localeCompare(bValue);
    }

    return 0;
  };
};

export const highlightSearchText = (
  text?: string,
  searchText?: string
): string => {
  if (!searchText || !text) {
    return text ?? '';
  }

  const regex = new RegExp(`(${searchText})`, 'gi');

  return text.replace(
    regex,
    `<span data-highlight="true" class="text-highlighter">$1</span>`
  );
};

/**
 * It searches for a given text in a given string and returns an array that contains the string parts that have
 * highlighted element if match found.
 * @param text - The text to search in.
 * @param searchText - The text to search for.
 * @returns An Array of string or JSX.Element which contains highlighted element.
 */
export const highlightSearchArrayElement = (
  text?: string,
  searchText?: string
): string | (string | JSX.Element)[] => {
  if (!searchText || !text) {
    return text ?? '';
  }
  const stringParts = text.split(new RegExp(`(${searchText})`, 'gi'));

  return stringParts.map((part, index) =>
    part.toLowerCase() === (searchText ?? '').toLowerCase() ? (
      <span className="text-highlighter" key={`${part}-${index}`}>
        {part}
      </span>
    ) : (
      part
    )
  );
};

export const getEntityImportPath = (entityType: EntityType, fqn: string) => {
  return ROUTES.ENTITY_IMPORT.replace(
    PLACEHOLDER_ROUTE_ENTITY_TYPE,
    entityType
  ).replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(fqn));
};

export const getEntityBulkEditPath = (entityType: EntityType, fqn: string) => {
  return ROUTES.BULK_EDIT_ENTITY_WITH_FQN.replace(
    PLACEHOLDER_ROUTE_ENTITY_TYPE,
    entityType
  ).replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(fqn));
};

/**
 * Updates the node type based on whether it's a source or target node
 * @param node - The node to update
 * @param sourceNodeId - ID of the source node
 * @param targetNodeId - ID of the target node
 * @returns The updated node with the correct type
 */
export const updateNodeType = (
  node: Node,
  sourceNodeId?: string,
  targetNodeId?: string
): Node => {
  if (node.id === sourceNodeId) {
    return {
      ...node,
      type: EntityLineageNodeType.INPUT,
    };
  }
  if (node.id === targetNodeId) {
    return {
      ...node,
      type: EntityLineageNodeType.OUTPUT,
    };
  }

  return node;
};

export const EntityTypeName: Record<EntityType, string> = {
  [EntityType.API_SERVICE]: t('label.api-service'),
  [EntityType.DATABASE_SERVICE]: t('label.database-service'),
  [EntityType.MESSAGING_SERVICE]: t('label.messaging-service'),
  [EntityType.PIPELINE_SERVICE]: t('label.pipeline-service'),
  [EntityType.MLMODEL_SERVICE]: t('label.mlmodel-service'),
  [EntityType.DASHBOARD_SERVICE]: t('label.dashboard-service'),
  [EntityType.STORAGE_SERVICE]: t('label.storage-service'),
  [EntityType.SEARCH_SERVICE]: t('label.search-service'),
  [EntityType.DRIVE_SERVICE]: t('label.entity-service', {
    entity: t('label.drive'),
  }),
  [EntityType.METRIC]: t('label.metric'),
  [EntityType.CONTAINER]: t('label.container'),
  [EntityType.DASHBOARD_DATA_MODEL]: t('label.dashboard-data-model'),
  [EntityType.TABLE]: t('label.table'),
  [EntityType.GLOSSARY_TERM]: t('label.glossary-term'),
  [EntityType.PAGE]: t('label.page'),
  [EntityType.DATABASE_SCHEMA]: t('label.database-schema'),
  [EntityType.CHART]: t('label.chart'),
  [EntityType.STORED_PROCEDURE]: t('label.stored-procedure'),
  [EntityType.DATABASE]: t('label.database'),
  [EntityType.PIPELINE]: t('label.pipeline'),
  [EntityType.TAG]: t('label.tag'),
  [EntityType.DASHBOARD]: t('label.dashboard'),
  [EntityType.API_ENDPOINT]: t('label.api-endpoint'),
  [EntityType.TOPIC]: t('label.topic'),
  [EntityType.DATA_PRODUCT]: t('label.data-product'),
  [EntityType.MLMODEL]: t('label.ml-model'),
  [EntityType.SEARCH_INDEX]: t('label.search-index'),
  [EntityType.API_COLLECTION]: t('label.api-collection'),
  [EntityType.TEST_SUITE]: t('label.test-suite'),
  [EntityType.TEAM]: t('label.team'),
  [EntityType.TEST_CASE]: t('label.test-case'),
  [EntityType.DOMAIN]: t('label.domain'),
  [EntityType.PERSONA]: t('label.persona'),
  [EntityType.POLICY]: t('label.policy'),
  [EntityType.ROLE]: t('label.role'),
  [EntityType.APPLICATION]: t('label.application'),
  [EntityType.CLASSIFICATION]: t('label.classification'),
  [EntityType.GLOSSARY]: t('label.glossary'),
  [EntityType.METADATA_SERVICE]: t('label.metadata-service'),
  [EntityType.WEBHOOK]: t('label.webhook'),
  [EntityType.TYPE]: t('label.type'),
  [EntityType.USER]: t('label.user'),
  [EntityType.BOT]: t('label.bot'),
  [EntityType.DATA_INSIGHT_CHART]: t('label.data-insight-chart'),
  [EntityType.KPI]: t('label.kpi'),
  [EntityType.ALERT]: t('label.alert'),
  [EntityType.SUBSCRIPTION]: t('label.subscription'),
  [EntityType.SAMPLE_DATA]: t('label.sample-data'),
  [EntityType.APP_MARKET_PLACE_DEFINITION]: t(
    'label.app-market-place-definition'
  ),
  [EntityType.DOC_STORE]: t('label.doc-store'),
  [EntityType.KNOWLEDGE_PAGE]: t('label.knowledge-page'),
  [EntityType.knowledgePanels]: t('label.knowledge-panels'),
  [EntityType.GOVERN]: t('label.govern'),
  [EntityType.ALL]: t('label.all'),
  [EntityType.CUSTOM_METRIC]: t('label.custom-metric'),
  [EntityType.INGESTION_PIPELINE]: t('label.ingestion-pipeline'),
  [EntityType.QUERY]: t('label.query'),
  [EntityType.ENTITY_REPORT_DATA]: t('label.entity-report-data'),
  [EntityType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA]: t(
    'label.web-analytic-entity-view-report-data'
  ),
  [EntityType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA]: t(
    'label.web-analytic-user-activity-report-data'
  ),
  [EntityType.TEST_CASE_RESOLUTION_STATUS]: t(
    'label.test-case-resolution-status'
  ),
  [EntityType.TEST_CASE_RESULT]: t('label.test-case-result'),
  [EntityType.EVENT_SUBSCRIPTION]: t('label.event-subscription'),
  [EntityType.LINEAGE_EDGE]: t('label.lineage-edge'),
  [EntityType.WORKFLOW_DEFINITION]: t('label.workflow-definition'),
  [EntityType.SERVICE]: t('label.service'),
  [EntityType.DATA_CONTRACT]: t('label.data-contract'),
  [EntityType.SECURITY_SERVICE]: t('label.security-service'),
  [EntityType.INGESTION_RUNNER]: t('label.ingestion-runner'),
  [EntityType.DIRECTORY]: t('label.directory'),
  [EntityType.FILE]: t('label.file'),
  [EntityType.SPREADSHEET]: t('label.spreadsheet'),
  [EntityType.WORKSHEET]: t('label.worksheet'),
  [EntityType.NOTIFICATION_TEMPLATE]: t('label.notification-template'),
  [EntityType.TABLE_COLUMN]: t('label.column'),
};

export const hasSchemaTab = (entityType: EntityType): boolean =>
  SCHEMA_TABS_SET.has(entityType);

export const hasLineageTab = (entityType: EntityType): boolean =>
  LINEAGE_TABS_SET.has(entityType);

export const hasCustomPropertiesTab = (entityType: EntityType): boolean =>
  CUSTOM_PROPERTIES_TABS_SET.has(entityType);
