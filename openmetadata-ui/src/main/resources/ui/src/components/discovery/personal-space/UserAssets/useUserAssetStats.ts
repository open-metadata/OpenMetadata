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

import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { EntityType } from '../../../../enums/entity.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { User } from '../../../../generated/entity/teams/user';
import {
  Severities,
  TestCaseResolutionStatus,
} from '../../../../generated/tests/testCaseResolutionStatus';
import { getListTestCaseIncidentStatus } from '../../../../rest/incidentManagerAPI';
import { searchQuery } from '../../../../rest/searchAPI';
import { getTermQuery } from '../../../../utils/SearchPureUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import {
  INCIDENT_MAX_PAGES,
  INCIDENT_PAGE_SIZE,
  OWNED_TABLES_LIMIT,
} from './UserAssets.constants';
import { getOwnerIdsKey } from './UserAssets.utils';

export interface AssetStats {
  total: number;
  tables: number;
  dashboards: number;
  pipelines: number;
}

interface IncidentStats {
  total: number;
  severity1: number;
}

interface QueryStats {
  count: number;
  // The owned-table cap was reached, so `count` is a lower bound.
  isPartial?: boolean;
  mostViewed: string;
  // FQN of the most-viewed table so the subtitle can link to its details page.
  mostViewedFqn?: string;
}

interface HealthStats {
  requireAttention: number;
}

const ZERO_STATS: AssetStats = {
  total: 0,
  tables: 0,
  dashboards: 0,
  pipelines: 0,
};

const ZERO_INCIDENT: IncidentStats = { total: 0, severity1: 0 };
const ZERO_QUERY: QueryStats = { count: 0, mostViewed: '-' };
const ZERO_HEALTH: HealthStats = { requireAttention: 0 };

const fetchCountForIndex = async (
  index: SearchIndex,
  queryFilter: Record<string, unknown>
): Promise<number> => {
  const res = await searchQuery({
    pageNumber: 1,
    pageSize: 0,
    query: '',
    queryFilter,
    searchIndex: index,
  });

  return res.hits?.total?.value ?? 0;
};

const countOfBucket = (
  buckets: Array<{ key: string; doc_count: number }>,
  type: EntityType
): number => buckets.find((bucket) => bucket.key === type)?.doc_count ?? 0;

/**
 * The Owned Assets stat tiles' numbers for one user: owned-asset counts, data
 * health, open incidents assigned to them and queries on their tables.
 */
const NO_FAILURES = {
  assets: false,
  incidents: false,
  queries: false,
  health: false,
};

