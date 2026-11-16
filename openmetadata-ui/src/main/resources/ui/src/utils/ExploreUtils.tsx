/*
 *  Copyright 2023 Collate.
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
import { isEmpty } from 'lodash';
import type { Dispatch, SetStateAction } from 'react';
import {
  ExploreTabItem,
  SearchHitCounts,
} from '../components/Explore/ExplorePage.interface';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { useExploreCache } from '../hooks/useExploreCache';
import { ExploreSearchIndex } from '../interface/discovery/explore.interface';
import { Aggregations, SearchResponse } from '../interface/search.interface';
import {
  QueryFilterInterface,
  TabsInfoData,
} from '../pages/ExplorePage/ExplorePage.interface';
import {
  getAggregateFieldOptions,
  postAggregateFieldOptions,
} from '../rest/miscAPI';
import {
  nlqSearch,
  searchEntityTypeCounts,
  searchQuery,
} from '../rest/searchAPI';
import { getCombinedQueryFilterObject } from './ExplorePage/ExplorePageUtils';
import {
  findActiveSearchIndex,
  isElasticsearchError,
} from './ExplorePureUtils';
import { escapeESReservedCharacters } from './StringUtils';
import { showErrorToast } from './ToastUtils';

export {
  extractTermKeys,
  findActiveSearchIndex,
  findTreeNodeKeyByBrowsePath,
  getAggregations,
  getBrowsePathQueryFilter,
  getCanonicalEntityType,
  getDisabledExploreTreeKeys,
  getExploreQueryFilterMust,
  getParseValueFromLocation,
  getQuickFilterObject,
  getQuickFilterObjectForEntities,
  getQuickFilterQuery,
  getSelectedValuesFromQuickFilter,
  getSubLevelHierarchyKey,
  isElasticsearchError,
  parseBrowsePathFields,
  parseSearchParams,
  truncateBrowsePath,
  updateCountsInTreeData,
  updateTreeData,
  updateTreeDataWithCounts,
} from './ExplorePureUtils';

export const getAggregationOptions = async (
  index: SearchIndex | SearchIndex[],
  key: string,
  value: string,
  filter: string,
  isIndependent: boolean,
  deleted = false,
  size = 10,
  isNLPEnabled = false,
  queryText?: string,
  sourceFields?: string
) => {
  return isIndependent
    ? postAggregateFieldOptions({
        index: Array.isArray(index) ? index.join(',') : index,
        fieldName: key,
        fieldValue: value,
        query: filter,
        ...(queryText ? { queryText } : {}),
        size,
        ...(sourceFields ? { topHits: { size: 1 } } : {}),
      })
    : getAggregateFieldOptions(
        index,
        key,
        value,
        filter,
        sourceFields,
        deleted,
        isNLPEnabled,
        queryText
      );
};

/**
 * Generate tab items for explore page
 */
export const generateTabItems = (
  tabsInfo: Record<string, TabsInfoData>,
  searchHitCounts: SearchHitCounts | undefined
): ExploreTabItem[] =>
  Object.entries(tabsInfo).map(([tabSearchIndex, tabDetail]) => ({
    key: tabSearchIndex,
    label: tabDetail.label,
    icon: tabDetail.icon as ExploreTabItem['icon'],
    iconClassName: tabDetail.iconClassName,
    count: searchHitCounts?.[tabSearchIndex as ExploreSearchIndex] ?? 0,
  }));

/**
 * Common function to fetch entity count and search results
 */
