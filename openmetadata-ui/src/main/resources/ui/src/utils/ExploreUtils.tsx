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
import { get, isEmpty, isNil, isString, isUndefined, lowerCase } from 'lodash';
import Qs from 'qs';
import React from 'react';
import {
  ExploreQuickFilterField,
  ExploreSearchIndex,
  SearchHitCounts,
} from '../components/Explore/ExplorePage.interface';
import {
  DatabaseFields,
  ExploreTreeNode,
} from '../components/Explore/ExploreTree/ExploreTree.interface';
import { SearchDropdownOption } from '../components/SearchDropdown/SearchDropdown.interface';
import { NULL_OPTION_KEY } from '../constants/AdvancedSearch.constants';
import {
  ES_EXCEPTION_SHARDS_FAILED,
  FAILED_TO_FIND_INDEX_ERROR,
  INITIAL_SORT_FIELD,
} from '../constants/explore.constants';
import { EntityFields } from '../enums/AdvancedSearch.enum';
import { SORT_ORDER } from '../enums/common.enum';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import {
  Aggregations,
  Bucket,
  SearchResponse,
} from '../interface/search.interface';
import {
  EsBoolQuery,
  QueryFieldInterface,
  QueryFilterInterface,
  TabsInfoData,
} from '../pages/ExplorePage/ExplorePage.interface';
import {
  getAggregateFieldOptions,
  postAggregateFieldOptions,
} from '../rest/miscAPI';
import { nlqSearch, searchQuery } from '../rest/searchAPI';
import { getCountBadge } from './CommonUtils';
import { getCombinedQueryFilterObject } from './ExplorePage/ExplorePageUtils';
import { t } from './i18next/LocalUtil';
import { escapeESReservedCharacters } from './StringsUtils';
import { showErrorToast } from './ToastUtils';

/**
 * It takes an array of filters and a data lookup and returns a new object with the filters grouped by
 * their label
 * @param filters - Array<QueryFieldInterface>
 * @param {SearchDropdownOption[]} dataLookUp - This is an array of objects that contains the
 * key and label for each filter.
 */
export const getParseValueFromLocation = (
  filters: Array<QueryFieldInterface>,
  dataLookUp: SearchDropdownOption[]
): Record<string, SearchDropdownOption[]> => {
  const dataLookupMap = new Map(
    dataLookUp.map((option) => [option.key, option])
  );
  const result: Record<string, SearchDropdownOption[]> = {};

  for (const filter of filters) {
    let key = '';
    let value = '';
    let customLabel = false;
    if (filter.term) {
      key = Object.keys(filter.term)[0];
      value = filter.term[key] as string;
    } else {
      key =
        (filter?.bool?.must_not as QueryFieldInterface)?.exists?.field ?? '';
      value = NULL_OPTION_KEY;
      customLabel = true;
    }

    const dataCategory = dataLookupMap.get(key);

    if (dataCategory) {
      result[dataCategory.label] = result[dataCategory.label] || [];
      result[dataCategory.label].push({
        key: value,
        label: !customLabel
          ? value
          : t('label.no-entity', {
              entity: dataCategory.label,
            }),
      });
    }
  }

  return result;
};

/**
 * It takes queryFilter object as input and returns a parsed array of search dropdown options with selected values
 * @param dropdownItems - SearchDropdownOption[]
 * @param queryFilter - QueryFilterInterface
 */
export const getSelectedValuesFromQuickFilter = (
  dropdownItems: SearchDropdownOption[],
  queryFilter?: QueryFilterInterface
) => {
  if (!queryFilter) {
    return null;
  }

  const mustFilters: Array<QueryFieldInterface> = get(
    queryFilter,
    'query.bool.must',
    []
  ).flatMap((item: QueryFieldInterface) => item.bool?.should || []);
  const combinedData: Record<string, SearchDropdownOption[]> = {};

  dropdownItems.forEach((item) => {
    const data = getParseValueFromLocation(mustFilters, [item]);
    combinedData[item.label] = data[item.label] || [];
  });

  return combinedData;
};

export const findActiveSearchIndex = (
  obj: SearchHitCounts,
  tabsData: Record<ExploreSearchIndex, TabsInfoData>
): ExploreSearchIndex | null => {
  const keysInOrder = Object.keys(tabsData) as ExploreSearchIndex[];
  const filteredKeys = keysInOrder.filter((key) => obj[key] > 0);

  return filteredKeys.length > 0 ? filteredKeys[0] : null;
};

