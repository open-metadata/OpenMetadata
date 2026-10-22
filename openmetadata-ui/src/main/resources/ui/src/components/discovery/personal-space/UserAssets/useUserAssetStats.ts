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

import { useEffect, useMemo, useRef, useState } from 'react';
import { EntityType } from '../../../../enums/entity.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { User } from '../../../../generated/entity/teams/user';
import { TestCaseResolutionStatus } from '../../../../generated/tests/testCaseResolutionStatus';
import {
  getListTestCaseIncidentStatus,
  IncidentSeverity,
} from '../../../../rest/incidentManagerAPI';
import { searchQuery } from '../../../../rest/searchAPI';
import { getTermQuery } from '../../../../utils/SearchPureUtils';
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

// Batch size for paging through open incidents to count Severity1 accurately.
const INCIDENT_PAGE_SIZE = 100;

// Cap on the owned-table ids used to scope the query count. Queries relate to
// data via `queryUsedIn.id` (the tables they touch), not via ownership, so we
// resolve the user's owned tables first and count queries against those.
const OWNED_TABLES_LIMIT = 1000;

const fetchCountForIndex = async (
  index: SearchIndex,
  queryFilter: Record<string, unknown>
): Promise<number> => {
  try {
    const res = await searchQuery({
      pageNumber: 1,
      pageSize: 0,
      query: '',
      queryFilter,
      searchIndex: index,
    });

    return res.hits?.total?.value ?? 0;
  } catch {
    return 0;
  }
};

const countOfBucket = (
  buckets: Array<{ key: string; doc_count: number }>,
  type: EntityType
): number => buckets.find((bucket) => bucket.key === type)?.doc_count ?? 0;

/**
 * The Owned Assets stat tiles' numbers for one user: owned-asset counts, data
 * health, open incidents assigned to them and queries on their tables.
 */
