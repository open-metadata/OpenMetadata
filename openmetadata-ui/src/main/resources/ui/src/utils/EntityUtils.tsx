/*
 *  Copyright 2021 Collate
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

import classNames from 'classnames';
import { isEmpty, isNil, isString, isUndefined } from 'lodash';
import { Bucket, ExtraInfo, LeafNodes, LineagePos } from 'Models';
import React from 'react';
import Avatar from '../components/common/avatar/Avatar';
import TableProfilerGraph from '../components/TableProfiler/TableProfilerGraph.component';
import {
  getDatabaseDetailsPath,
  getServiceDetailsPath,
  getTeamDetailsPath,
} from '../constants/constants';
import { ColumnTestType } from '../enums/columnTest.enum';
import { EntityType } from '../enums/entity.enum';
import { ServiceCategory } from '../enums/service.enum';
import { Dashboard } from '../generated/entity/data/dashboard';
import { Pipeline } from '../generated/entity/data/pipeline';
import { Table } from '../generated/entity/data/table';
import { Topic } from '../generated/entity/data/topic';
import { Edge, EntityLineage } from '../generated/type/entityLineage';
import { EntityReference } from '../generated/type/entityUsage';
import { TagLabel } from '../generated/type/tagLabel';
import { getPartialNameFromFQN } from './CommonUtils';
import SVGIcons from './SvgUtils';
import {
  getDataTypeString,
  getOwnerFromId,
  getTierFromTableTags,
  getUsagePercentile,
} from './TableUtils';
import { getTableTags } from './TagsUtils';

export const getEntityTags = (
  type: string,
  entityDetail: Partial<Table> &
    Partial<Pipeline> &
    Partial<Dashboard> &
    Partial<Topic>
): Array<string | undefined> => {
  switch (type) {
    case EntityType.TABLE: {
      const tableTags: Array<TagLabel> = [
        ...getTableTags(entityDetail.columns || []),
        ...(entityDetail.tags || []),
      ];

      return tableTags.map((t) => t.tagFQN);
    }
    case EntityType.PIPELINE: {
      return entityDetail.tags?.map((t) => t.tagFQN) || [];
    }
    case EntityType.DASHBOARD: {
      return entityDetail.tags?.map((t) => t.tagFQN) || [];
    }

    default:
      return [];
  }
};

export const getEntityOverview = (
  type: string,
  entityDetail: Partial<Table> &
    Partial<Pipeline> &
    Partial<Dashboard> &
    Partial<Topic>,
  serviceType: string
): Array<{
  name: string;
  value: string | number | React.ReactNode;
  isLink: boolean;
  isExternal?: boolean;
  url?: string;
}> => {
  switch (type) {
    case EntityType.TABLE: {
      const { fullyQualifiedName, owner, tags, usageSummary, tableProfile } =
        entityDetail;
      const [service, database] = getPartialNameFromFQN(
        fullyQualifiedName ?? '',
        ['service', 'database'],
        '.'
      ).split('.');
      const ownerValue = getOwnerFromId(owner?.id);
      const tier = getTierFromTableTags(tags || []);
      const usage = !isNil(usageSummary?.weeklyStats?.percentileRank)
        ? getUsagePercentile(usageSummary?.weeklyStats?.percentileRank || 0)
        : '--';
      const queries = usageSummary?.weeklyStats?.count.toLocaleString() || '--';

      const overview = [
        {
          name: 'Service',
          value: service,
          url: getServiceDetailsPath(
            service,
            ServiceCategory.DATABASE_SERVICES
          ),
          isLink: true,
        },
        {
          name: 'Database',
          value: database,
          url: getDatabaseDetailsPath(
            getPartialNameFromFQN(
              fullyQualifiedName ?? '',
              ['service', 'database'],
              '.'
            )
          ),
          isLink: true,
        },
        {
          name: 'Owner',
          value: ownerValue?.displayName || ownerValue?.name || '--',
          url: getTeamDetailsPath(owner?.name || ''),
          isLink: ownerValue
            ? ownerValue.type === 'team'
              ? true
              : false
            : false,
        },
        {
          name: 'Tier',
          value: tier ? tier.split('.')[1] : '--',
          isLink: false,
        },
        {
          name: 'Usage',
          value: usage,
          isLink: false,
        },
        {
          name: 'Queries',
          value: `${queries} past week`,
          isLink: false,
        },
        {
          name: 'Columns',
          value:
            tableProfile && tableProfile[0]?.columnCount
              ? tableProfile[0].columnCount
              : '--',
          isLink: false,
        },
        {
          name: 'Rows',
          value: tableProfile ? (
            <TableProfilerGraph
              className="tw--mt-5"
              data={
                tableProfile
                  ?.map((d) => ({
                    date: d.profileDate,
                    value: d.rowCount ?? 0,
                  }))
                  .reverse() as Array<{
                  date: Date;
                  value: number;
                }>
              }
              height={38}
              toolTipPos={{ x: 20, y: -30 }}
            />
          ) : (
            '--'
          ),
          isLink: false,
        },
      ];

      return overview;
    }

    case EntityType.PIPELINE: {
      const { owner, tags, pipelineUrl, service, fullyQualifiedName } =
        entityDetail;
      const ownerValue = getOwnerFromId(owner?.id);
      const tier = getTierFromTableTags(tags || []);

      const overview = [
        {
          name: 'Service',
          value: service?.name as string,
          url: getServiceDetailsPath(
            service?.name as string,
            ServiceCategory.PIPELINE_SERVICES
          ),
          isLink: true,
        },
        {
          name: 'Owner',
          value: ownerValue?.displayName || ownerValue?.name || '--',
          url: getTeamDetailsPath(owner?.name || ''),
          isLink: ownerValue
            ? ownerValue.type === 'team'
              ? true
              : false
            : false,
        },
        {
          name: 'Tier',
          value: tier ? tier.split('.')[1] : '--',
          isLink: false,
        },
        {
          name: `${serviceType} url`,
          value: fullyQualifiedName?.split('.')[1] as string,
          url: pipelineUrl as string,
          isLink: true,
          isExternal: true,
        },
      ];

      return overview;
    }
    case EntityType.DASHBOARD: {
      const { owner, tags, dashboardUrl, service, fullyQualifiedName } =
        entityDetail;
      const ownerValue = getOwnerFromId(owner?.id);
      const tier = getTierFromTableTags(tags || []);

      const overview = [
        {
          name: 'Service',
          value: service?.name as string,
          url: getServiceDetailsPath(
            service?.name as string,
            ServiceCategory.DASHBOARD_SERVICES
          ),
          isLink: true,
        },
        {
          name: 'Owner',
          value: ownerValue?.displayName || ownerValue?.name || '--',
          url: getTeamDetailsPath(owner?.name || ''),
          isLink: ownerValue
            ? ownerValue.type === 'team'
              ? true
              : false
            : false,
        },
        {
          name: 'Tier',
          value: tier ? tier.split('.')[1] : '--',
          isLink: false,
        },
        {
          name: `${serviceType} url`,
          value: fullyQualifiedName?.split('.')[1] as string,
          url: dashboardUrl as string,
          isLink: true,
          isExternal: true,
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

export const getInfoElements = (data: ExtraInfo) => {
  let retVal = <></>;
  const displayVal = data.placeholderText || data.value;

  switch (data.key) {
    case 'Owner':
      {
        retVal =
          displayVal && displayVal !== '--' ? (
            isString(displayVal) ? (
              <div className="tw-inline-block tw-mr-2">
                <Avatar name={displayVal} textClass="tw-text-xs" width="22" />
              </div>
            ) : (
              <></>
            )
          ) : (
            <>No Owner</>
          );
      }

      break;
    case 'Tier':
      {
        retVal = !displayVal || displayVal === '--' ? <>No Tier</> : <></>;
      }

      break;
    default:
      {
        retVal = (
          <>
            {data.key
              ? displayVal
                ? data.showLabel
                  ? `${data.key}: `
                  : null
                : `No ${data.key}`
              : null}
          </>
        );
      }

      break;
  }

  return (
    <>
      <span className="tw-text-grey-muted">{retVal}</span>
      {displayVal ? (
        <span>
          {data.isLink ? (
            <a
              data-testid="owner-link"
              href={data.value as string}
              rel="noopener noreferrer"
              target={data.openInNewTab ? '_blank' : '_self'}>
              <>
                <span
                  className={classNames(
                    'tw-mr-1 tw-inline-block tw-truncate link-text',
                    {
                      'tw-w-52': (displayVal as string).length > 32,
                    }
                  )}
                  title={displayVal as string}>
                  {displayVal}
                </span>
                {data.openInNewTab && (
                  <SVGIcons
                    alt="external-link"
                    className="tw-align-middle"
                    icon="external-link"
                    width="12px"
                  />
                )}
              </>
            </a>
          ) : (
            <>
              {data.key === 'Owner' ? (
                <span
                  className={classNames(
                    'tw-mr-1 tw-inline-block tw-truncate tw-align-middle',
                    { 'tw-w-52': (displayVal as string).length > 32 }
                  )}
                  title={displayVal as string}>
                  {displayVal}
                </span>
              ) : (
                <span>{displayVal}</span>
              )}
            </>
          )}
        </span>
      ) : null}
    </>
  );
};

export const getEntityFeedLink: Function = (
  type: string,
  fqn: string,
  field?: string
): string | undefined => {
  if (isUndefined(type) || isUndefined(fqn)) return undefined;

  return `<#E/${type}/${fqn}${field ? `/${field}` : ''}>`;
};

export const isSupportedTest = (dataType: string) => {
  return dataType === 'ARRAY' || dataType === 'STRUCT';
};

export const filteredColumnTestOption = (dataType: string) => {
  switch (getDataTypeString(dataType)) {
    case 'numeric':
      return Object.values(ColumnTestType).filter(
        (test) => test !== ColumnTestType.columnValueLengthsToBeBetween
      );

    case 'varchar':
      return Object.values(ColumnTestType).filter(
        (test) => test !== ColumnTestType.columnValuesToBeBetween
      );

    case 'timestamp':
    case 'date': {
      const excluded = [
        ColumnTestType.columnValuesToBeNotInSet,
        ColumnTestType.columnValueLengthsToBeBetween,
      ];

      return Object.values(ColumnTestType).filter(
        (test) => !excluded.includes(test)
      );
    }
    case 'boolean': {
      const excluded = [
        ColumnTestType.columnValuesToBeNotInSet,
        ColumnTestType.columnValueLengthsToBeBetween,
        ColumnTestType.columnValuesToBeBetween,
      ];

      return Object.values(ColumnTestType).filter(
        (test) => !excluded.includes(test)
      );
    }
    default:
      return Object.values(ColumnTestType);
  }
};