export const getAggregations = (data: Aggregations) => {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key.replace('sterms#', ''),
      value,
    ])
  ) as Aggregations;
};

/**
 * Generates a ElasticSearch Query filter based on the given data.
 *
 * @param {ExploreQuickFilterField[]} data - An array of ExploreQuickFilterField objects representing the filter data.
 * @return {object} - The generated quick filter query.
 */
export const getQuickFilterQuery = (data: ExploreQuickFilterField[]) => {
  const must: QueryFieldInterface[] = [];
  data.forEach((filter) => {
    if (!isEmpty(filter.value)) {
      const should: QueryFieldInterface[] = [];
      if (filter.value) {
        filter.value.forEach((filterValue) => {
          const term: Record<string, string> = {};
          term[filter.key] = filterValue.key;
          should.push({ term });
        });
      }

      must.push({
        bool: { should },
      });
    }
  });

  const quickFilterQuery = isEmpty(must)
    ? undefined
    : {
        query: { bool: { must } },
      };

  return quickFilterQuery;
};

export const extractTermKeys = (objects: QueryFieldInterface[]): string[] => {
  const termKeys: string[] = [];

  objects.forEach((obj: QueryFieldInterface) => {
    if (obj.term) {
      const keys = Object.keys(obj.term);
      termKeys.push(...keys);
    }
  });

  return termKeys;
};

export const getSubLevelHierarchyKey = (
  isDatabaseHierarchy = false,
  filterField?: ExploreQuickFilterField[],
  key?: EntityFields,
  value?: string
) => {
  const queryFilter = {
    query: { bool: {} },
  };

  if ((key && value) || filterField) {
    (queryFilter.query.bool as EsBoolQuery).must = isUndefined(filterField)
      ? { term: { [key ?? '']: value } }
      : getExploreQueryFilterMust(filterField);
  }

  const bucketMapping = isDatabaseHierarchy
    ? {
        [EntityFields.SERVICE_TYPE]: EntityFields.SERVICE,
        [EntityFields.SERVICE]: EntityFields.DATABASE_DISPLAY_NAME,
        [EntityFields.DATABASE_DISPLAY_NAME]:
          EntityFields.DATABASE_SCHEMA_DISPLAY_NAME,
        [EntityFields.DATABASE_SCHEMA_DISPLAY_NAME]: EntityFields.ENTITY_TYPE,
      }
    : {
        [EntityFields.SERVICE_TYPE]: EntityFields.SERVICE,
        [EntityFields.SERVICE]: EntityFields.ENTITY_TYPE,
      };

  return {
    bucket: bucketMapping[key as DatabaseFields] ?? EntityFields.SERVICE_TYPE,
    queryFilter,
  };
};

export const getExploreQueryFilterMust = (data: ExploreQuickFilterField[]) => {
  const must = [] as Array<QueryFieldInterface>;

  // Mapping the selected advanced search quick filter dropdown values
  // to form a queryFilter to pass as a search parameter
  data.forEach((filter) => {
    if (!isEmpty(filter.value)) {
      const should = [] as Array<QueryFieldInterface>;
      filter.value?.forEach((filterValue) => {
        const term = {
          [filter.key]: filterValue.key,
        };

        if (filterValue.key === NULL_OPTION_KEY) {
          should.push({
            bool: {
              must_not: { exists: { field: filter.key } },
            },
          });
        } else {
          should.push({ term });
        }
      });

      if (should.length > 0) {
        must.push({ bool: { should } });
      }
    }
  });

  return must;
};

export const updateTreeData = (
  list: ExploreTreeNode[],
  key: React.Key,
  children: ExploreTreeNode[]
): ExploreTreeNode[] =>
  list.map((node) => {
    if (node.key === key) {
      return {
        ...node,
        children,
      };
    }
    if (node.children) {
      return {
        ...node,
        children: updateTreeData(node.children, key, children),
      };
    }

    return node;
  });

export const updateCountsInTreeData = (
  list: ExploreTreeNode[],
  key: React.Key,
  count: number
): ExploreTreeNode[] =>
  list.map((node) => {
    if (node.key === key) {
      return {
        ...node,
        count: count ?? 0,
      };
    }
    if (node.children) {
      return {
        ...node,
        children: updateCountsInTreeData(node.children, key, count),
      };
    }

    return node;
  });

export const getQuickFilterObject = (
  bucketKey: EntityFields,
  bucketValue: string
) => {
  return {
    label: bucketKey,
    key: bucketKey,
    value: [
      {
        key: bucketValue,
        label: bucketValue,
      },
    ],
  };
};

