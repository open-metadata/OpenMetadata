import { isNil } from 'lodash';
import { Bucket } from 'Models';
import React from 'react';
import TableProfilerGraph from '../components/TableProfiler/TableProfilerGraph.component';
import {
  getDatabaseDetailsPath,
  getServiceDetailsPath,
  getTeamDetailsPath,
} from '../constants/constants';
import { EntityType } from '../enums/entity.enum';
import { ServiceCategory } from '../enums/service.enum';
import { Dashboard } from '../generated/entity/data/dashboard';
import { Pipeline } from '../generated/entity/data/pipeline';
import { Table } from '../generated/entity/data/table';
import { Topic } from '../generated/entity/data/topic';
import { TagLabel } from '../generated/type/tagLabel';
import { getPartialNameFromFQN } from './CommonUtils';
import {
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
            serviceType,
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
            serviceType,
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
