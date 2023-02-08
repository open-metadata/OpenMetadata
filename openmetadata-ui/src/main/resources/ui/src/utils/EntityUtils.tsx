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

import { Popover } from 'antd';
import { EntityData } from 'components/common/PopOverCard/EntityPopOverCard';
import {
  LeafNodes,
  LineagePos,
} from 'components/EntityLineage/EntityLineage.interface';
import { ResourceEntity } from 'components/PermissionProvider/PermissionProvider.interface';
import { ExplorePageTabs } from 'enums/Explore.enum';
import { Mlmodel } from 'generated/entity/data/mlmodel';
import i18next from 'i18next';
import { isEmpty, isNil, isUndefined, lowerCase, startCase } from 'lodash';
import { Bucket } from 'Models';
import React, { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import {
  getDashboardDetailsPath,
  getDatabaseDetailsPath,
  getDatabaseSchemaDetailsPath,
  getServiceDetailsPath,
  getTableDetailsPath,
  getTeamAndUserDetailsPath,
} from '../constants/constants';
import { AssetsType, EntityType, FqnPart } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { ServiceCategory } from '../enums/service.enum';
import { PrimaryTableDataTypes } from '../enums/table.enum';
import { Dashboard } from '../generated/entity/data/dashboard';
import { Pipeline } from '../generated/entity/data/pipeline';
import {
  Column,
  ColumnJoins,
  JoinedWith,
  Table,
  TableType,
} from '../generated/entity/data/table';
import { Topic } from '../generated/entity/data/topic';
import { Edge, EntityLineage } from '../generated/type/entityLineage';
import { EntityReference } from '../generated/type/entityUsage';
import { TagLabel } from '../generated/type/tagLabel';
import {
  getEntityName,
  getPartialNameFromTableFQN,
  getTableFQNFromColumnFQN,
} from './CommonUtils';
import {
  getDataTypeString,
  getTierFromTableTags,
  getUsagePercentile,
} from './TableUtils';
import { getTableTags } from './TagsUtils';

export enum DRAWER_NAVIGATION_OPTIONS {
  explore = 'Explore',
  lineage = 'Lineage',
}

export const getEntityTags = (
  type: string,
  entityDetail: Table | Pipeline | Dashboard | Topic | Mlmodel
): Array<TagLabel | undefined> => {
  switch (type) {
    case EntityType.TABLE: {
      const tableTags: Array<TagLabel> = [
        ...getTableTags((entityDetail as Table).columns || []),
        ...(entityDetail.tags || []),
      ];

      return tableTags;
    }
    case EntityType.PIPELINE: {
      return entityDetail.tags || [];
    }
    case EntityType.DASHBOARD: {
      return entityDetail.tags || [];
    }

    default:
      return [];
  }
};

export const getEntityOverview = (
  type: string,
  entityDetail: EntityData
): Array<{
  name: string;
  value: string | number | React.ReactNode;
  isLink: boolean;
  isExternal?: boolean;
  url?: string;
  visible?: Array<string>;
  dataTestId?: string;
}> => {
  switch (type) {
    case ExplorePageTabs.TABLES: {
      const {
        fullyQualifiedName,
        owner,
        tags,
        usageSummary,
        profile,
        columns,
        tableType,
      } = entityDetail as Table;
      const [service, database, schema] = getPartialNameFromTableFQN(
        fullyQualifiedName ?? '',
        [FqnPart.Service, FqnPart.Database, FqnPart.Schema],
        FQN_SEPARATOR_CHAR
      ).split(FQN_SEPARATOR_CHAR);

      const tier = getTierFromTableTags(tags || []);

      const usage = !isNil(usageSummary?.weeklyStats?.percentileRank)
        ? getUsagePercentile(usageSummary?.weeklyStats?.percentileRank || 0)
        : '-';

      const queries = usageSummary?.weeklyStats?.count.toLocaleString() || '-';

      const overview = [
        {
          name: i18next.t('label.type'),
          value: tableType || TableType.Regular,
          isLink: false,
          visible: [
            DRAWER_NAVIGATION_OPTIONS.lineage,
            DRAWER_NAVIGATION_OPTIONS.explore,
          ],
        },
        {
          name: i18next.t('label.service'),
          value: service,
          url: getServiceDetailsPath(
            service,
            ServiceCategory.DATABASE_SERVICES
          ),
          isLink: true,
          visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
        },
        {
          name: i18next.t('label.database'),
          value: database,
          url: getDatabaseDetailsPath(
            getPartialNameFromTableFQN(
              fullyQualifiedName ?? '',
              [FqnPart.Service, FqnPart.Database],
              FQN_SEPARATOR_CHAR
            )
          ),
          isLink: true,
          visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
        },
        {
          name: i18next.t('label.schema'),
          value: schema,
          url: getDatabaseSchemaDetailsPath(
            getPartialNameFromTableFQN(
              fullyQualifiedName ?? '',
              [FqnPart.Service, FqnPart.Database, FqnPart.Schema],
              FQN_SEPARATOR_CHAR
            )
          ),
          isLink: true,
          visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
        },
        {
          name: i18next.t('label.owner'),
          value: getEntityName(owner) || '-',
          url: getTeamAndUserDetailsPath(owner?.name || ''),
          isLink: owner ? owner.type === 'team' : false,
          visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
        },
        {
          name: i18next.t('label.tier'),
          value: tier ? tier.split(FQN_SEPARATOR_CHAR)[1] : '-',
          isLink: false,
          visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
        },
        {
          name: i18next.t('label.usage'),
          value: usage,
          isLink: false,
          visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
        },
        {
          name: i18next.t('label.query-plural'),
          value: `${queries} past week`,
          isLink: false,
          visible: [
            DRAWER_NAVIGATION_OPTIONS.lineage,
            DRAWER_NAVIGATION_OPTIONS.explore,
          ],
        },
        {
          name: i18next.t('label.column-plural'),
          value: columns ? columns.length : '-',
          isLink: false,
          visible: [
            DRAWER_NAVIGATION_OPTIONS.lineage,
            DRAWER_NAVIGATION_OPTIONS.explore,
          ],
        },
        {
          name: i18next.t('label.row-plural'),
          value: profile && profile?.rowCount ? profile.rowCount : '-',
          isLink: false,
          visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
        },
      ];

      return overview;
    }

    case ExplorePageTabs.PIPELINES: {
      const {
        owner,
        tags,
        pipelineUrl,
        service,
        fullyQualifiedName,
        displayName,
        serviceType,
      } = entityDetail as Pipeline;
      const tier = getTierFromTableTags(tags || []);

      const overview = [
        {
          name: `${i18next.t('label.pipeline')} ${i18next.t(
            'label.url-uppercase'
          )}`,
          dataTestId: 'pipeline-url-label',
          value: displayName,
          url: pipelineUrl,
          isLink: true,
          visible: [
            DRAWER_NAVIGATION_OPTIONS.lineage,
            DRAWER_NAVIGATION_OPTIONS.explore,
          ],
        },
        {
          name: i18next.t('label.service'),
          value: service?.name as string,
          url: getServiceDetailsPath(
            service?.name as string,
            ServiceCategory.PIPELINE_SERVICES
          ),
          isLink: true,
          visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
        },
        {
          name: i18next.t('label.owner'),
          value: getEntityName(owner) || '-',
          url: getTeamAndUserDetailsPath(owner?.name || ''),
          isLink: owner ? owner.type === 'team' : false,
          visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
        },
        {
          name: i18next.t('label.tier'),
          value: tier ? tier.split(FQN_SEPARATOR_CHAR)[1] : '-',
          isLink: false,
          visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
        },
        {
          name: `${serviceType} ${i18next.t('label.url-lowercase')}`,
          value: fullyQualifiedName?.split(FQN_SEPARATOR_CHAR)[1] as string,
          url: pipelineUrl as string,
          isLink: true,
          isExternal: true,
          visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
        },
      ];

      return overview;
    }
    case ExplorePageTabs.DASHBOARDS: {
      const {
        owner,
        tags,
        dashboardUrl,
        service,
        fullyQualifiedName,
        displayName,
        serviceType,
      } = entityDetail as Dashboard;
      const tier = getTierFromTableTags(tags || []);

      const overview = [
        {
          name: `${i18next.t('label.dashboard')} ${i18next.t(
            'label.url-uppercase'
          )}`,
          value: displayName,
          url: dashboardUrl,
          isLink: true,
          visible: [
            DRAWER_NAVIGATION_OPTIONS.lineage,
            DRAWER_NAVIGATION_OPTIONS.explore,
          ],
        },
        {
          name: i18next.t('label.service'),
          value: service?.name as string,
          url: getServiceDetailsPath(
            service?.name as string,
            ServiceCategory.DASHBOARD_SERVICES
          ),
          isLink: true,
          visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
        },
        {
          name: i18next.t('label.owner'),
          value: getEntityName(owner) || '-',
          url: getTeamAndUserDetailsPath(owner?.name || ''),
          isLink: owner ? owner.type === 'team' : false,
          visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
        },
        {
          name: i18next.t('label.tier'),
          value: tier ? tier.split(FQN_SEPARATOR_CHAR)[1] : '-',
          isLink: false,
          visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
        },
        {
          name: `${serviceType} ${i18next.t('label.url-lowercase')}`,
          value:
            displayName ||
            (fullyQualifiedName?.split(FQN_SEPARATOR_CHAR)[1] as string),
          url: dashboardUrl as string,
          isLink: true,
          isExternal: true,
          visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
        },
      ];

      return overview;
    }

    case ExplorePageTabs.MLMODELS: {
      const { algorithm, target, server, dashboard } = entityDetail as Mlmodel;

      const overview = [
        {
          name: i18next.t('label.algorithm'),
          value: algorithm || '-',
          url: '',
          isLink: false,
          visible: [
            DRAWER_NAVIGATION_OPTIONS.lineage,
            DRAWER_NAVIGATION_OPTIONS.explore,
          ],
        },
        {
          name: i18next.t('label.target'),
          value: target || '-',
          url: '',
          isLink: false,
          visible: [
            DRAWER_NAVIGATION_OPTIONS.lineage,
            DRAWER_NAVIGATION_OPTIONS.explore,
          ],
        },
        {
          name: i18next.t('label.server'),
          value: server || '-',
          url: server,
          isLink: true,
          visible: [
            DRAWER_NAVIGATION_OPTIONS.lineage,
            DRAWER_NAVIGATION_OPTIONS.explore,
          ],
        },
        {
          name: i18next.t('label.dashboard'),
          value: getEntityName(dashboard),
          url: getDashboardDetailsPath(dashboard?.fullyQualifiedName as string),
          isLink: true,
          visible: [
            DRAWER_NAVIGATION_OPTIONS.lineage,
            DRAWER_NAVIGATION_OPTIONS.explore,
          ],
        },
      ];

      return overview;
    }
    default:
      return [];
  }
};

// Note: This method is enhanced from "getEntityCountByService" of ServiceUtils.ts
export const getEntityCountByType = (buckets: Array<Bucket>) => {
  const entityCounts = {
    tableCount: 0,
    topicCount: 0,
    dashboardCount: 0,
    pipelineCount: 0,
  };
  buckets?.forEach((bucket) => {
    switch (bucket.key) {
      case EntityType.TABLE:
        entityCounts.tableCount += bucket.doc_count;

        break;
      case EntityType.TOPIC:
        entityCounts.topicCount += bucket.doc_count;

        break;
      case EntityType.DASHBOARD:
        entityCounts.dashboardCount += bucket.doc_count;

        break;
      case EntityType.PIPELINE:
        entityCounts.pipelineCount += bucket.doc_count;

        break;
      default:
        break;
    }
  });

  return entityCounts;
};

export const getTotalEntityCountByType = (buckets: Array<Bucket> = []) => {
  let entityCounts = 0;
  buckets.forEach((bucket) => {
    entityCounts += bucket.doc_count;
  });

  return entityCounts;
};

export const getEntityLineage = (
  oldVal: EntityLineage,
  newVal: EntityLineage,
  pos: LineagePos
) => {
  if (pos === 'to') {
    const downEdges = newVal.downstreamEdges;
    const newNodes = newVal.nodes?.filter((n) =>
      downEdges?.find((e) => e.toEntity === n.id)
    );

    return {
      ...oldVal,
      downstreamEdges: [
        ...(oldVal.downstreamEdges as Edge[]),
        ...(downEdges as Edge[]),
      ],
      nodes: [
        ...(oldVal.nodes as EntityReference[]),
        ...(newNodes as EntityReference[]),
      ],
    };
  } else {
    const upEdges = newVal.upstreamEdges;
    const newNodes = newVal.nodes?.filter((n) =>
      upEdges?.find((e) => e.fromEntity === n.id)
    );

    return {
      ...oldVal,
      upstreamEdges: [
        ...(oldVal.upstreamEdges as Edge[]),
        ...(upEdges as Edge[]),
      ],
      nodes: [
        ...(oldVal.nodes as EntityReference[]),
        ...(newNodes as EntityReference[]),
      ],
    };
  }
};

export const isLeafNode = (
  leafNodes: LeafNodes,
  id: string,
  pos: LineagePos
) => {
  if (!isEmpty(leafNodes)) {
    return pos === 'from'
      ? leafNodes.upStreamNode?.includes(id)
      : leafNodes.downStreamNode?.includes(id);
  } else {
    return false;
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
  // url decode the fqn
  fqn = decodeURIComponent(fqn);

  return `<#E${ENTITY_LINK_SEPARATOR}${type}${ENTITY_LINK_SEPARATOR}${fqn}${
    field ? `${ENTITY_LINK_SEPARATOR}${field}` : ''
  }>`;
};

export const isSupportedTest = (dataType: string) => {
  return dataType === 'ARRAY' || dataType === 'STRUCT';
};

export const isColumnTestSupported = (dataType: string) => {
  const supportedType = Object.values(PrimaryTableDataTypes);

  return supportedType.includes(
    getDataTypeString(dataType) as PrimaryTableDataTypes
  );
};

export const getTitleCase = (text?: string) => {
  return text ? startCase(text) : '';
};

export const filterEntityAssets = (data: EntityReference[]) => {
  const includedEntity = Object.values(AssetsType);

  return data.filter((d) => includedEntity.includes(d.type as AssetsType));
};

export const getResourceEntityFromEntityType = (entityType: string) => {
  switch (entityType) {
    case EntityType.TABLE:
    case SearchIndex.TABLE:
      return ResourceEntity.TABLE;

    case EntityType.TOPIC:
    case SearchIndex.TOPIC:
      return ResourceEntity.TOPIC;

    case EntityType.DASHBOARD:
    case SearchIndex.DASHBOARD:
      return ResourceEntity.DASHBOARD;

    case EntityType.PIPELINE:
    case SearchIndex.PIPELINE:
      return ResourceEntity.PIPELINE;

    case EntityType.MLMODEL:
    case SearchIndex.MLMODEL:
      return ResourceEntity.ML_MODEL;
  }

  return ResourceEntity.ALL;
};

/**
 * It searches for a given text in a given table and returns a new table with only the columns that
 * contain the given text
 * @param {Column[]} table - Column[] - the table to search in
 * @param {string} searchText - The text to search for.
 * @returns An array of columns that have been searched for a specific string.
 */
export const searchInColumns = (
  table: Column[],
  searchText: string
): Column[] => {
  const searchedValue: Column[] = table.reduce((searchedCols, column) => {
    const searchLowerCase = lowerCase(searchText);
    const isContainData =
      lowerCase(column.name).includes(searchLowerCase) ||
      lowerCase(column.description).includes(searchLowerCase) ||
      lowerCase(getDataTypeString(column.dataType)).includes(searchLowerCase);

    if (isContainData) {
      return [...searchedCols, column];
    } else if (!isUndefined(column.children)) {
      const searchedChildren = searchInColumns(column.children, searchText);
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
  }, [] as Column[]);

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
    Boolean(joins.find((join) => join.columnName === columnName))
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
    joins?.find((join) => join.columnName === columnName)?.joinedWith || []
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
      <span className="tw-text-grey-muted m-r-xss">{columnLabel}:</span>
      <span>
        {frequentlyJoinedWithColumns.slice(0, 3).map((columnJoin, index) => (
          <Fragment key={index}>
            {index > 0 && <span className="m-r-xss">,</span>}
            <Link
              className="link-text"
              to={getTableDetailsPath(
                getTableFQNFromColumnFQN(columnJoin.fullyQualifiedName),
                getPartialNameFromTableFQN(columnJoin.fullyQualifiedName, [
                  FqnPart.Column,
                ])
              )}>
              {getPartialNameFromTableFQN(
                columnJoin.fullyQualifiedName,
                [FqnPart.Database, FqnPart.Table, FqnPart.Column],
                FQN_SEPARATOR_CHAR
              )}
            </Link>
          </Fragment>
        ))}

        {frequentlyJoinedWithColumns.length > 3 && (
          <Popover
            content={
              <div className="text-left">
                {frequentlyJoinedWithColumns
                  ?.slice(3)
                  .map((columnJoin, index) => (
                    <Fragment key={index}>
                      <a
                        className="link-text d-block p-y-xss"
                        href={getTableDetailsPath(
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