export const useUserAssetStats = (user: User | undefined) => {
  const [assetStats, setAssetStats] = useState<AssetStats>(ZERO_STATS);
  const [incidentStats, setIncidentStats] =
    useState<IncidentStats>(ZERO_INCIDENT);
  const [queryStats, setQueryStats] = useState<QueryStats>(ZERO_QUERY);
  const [healthStats, setHealthStats] = useState<HealthStats>(ZERO_HEALTH);
  const [isLoading, setIsLoading] = useState(true);

  // Stable key: refire stats only when owner ids change, not object refs.
  const ownerIdsKey = getOwnerIdsKey(user);
  const userId = user?.id;

  // Skips StrictMode's dev-only duplicate effect run for the same key.
  const fetchedKeyRef = useRef<string>();

  useEffect(() => {
    const ownerIds = ownerIdsKey.split(',').filter(Boolean);
    if (ownerIds.length === 0 || fetchedKeyRef.current === ownerIdsKey) {
      return;
    }
    fetchedKeyRef.current = ownerIdsKey;
    setIsLoading(true);
    const filter = getTermQuery(
      { 'owners.id': ownerIds },
      'should',
      1
    ) as Record<string, unknown>;

    // Owned-asset counts — total from hits.total, breakdown from the
    // server's entityType aggregation, all in one dataAsset query.
    const assetsTask = (async () => {
      try {
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
          setAssetStats({ total, tables, dashboards, pipelines });

          return;
        }
        setAssetStats({
          total,
          tables: countOfBucket(buckets, EntityType.TABLE),
          dashboards: countOfBucket(buckets, EntityType.DASHBOARD),
          pipelines: countOfBucket(buckets, EntityType.PIPELINE),
        });
      } catch {
        setAssetStats(ZERO_STATS);
      }
    })();

    // Open Incidents — list assigned to user and count sev1 client-side. The
    // endpoint has no server-side severity aggregation, so page through every
    // open incident via the cursor instead of truncating at the first batch,
    // otherwise the sev1 count under-reports once the user has >1 page open.
    // TODO(backend): add a server-side severity count/aggregation to the
    // testCaseIncidentStatus endpoint so we can fetch the sev1 total in a
    // single request instead of paging through all incidents here.
    const incidentsTask = (async () => {
      try {
        let after: string | undefined;
        let total = 0;
        let severity1 = 0;
        do {
          const res = await getListTestCaseIncidentStatus({
            assignee: userId,
            limit: INCIDENT_PAGE_SIZE,
            latest: true,
            after,
          });
          const items = res.data ?? [];
          total = res.paging?.total ?? total + items.length;
          severity1 += items.filter(
            (r: TestCaseResolutionStatus) =>
              (r.severity as unknown as IncidentSeverity) ===
              IncidentSeverity.Severity1
          ).length;
          // Stop on an empty page even if a cursor is echoed back, so a stale
          // `after` from the backend can't spin this into an infinite loop.
          after = items.length > 0 ? res.paging?.after : undefined;
        } while (after);
        setIncidentStats({ total, severity1 });
      } catch {
        setIncidentStats(ZERO_INCIDENT);
      }
    })();

    // Queries aren't user-owned, so resolve owned tables and count QUERY docs
    // referencing them via `queryUsedIn.id`. Sorting by usage lets the first
    // hit double as the most-viewed table.
    const queriesTask = (async () => {
      try {
        const ownedTablesRes = await searchQuery({
          pageNumber: 1,
          pageSize: OWNED_TABLES_LIMIT,
          query: '',
          queryFilter: filter,
          searchIndex: SearchIndex.TABLE,
          sortField: 'usageSummary.dailyStats.count',
          sortOrder: 'desc',
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
          const queriesByTableFilter = getTermQuery(
            { 'queryUsedIn.id': ownedTableIds },
            'should',
            1
          ) as Record<string, unknown>;
          const queryRes = await searchQuery({
            pageNumber: 1,
            pageSize: 0,
            query: '',
            queryFilter: queriesByTableFilter,
            searchIndex: SearchIndex.QUERY,
          });
          count = queryRes.hits?.total?.value ?? 0;
        }

        const topHit = ownedTableHits[0]?._source;
        setQueryStats({
          count,
          mostViewed: topHit?.displayName ?? topHit?.name ?? '-',
          mostViewedFqn: topHit?.fullyQualifiedName,
        });
      } catch {
        setQueryStats(ZERO_QUERY);
      }
    })();

    // Data Health — count assets that "require attention" (failed tests). The
    // score itself is derived below from owned-asset totals using the same
    // formula as the landing page (healthy / total).
    //
    // `filter` is `{ query: { bool: { should: [...], minimum_should_match: 1 } } }`.
    // Embed it as a nested bool clause so the outer bool stays valid ES.
    const ownerClause = {
      bool: (filter as { query: { bool: Record<string, unknown> } }).query.bool,
    };
    const healthTask = (async () => {
      try {
        const failed = await fetchCountForIndex(SearchIndex.DATA_ASSET, {
          query: {
            bool: {
              must: [
                ownerClause,
                { range: { 'testSuite.summary.failed': { gt: 0 } } },
              ],
            },
          },
        } as Record<string, unknown>);
        setHealthStats({ requireAttention: failed });
      } catch {
        setHealthStats(ZERO_HEALTH);
      }
    })();

    Promise.all([assetsTask, incidentsTask, queriesTask, healthTask]).finally(
      () => setIsLoading(false)
    );
  }, [ownerIdsKey, userId]);

  const assetsRequireAttention = healthStats.requireAttention;
  const healthyAssets = Math.max(assetStats.total - assetsRequireAttention, 0);

  // Mirror the landing page's Platform Health Score formula
  // (healthy / total, clamped 0–100), scoped to the user's owned assets.
  const dataHealthScore = useMemo(() => {
    const denominator = Math.max(assetStats.total, 1);
    const raw = (healthyAssets / denominator) * 100;

    return Math.max(0, Math.min(100, Math.round(raw)));
  }, [assetStats.total, healthyAssets]);

  return {
    assetStats,
    incidentStats,
    queryStats,
    requireAttention: assetsRequireAttention,
    dataHealthScore,
    isLoading,
  };
};