export const useUserAssetStats = (user: User | undefined) => {
  const [assetStats, setAssetStats] = useState<AssetStats>(ZERO_STATS);
  const [incidentStats, setIncidentStats] =
    useState<IncidentStats>(ZERO_INCIDENT);
  const [queryStats, setQueryStats] = useState<QueryStats>(ZERO_QUERY);
  const [healthStats, setHealthStats] = useState<HealthStats>(ZERO_HEALTH);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  // Per tile, so one denied or failing request doesn't hide the others.
  const [failed, setFailed] = useState(NO_FAILURES);
  const [reloadKey, setReloadKey] = useState(0);

  const ownerIdsKey = getOwnerIdsKey(user);
  // Incidents are assigned by user name, not id.
  const userName = user?.name;

  useEffect(() => {
    const ownerIds = ownerIdsKey.split(',').filter(Boolean);
    if (ownerIds.length === 0) {
      setIsLoading(false);

      return;
    }
    // A user switch must not let the previous user's slow responses land.
    let cancelled = false;
    setIsLoading(true);
    setError(undefined);
    setFailed(NO_FAILURES);
    const filter = getTermQuery(
      { 'owners.id': ownerIds },
      'should',
      1
    ) as Record<string, unknown>;

    // Owned-asset counts — total from hits.total, breakdown from the
    // server's entityType aggregation, all in one dataAsset query.
    const assetsTask = async (): Promise<AssetStats> => {
      const res = await searchQuery({
        pageNumber: 1,
        pageSize: 0,
        query: '',
        queryFilter: filter,
        searchIndex: SearchIndex.DATA_ASSET,
      });
      const total = res.hits?.total?.value ?? 0;
      const buckets: Array<{ key: string; doc_count: number }> =
        res.aggregations?.entityType?.buckets ?? [];
      if (total > 0 && buckets.length === 0) {
        // Aggregation missing from the response — fall back to per-index
        // counts so the breakdown doesn't silently render as zeros.
        const [tables, dashboards, pipelines] = await Promise.all([
          fetchCountForIndex(SearchIndex.TABLE, filter),
          fetchCountForIndex(SearchIndex.DASHBOARD, filter),
          fetchCountForIndex(SearchIndex.PIPELINE, filter),
        ]);

        return { total, tables, dashboards, pipelines };
      }

      return {
        total,
        tables: countOfBucket(buckets, EntityType.TABLE),
        dashboards: countOfBucket(buckets, EntityType.DASHBOARD),
        pipelines: countOfBucket(buckets, EntityType.PIPELINE),
      };
    };

    // Open Incidents — list assigned to user and count sev1 client-side,
    // paging through every open incident so the sev1 count doesn't
    // under-report once the user has more than one page open.
    // TODO(backend): the testCaseIncidentStatus list endpoint has no severity
    // count, so Severity1 is counted here page by page (capped at
    // INCIDENT_MAX_PAGES). Replace with a single request once it offers one.
    const incidentsTask = async (): Promise<IncidentStats> => {
      if (!userName) {
        return ZERO_INCIDENT;
      }
      let offset: string | undefined;
      let total = 0;
      let severity1 = 0;
      let pages = 0;
      do {
        const res = await getListTestCaseIncidentStatus({
          assignee: userName,
          limit: INCIDENT_PAGE_SIZE,
          latest: true,
          offset,
        });
        const items = res.data ?? [];
        total = res.paging?.total ?? total + items.length;
        severity1 += items.filter(
          (r: TestCaseResolutionStatus) => r.severity === Severities.Severity1
        ).length;
        // Stop on an empty page even if a cursor is echoed back, so a stale
        // cursor from the backend can't spin this into an infinite loop.
        offset = items.length > 0 ? res.paging?.after : undefined;
        pages++;
      } while (offset && pages < INCIDENT_MAX_PAGES);

      return { total, severity1 };
    };

    // Queries aren't user-owned, so resolve owned tables and count QUERY docs
    // referencing them via `queryUsedIn.id`. Sorting by usage lets the first
    // hit double as the most-viewed table.
    const queriesTask = async (): Promise<QueryStats> => {
      const ownedTablesRes = await searchQuery({
        pageNumber: 1,
        pageSize: OWNED_TABLES_LIMIT,
        query: '',
        queryFilter: filter,
        searchIndex: SearchIndex.TABLE,
        sortField: 'usageSummary.dailyStats.count',
        sortOrder: 'desc',
        fetchSource: true,
        includeFields: ['id', 'name', 'displayName', 'fullyQualifiedName'],
      });

      const ownedTableHits: Array<{
        _source?: {
          id?: string;
          displayName?: string;
          name?: string;
          fullyQualifiedName?: string;
        };
      }> = ownedTablesRes.hits?.hits ?? [];
      const ownedTableIds = ownedTableHits
        .map((hit) => hit._source?.id)
        .filter(Boolean) as string[];

      let count = 0;
      if (ownedTableIds.length > 0) {
        // One `terms` clause keeps the GET URL about half the size of a
        // `term` per id.
        count = await fetchCountForIndex(SearchIndex.QUERY, {
          query: { terms: { 'queryUsedIn.id': ownedTableIds } },
        });
      }

      const topHit = ownedTableHits[0]?._source;

      return {
        count,
        isPartial: ownedTableIds.length >= OWNED_TABLES_LIMIT,
        mostViewed: topHit?.displayName ?? topHit?.name ?? '-',
        mostViewedFqn: topHit?.fullyQualifiedName,
      };
    };

    // Data Health — count assets that "require attention" (failed tests). The
    // score itself is derived below from owned-asset totals using the same
    // formula as the landing page (healthy / total).
    //
    // `filter` is `{ query: { bool: { should: [...], minimum_should_match: 1 } } }`.
    // Embed it as a nested bool clause so the outer bool stays valid ES.
    const ownerClause = {
      bool: (filter as { query: { bool: Record<string, unknown> } }).query.bool,
    };
    const healthTask = async (): Promise<HealthStats> => ({
      requireAttention: await fetchCountForIndex(SearchIndex.DATA_ASSET, {
        query: {
          bool: {
            must: [
              ownerClause,
              { range: { 'testSuite.summary.failed': { gt: 0 } } },
            ],
          },
        },
      } as Record<string, unknown>),
    });

    Promise.allSettled([
      assetsTask(),
      incidentsTask(),
      queriesTask(),
      healthTask(),
    ]).then(([assets, incidents, queries, health]) => {
      if (cancelled) {
        return;
      }
      setAssetStats(assets.status === 'fulfilled' ? assets.value : ZERO_STATS);
      setIncidentStats(
        incidents.status === 'fulfilled' ? incidents.value : ZERO_INCIDENT
      );
      setQueryStats(
        queries.status === 'fulfilled' ? queries.value : ZERO_QUERY
      );
      setHealthStats(
        health.status === 'fulfilled' ? health.value : ZERO_HEALTH
      );
      setFailed({
        assets: assets.status === 'rejected',
        incidents: incidents.status === 'rejected',
        queries: queries.status === 'rejected',
        // The score is computed against the owned-asset total.
        health: health.status === 'rejected' || assets.status === 'rejected',
      });
      const failure = [assets, incidents, queries, health].find(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected'
      );
      if (failure) {
        setError(failure.reason);
        showErrorToast(failure.reason as AxiosError);
      }
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [ownerIdsKey, userName, reloadKey]);

  const assetsRequireAttention = healthStats.requireAttention;
  const healthyAssets = Math.max(assetStats.total - assetsRequireAttention, 0);
  // Mirror the landing page's Platform Health Score formula
  // (healthy / total, clamped 0–100), scoped to the user's owned assets.
  const dataHealthScore = Math.max(
    0,
    Math.min(
      100,
      Math.round((healthyAssets / Math.max(assetStats.total, 1)) * 100)
    )
  );

  return {
    assetStats,
    incidentStats,
    queryStats,
    requireAttention: assetsRequireAttention,
    dataHealthScore,
    isLoading,
    error,
    failed,
    refetch: () => setReloadKey((key) => key + 1),
  };
};
