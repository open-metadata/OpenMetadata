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

import { Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty, isNil, lowerCase } from 'lodash';
import React from 'react';
import {
  ExploreSearchIndex,
  SearchHitCounts,
} from '../components/Explore/ExplorePage.interface';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { Aggregations, SearchResponse } from '../interface/search.interface';
import {
  QueryFilterInterface,
  TabsInfoData,
} from '../pages/ExplorePage/ExplorePage.interface';
import {
  getAggregateFieldOptions,
  postAggregateFieldOptions,
} from '../rest/miscAPI';
import { nlqSearch, searchQuery } from '../rest/searchAPI';
import { getCountBadge } from './EntityDisplayUtils';
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
  getAggregations,
  getExploreQueryFilterMust,
  getParseValueFromLocation,
  getQuickFilterObject,
  getQuickFilterObjectForEntities,
  getQuickFilterQuery,
  getSelectedValuesFromQuickFilter,
  getSubLevelHierarchyKey,
  isElasticsearchError,
  parseSearchParams,
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
  // sourceFields is only supported in non-independent mode; postAggregateFieldOptions
  // (independent mode) uses SearchRequest which does not have a sourceFields field.
  sourceFields?: string
) => {
  return isIndependent
    ? postAggregateFieldOptions({
        index: Array.isArray(index) ? index.join(',') : index,
        fieldName: key,
        fieldValue: value,
        query: filter,
        size,
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
  searchHitCounts: SearchHitCounts | undefined,
  searchIndex: ExploreSearchIndex
) => {
  return Object.entries(tabsInfo).map(([tabSearchIndex, tabDetail]) => {
    const Icon = tabDetail.icon as React.FC<{ className?: string }>;

    return {
      key: tabSearchIndex,
      label: (
        <div
          className="d-flex items-center justify-between"
          data-testid={`${lowerCase(tabDetail.label)}-tab`}>
          <div className="explore-tab-label">
            <span className="explore-icon d-flex m-r-xs">
              <Icon
                className={classNames(tabDetail.iconClassName, {
                  'text-primary': tabSearchIndex === searchIndex,
                })}
              />
            </span>
            <Typography.Text
              className={tabSearchIndex === searchIndex ? 'text-primary' : ''}
              ellipsis={{ tooltip: true }}>
              {tabDetail.label}
            </Typography.Text>
          </div>
          <span>
            {!isNil(searchHitCounts)
              ? getCountBadge(
                  searchHitCounts[tabSearchIndex as ExploreSearchIndex],
                  '',
                  tabSearchIndex === searchIndex
                )
              : getCountBadge()}
          </span>
        </div>
      ),
      count: searchHitCounts
        ? searchHitCounts[tabSearchIndex as ExploreSearchIndex]
        : 0,
    };
  });
};

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
  tab,
  TABS_SEARCH_INDEXES,
  EntityTypeSearchIndexMapping,
  setSearchHitCounts,
  setSearchResults,
  setUpdatedAggregations,
  setShowIndexNotFoundAlert,
  onNlqAppliedFilters,
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
  setSearchHitCounts: (counts: SearchHitCounts) => void;
  setSearchResults: (results: SearchResponse<ExploreSearchIndex>) => void;
  setUpdatedAggregations: (aggs: Aggregations) => void;
  setShowIndexNotFoundAlert: (show: boolean) => void;
  onNlqAppliedFilters?: (filters?: QueryFilterInterface) => void;
}) => {
  const combinedQueryFilter = getCombinedQueryFilterObject(
    updatedQuickFilters,
    queryFilter as QueryFilterInterface
  );

  const searchRequest =
    isNLPRequestEnabled && !isEmpty(searchQueryParam) ? nlqSearch : searchQuery;

  try {
    if (searchQueryParam) {
      const countPayload = {
        query: escapeESReservedCharacters(searchQueryParam),
        pageNumber: 0,
        pageSize: 0,
        queryFilter: combinedQueryFilter,
        searchIndex: SearchIndex.DATA_ASSET,
        includeDeleted: showDeleted,
        trackTotalHits: true,
        fetchSource: false,
        filters: '',
      };

      // First make countAPICall
      try {
        const res = await searchRequest(countPayload);
        const buckets = res.aggregations['entityType'].buckets;
        const counts: Record<string, number> = {};

        buckets.forEach((item) => {
          const searchIndexKey =
            item && EntityTypeSearchIndexMapping[item.key as EntityType];

          if (TABS_SEARCH_INDEXES.includes(searchIndexKey)) {
            counts[searchIndexKey ?? ''] = item.doc_count;
          }
        });

        // Update searchHitCounts
        setSearchHitCounts(counts as SearchHitCounts);

        // Determine which searchIndex to use
        let effectiveSearchIndex = searchIndex;

        // If tab is not specified, determine it from searchHitCounts
        if (!tab || tab.trim() === '') {
          const determinedSearchIndex = findActiveSearchIndex(
            counts as SearchHitCounts,
            tabsInfo
          );
          if (determinedSearchIndex) {
            effectiveSearchIndex = determinedSearchIndex;
          }
        }

        // Now make searchAPICall with the effective searchIndex
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
          excludeSourceFields: ['columns', 'queries', 'columnNames'],
        };

        try {
          const searchRes = await searchRequest(updatedSearchPayload);
          setSearchResults(searchRes as SearchResponse<ExploreSearchIndex>);
          setUpdatedAggregations(searchRes.aggregations);

          // For NLQ searches, surface the backend-detected filters so the Explore
          // filters tab can mark them. Non-NLQ responses omit applied_quick_filters.
          if (searchRequest === nlqSearch) {
            onNlqAppliedFilters?.(
              (searchRes as SearchResponse<ExploreSearchIndex>)
                .applied_quick_filters
            );
          }
        } catch (error) {
          if (isElasticsearchError(error)) {
            setShowIndexNotFoundAlert(true);
          } else {
            showErrorToast(error as AxiosError);
          }
        }
      } catch (error) {
        if (isElasticsearchError(error)) {
          setShowIndexNotFoundAlert(true);
        } else {
          showErrorToast(error as AxiosError);
        }
      }
    } else {
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
        excludeSourceFields: ['columns', 'queries', 'columnNames'],
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
    }

    return true;
  } catch (error) {
    showErrorToast(error as AxiosError);

    return false;
  }
};