export const getQuickFilterObjectForEntities = (
  bucketKey: EntityFields,
  bucketValues: EntityType[]
) => {
  return {
    label: bucketKey,
    key: bucketKey,
    value: bucketValues.map((value) => ({
      key: value,
      label: value,
    })),
  };
};

export const getAggregationOptions = async (
  index: SearchIndex | SearchIndex[],
  key: string,
  value: string,
  filter: string,
  isIndependent: boolean
) => {
  return isIndependent
    ? postAggregateFieldOptions(index, key, value, filter)
    : getAggregateFieldOptions(index, key, value, filter);
};

export const updateTreeDataWithCounts = (
  exploreTreeNodes: ExploreTreeNode[],
  entityCounts: Bucket[]
) => {
  return exploreTreeNodes.map((node) => {
    if ((node.data?.childEntities ?? []).length > 0) {
      let totalCount = 0;
      node.data?.childEntities?.forEach((child) => {
        const count = entityCounts.find(
          (count) => count.key === child
        )?.doc_count;
        totalCount += count ?? 0;
      });
      node.totalCount = totalCount;
    }

    if (node.children) {
      let totalCount = 0;
      node.children.forEach((child) => {
        const count = entityCounts.find(
          (count) => count.key === child.key
        )?.doc_count;
        child.count = count ?? 0;
        totalCount += child.count;
      });
      node.totalCount = totalCount;
    }

    return node;
  });
};

/**
 * Checks if an error is an Elasticsearch error
 */
export const isElasticsearchError = (error: unknown): boolean => {
  if (!error) {
    return false;
  }

  const axiosError = error as AxiosError;
  if (!axiosError.response?.data) {
    return false;
  }

  const data = axiosError.response.data as Record<string, any>;
  const message = data.message as string;

  return (
    !!message &&
    (message.includes(FAILED_TO_FIND_INDEX_ERROR) ||
      message.includes(ES_EXCEPTION_SHARDS_FAILED))
  );
};

/**
 * Parse search parameters from URL query
 */
export const parseSearchParams = (
  search: string,
  globalPageSize: number,
  queryFilter?: Record<string, unknown>
) => {
  const parsedSearch = Qs.parse(
    search.startsWith('?') ? search.substring(1) : search
  );

  const searchQueryParam = isString(parsedSearch.search)
    ? parsedSearch.search
    : '';

  const sortValue = isString(parsedSearch.sort)
    ? parsedSearch.sort
    : INITIAL_SORT_FIELD;

  const sortOrder = isString(parsedSearch.sortOrder)
    ? parsedSearch.sortOrder
    : SORT_ORDER.DESC;

  const page =
    isString(parsedSearch.page) && !isNaN(Number.parseInt(parsedSearch.page))
      ? Number.parseInt(parsedSearch.page)
      : 1;

  const size =
    isString(parsedSearch.size) && !isNaN(Number.parseInt(parsedSearch.size))
      ? Number.parseInt(parsedSearch.size)
      : globalPageSize;

  const stringifiedQueryFilter = isEmpty(queryFilter)
    ? ''
    : JSON.stringify(queryFilter);
  const queryFilterContainsDeleted =
    stringifiedQueryFilter.includes('"deleted":');

  // Since the 'Deleted' field in the queryFilter conflicts with the 'showDeleted' parameter,
  // We are giving priority to the 'Deleted' field in the queryFilter if it exists.
  // If not there in the queryFilter, use the 'showDeleted' parameter from the URL.
  const showDeleted = queryFilterContainsDeleted
    ? undefined
    : parsedSearch.showDeleted === 'true';

  return {
    parsedSearch,
    searchQueryParam,
    sortValue,
    sortOrder,
    page,
    size,
    showDeleted,
  };
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
    const Icon = tabDetail.icon as React.FC;

    return {
      key: tabSearchIndex,
      label: (
        <div
          className="d-flex items-center justify-between"
          data-testid={`${lowerCase(tabDetail.label)}-tab`}>
          <div className="explore-tab-label">
            <span className="explore-icon d-flex m-r-xs">
              <Icon />
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
          excludeSourceFields: ['columns'],
        };

        try {
          const searchRes = await searchRequest(updatedSearchPayload);
          setSearchResults(searchRes as SearchResponse<ExploreSearchIndex>);
          setUpdatedAggregations(searchRes.aggregations);
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
        excludeSourceFields: ['columns'],
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