export const fetchEntityData = async ({
  searchQueryParam,
  tabsInfo,
  updatedQuickFilters,
  queryFilter,
  searchIndex,
  showDeleted,
  sortValue,
  sortOrder,
  page,
  size,
  isNLPRequestEnabled,
  tab = '',
  TABS_SEARCH_INDEXES,
  EntityTypeSearchIndexMapping,
  setSearchHitCounts,
  setAutoSelectedSearchIndex,
  setSearchResults,
  setUpdatedAggregations,
  setShowIndexNotFoundAlert,
  onNlqAppliedFilters,
  onResultsSettled,
  showRankingDetails,
}: {
  searchQueryParam: string;
  tabsInfo: Record<ExploreSearchIndex, TabsInfoData>;
  updatedQuickFilters: QueryFilterInterface | undefined;
  queryFilter: unknown;
  searchIndex: ExploreSearchIndex;
  showDeleted?: boolean;
  sortValue: string;
  sortOrder: string;
  page: number;
  size: number;
  isNLPRequestEnabled: boolean;
  tab: string;
  TABS_SEARCH_INDEXES: ExploreSearchIndex[];
  EntityTypeSearchIndexMapping: Record<EntityType, ExploreSearchIndex>;
  setSearchHitCounts: Dispatch<SetStateAction<SearchHitCounts | undefined>>;
  setAutoSelectedSearchIndex: (
    searchIndex: ExploreSearchIndex | undefined
  ) => void;
  setSearchResults: (results: SearchResponse<ExploreSearchIndex>) => void;
  setUpdatedAggregations: (aggs: Aggregations) => void;
  setShowIndexNotFoundAlert: (show: boolean) => void;
  onNlqAppliedFilters?: (filters?: QueryFilterInterface) => void;
  onResultsSettled?: () => void;
  showRankingDetails?: boolean;
}) => {
  const combinedQueryFilter = getCombinedQueryFilterObject(
    updatedQuickFilters,
    queryFilter as QueryFilterInterface
  );

  const isNlqSearch = isNLPRequestEnabled && !isEmpty(searchQueryParam);
  const searchRequest = isNlqSearch ? nlqSearch : searchQuery;

  const runSearchWithoutQueryParam = async () => {
    // If no searchQueryParam, make searchAPICall with current searchIndex
    const searchPayload = {
      query: '',
      searchIndex,
      queryFilter: combinedQueryFilter,
      sortField: sortValue,
      sortOrder: sortOrder,
      pageNumber: page,
      pageSize: size,
      includeDeleted: showDeleted,
      trackTotalHits: true,
      explain: showRankingDetails,
      excludeSourceFields: ['columns', 'queries', 'columnNames', 'dataModel'],
    };

    try {
      const res = await searchRequest(searchPayload);
      setSearchResults(res as SearchResponse<ExploreSearchIndex>);
      setUpdatedAggregations(res.aggregations);
    } catch (error) {
      if (isElasticsearchError(error)) {
        setShowIndexNotFoundAlert(true);
      } else {
        showErrorToast(error as AxiosError);
      }
    }
  };

  try {
    if (searchQueryParam) {
      const countPayload = {
        query: escapeESReservedCharacters(searchQueryParam),
        pageNumber: 1,
        pageSize: 1,
        queryFilter: combinedQueryFilter,
        searchIndex: SearchIndex.DATA_ASSET as const,
        includeDeleted: showDeleted,
        filters: '',
      };
      const normalizedCountPayload = {
        query: countPayload.query,
        queryFilter: combinedQueryFilter,
        searchIndex: TABS_SEARCH_INDEXES,
        includeDeleted: showDeleted,
        includeTopHit: !tab.trim(),
      };
      const runCountSearch = () =>
        isNlqSearch
          ? nlqSearch({ ...countPayload, fetchSource: false })
          : useExploreCache
              .getState()
              .getOrLoad(
                `counts:${JSON.stringify(normalizedCountPayload)}`,
                () => searchEntityTypeCounts(normalizedCountPayload)
              );

      const handleSearchError = (error: unknown) => {
        if (isElasticsearchError(error)) {
          setShowIndexNotFoundAlert(true);
        } else {
          showErrorToast(error as AxiosError);
        }
      };

      let currentCounts: SearchHitCounts | undefined;
      let resultCount: { index: ExploreSearchIndex; total: number } | undefined;
      const publishCounts = () => {
        const latestCounts = currentCounts;
        const activeResultCount = resultCount;
        if (latestCounts || activeResultCount) {
          setSearchHitCounts((previous) => {
            const counts = { ...(latestCounts ?? previous) } as SearchHitCounts;
            if (activeResultCount) {
              counts[activeResultCount.index] = activeResultCount.total;
            }

            return counts;
          });
        }
      };

      const applyHitCounts = (res: SearchResponse<ExploreSearchIndex>) => {
        const buckets = res.aggregations['entityType'].buckets;
        const counts: Record<string, number> = {};
        buckets.forEach((item) => {
          const searchIndexKey =
            item && EntityTypeSearchIndexMapping[item.key as EntityType];

          if (TABS_SEARCH_INDEXES.includes(searchIndexKey)) {
            counts[searchIndexKey ?? ''] = item.doc_count;
          }
        });
        currentCounts = counts as SearchHitCounts;
        publishCounts();

        // The hybrid (NLQ) count query spans the whole dataAsset alias, and OpenSearch's
        // RRF score-ranker-processor is a phase_results_processors entry: it ranks per
        // shard, so every single-shard member contributes its own rank-1 document and two
        // dozen of them tie on an identical fused score. hits[0] is then arbitrary and
        // carries no relevance signal, so only the aggregation counts below are usable.
        // Plain BM25 ranks globally, so its top hit remains a valid tie-breaker.
        const topHitEntityType = isNlqSearch
          ? undefined
          : res.hits.hits[0]?._source?.entityType;
        const topHitSearchIndex = topHitEntityType
          ? EntityTypeSearchIndexMapping[topHitEntityType as EntityType]
          : undefined;

        return {
          counts: counts as SearchHitCounts,
          topHitSearchIndex:
            topHitSearchIndex && TABS_SEARCH_INDEXES.includes(topHitSearchIndex)
              ? topHitSearchIndex
              : undefined,
        };
      };

      const runResultsSearch = async (
        effectiveSearchIndex: ExploreSearchIndex
      ) => {
        const updatedSearchPayload = {
          query: !isEmpty(searchQueryParam)
            ? escapeESReservedCharacters(searchQueryParam)
            : '',
          searchIndex: effectiveSearchIndex,
          queryFilter: combinedQueryFilter,
          sortField: sortValue,
          sortOrder: sortOrder,
          pageNumber: page,
          pageSize: size,
          includeDeleted: showDeleted,
          // Results query backs the count badge and pagination total
          // (searchResults.hits.total.value); without this ES caps it at 10000.
          trackTotalHits: true,
          explain: showRankingDetails,
          excludeSourceFields: [
            'columns',
            'queries',
            'columnNames',
            'dataModel',
          ],
        };

        try {
          const searchRes = await searchRequest(updatedSearchPayload);
          setSearchResults(searchRes as SearchResponse<ExploreSearchIndex>);
          setUpdatedAggregations(searchRes.aggregations);
          // A write can land inside the count-cache TTL. The visible tab must always
          // show the total returned with its rows, whichever request finishes first.
          resultCount = {
            index: effectiveSearchIndex,
            total: searchRes.hits.total.value,
          };
          publishCounts();

          // For NLQ searches, surface the backend-detected filters so the Explore
          // filters tab can mark them. Non-NLQ responses omit applied_quick_filters.
          if (searchRequest === nlqSearch) {
            onNlqAppliedFilters?.(
              (searchRes as SearchResponse<ExploreSearchIndex>)
                .applied_quick_filters
            );
          }
        } catch (error) {
          handleSearchError(error);
        } finally {
          onResultsSettled?.();
        }
      };

      const hasExplicitTab = Boolean(tab && tab.trim() !== '');

      if (hasExplicitTab) {
        // The active tab fixes the results index, so it does not depend on the
        // count response — run both concurrently to avoid serializing two
        // round-trips. Each leg handles its own error (a failed count still
        // lets results render, and vice-versa).
        await Promise.all([
          runCountSearch()
            .then((res) =>
              applyHitCounts(res as SearchResponse<ExploreSearchIndex>)
            )
            .catch(handleSearchError),
          runResultsSearch(searchIndex),
        ]);
      } else {
        // No tab: the count decides which index actually has results, so the
        // count must complete before the results query can be issued.
        try {
          const { counts, topHitSearchIndex } = applyHitCounts(
            (await runCountSearch()) as SearchResponse<ExploreSearchIndex>
          );
          const effectiveSearchIndex =
            findActiveSearchIndex(counts, tabsInfo, topHitSearchIndex) ||
            searchIndex;
          setAutoSelectedSearchIndex(effectiveSearchIndex);
          await runResultsSearch(effectiveSearchIndex);
        } catch (error) {
          handleSearchError(error);
        }
      }
    } else {
      await runSearchWithoutQueryParam();
    }

    return true;
  } catch (error) {
    showErrorToast(error as AxiosError);

    return false;
  }
};
