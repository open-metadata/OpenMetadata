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
import type { AxiosError } from 'axios';
import { get, isEmpty, isString, isUndefined } from 'lodash';
import type { Bucket } from 'Models';
import Qs from 'qs';
import type { Key } from 'react';
import type {
  ExploreQuickFilterField,
  ExploreSearchIndex,
  SearchHitCounts,
} from '../components/Explore/ExplorePage.interface';
import type {
  DatabaseFields,
  ExploreTreeNode,
} from '../components/Explore/ExploreTree/ExploreTree.interface';
import type { SearchDropdownOption } from '../components/SearchDropdown/SearchDropdown.interface';
import { NULL_OPTION_KEY } from '../constants/AdvancedSearch.constants';
import {
  ES_EXCEPTION_SHARDS_FAILED,
  FAILED_TO_FIND_INDEX_ERROR,
  INITIAL_SORT_FIELD,
} from '../constants/explore.constants';
import { EntityFields } from '../enums/AdvancedSearch.enum';
import { SORT_ORDER } from '../enums/common.enum';
import { EntityType } from '../enums/entity.enum';
import type { Aggregations } from '../interface/search.interface';
import type {
  EsBoolQuery,
  QueryFieldInterface,
  QueryFilterInterface,
  TabsInfoData,
} from '../pages/ExplorePage/ExplorePage.interface';
import { t, translateWithNestedKeys } from './i18next/LocalUtil';

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
              entity: translateWithNestedKeys(
                dataCategory.label,
                dataCategory.labelKeyOptions
              ),
            }),
      });
    }
  }

  return result;
};

export const getSelectedValuesFromQuickFilter = (
  dropdownItems: SearchDropdownOption[],
  queryFilter?: QueryFilterInterface
) => {
  if (!queryFilter) {
    return null;
  }

  const mustFilters: Array<QueryFieldInterface> = (
    get(queryFilter, 'query.bool.must', []) as QueryFieldInterface[]
  ).flatMap(
    (item: QueryFieldInterface) =>
      (item.bool?.should || []) as QueryFieldInterface[]
  );
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

export const getExploreQueryFilterMust = (data: ExploreQuickFilterField[]) => {
  const must = [] as Array<QueryFieldInterface>;

  data.forEach((filter) => {
    if (!isEmpty(filter.value)) {
      const should = [] as Array<QueryFieldInterface>;

      const queryFieldKey =
        filter.key === EntityFields.ENTITY_TYPE
          ? EntityFields.ENTITY_TYPE_KEYWORD
          : filter.key;

      const shouldLowerCase = filter.key === EntityFields.ENTITY_TYPE;

      filter.value?.forEach((filterValue) => {
        const termValue = shouldLowerCase
          ? filterValue.key.toLowerCase()
          : filterValue.key;

        const term = {
          [queryFieldKey]: termValue,
        };

        if (filterValue.key === NULL_OPTION_KEY) {
          should.push({
            bool: {
              must_not: { exists: { field: queryFieldKey } },
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

export const updateTreeData = (
  list: ExploreTreeNode[],
  key: Key,
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
  key: Key,
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
 * Given the explore tree root nodes and the entity types selected in the Data
 * Assets filter, return the set of root keys whose service category contains
 * none of the selected entity types. Those roots are grayed out so the user
 * cannot browse into services that can't hold the selected asset type — e.g.
 * selecting "Table" disables every non-Database service, since a table only
 * belongs to a Database Service. An empty selection disables nothing.
 */
export const getDisabledExploreTreeKeys = (
  treeNodes: ExploreTreeNode[],
  selectedEntityTypes: string[]
): Set<string> => {
  const disabledKeys = new Set<string>();
  if (!isEmpty(selectedEntityTypes)) {
    // Compare case-insensitively: a few entity types are aggregated in a
    // different case than their EntityType enum value (e.g. tableColumn), and
    // no two entity types differ only by case, so this is safe.
    const selected = new Set(
      selectedEntityTypes.map((entityType) => entityType.toLowerCase())
    );
    treeNodes.forEach((node) => {
      const childEntities = node.data?.childEntities ?? [];
      const containsSelectedType = childEntities.some((entityType) =>
        selected.has(entityType.toLowerCase())
      );
      if (!containsSelectedType) {
        disabledKeys.add(node.key);
      }
    });
  }

  return disabledKeys;
};

/**
 * Whether an entity-type leaf bucket should appear in the explore tree given
 * the Data Assets selection. With no selection every type shows; otherwise
 * only the selected types do (Table-only must not surface Columns). Compared
 * case-insensitively because leaf buckets are camelCase (tableColumn) while
 * the quick-filter values are lowercased (tablecolumn).
 */
export const isEntityTypeBucketSelected = (
  bucketKey: string,
  selectedEntityTypes: string[]
): boolean =>
  isEmpty(selectedEntityTypes) ||
  selectedEntityTypes.some(
    (entityType) => entityType.toLowerCase() === bucketKey.toLowerCase()
  );

/**
 * Parse the active quick-filter URL param into its `must` clauses so the
 * explore tree counts can reflect the same filters the result list does
 * (entity type, tier, owner, …). Returns [] for an absent/invalid param.
 */
export const getQuickFilterMust = (
  quickFilter?: unknown
): QueryFieldInterface[] => {
  let must: QueryFieldInterface[] = [];
  if (isString(quickFilter) && !isEmpty(quickFilter)) {
    try {
      const parsedMust = get(JSON.parse(quickFilter), 'query.bool.must');
      must = Array.isArray(parsedMust)
        ? parsedMust
        : parsedMust
        ? [parsedMust]
        : [];
    } catch {
      must = [];
    }
  }

  return must;
};

/**
 * Build the explore-tree count query. Every level aggregates over the
 * dataAsset index so a node's count is the total matching objects in its
 * subtree (parent >= child), not the immediate children of a per-entity index.
 * It ANDs: the node's browse hierarchy, the active quick filters, and — at a
 * category root — the category's own entity types so e.g. Databases stays
 * scoped to its family.
 */
export const buildTreeCountQueryFilter = ({
  baseQueryFilter,
  isRoot,
  childEntities,
  activeQuickFilter,
}: {
  baseQueryFilter: { query: { bool: EsBoolQuery } };
  isRoot: boolean;
  childEntities: string[];
  activeQuickFilter?: unknown;
}): { query: { bool: { must: QueryFieldInterface[] } } } => {
  const must: QueryFieldInterface[] = [];
  const baseMust = baseQueryFilter?.query?.bool?.must;
  if (baseMust) {
    must.push(
      ...((Array.isArray(baseMust)
        ? baseMust
        : [baseMust]) as QueryFieldInterface[])
    );
  }
  if (isRoot && !isEmpty(childEntities)) {
    must.push({
      bool: {
        should: childEntities.map((entityType) => ({
          term: { 'entityType.keyword': entityType.toLowerCase() },
        })),
      },
    });
  }
  must.push(...getQuickFilterMust(activeQuickFilter));

  return { query: { bool: { must } } };
};

export const isElasticsearchError = (error: unknown): boolean => {
  if (!error) {
    return false;
  }

  const axiosError = error as AxiosError;
  if (!axiosError.response?.data) {
    return false;
  }

  const data = axiosError.response.data as Record<string, unknown>;
  const message = data.message as string;

  return (
    !!message &&
    (message.includes(FAILED_TO_FIND_INDEX_ERROR) ||
      message.includes(ES_EXCEPTION_SHARDS_FAILED))
  );
};

const isBrowsePathOption = (option: unknown): boolean =>
  typeof option === 'object' &&
  option !== null &&
  typeof (option as Record<string, unknown>).key === 'string';

const isBrowsePathField = (
  field: unknown
): field is ExploreQuickFilterField => {
  const record =
    field && typeof field === 'object'
      ? (field as Record<string, unknown>)
      : undefined;
  const value = record?.value;
  const hasValidValue =
    value === undefined ||
    (Array.isArray(value) && value.every(isBrowsePathOption));

  return typeof record?.key === 'string' && hasValidValue;
};

/**
 * The browse location selected in the explore tree, kept in its own
 * `browsePath` URL param (ordered ExploreQuickFilterField[] — category,
 * serviceType, service, database, schema). It ANDs with the dropdown
 * `quickFilter`, so browsing never clears filters and vice versa.
 * The param is untrusted URL input — malformed elements are dropped so
 * crafted/legacy deep links degrade to an empty browse path.
 */
export const parseBrowsePathFields = (
  browsePath?: unknown
): ExploreQuickFilterField[] => {
  let result: ExploreQuickFilterField[] = [];
  if (isString(browsePath) && !isEmpty(browsePath)) {
    try {
      const parsed: unknown = JSON.parse(browsePath);
      if (Array.isArray(parsed)) {
        result = parsed.filter(isBrowsePathField);
      }
    } catch {
      result = [];
    }
  }

  return result;
};

export const getBrowsePathQueryFilter = (
  browseFields: ExploreQuickFilterField[]
): QueryFilterInterface | undefined => {
  const must = getExploreQueryFilterMust(browseFields);

  return isEmpty(must)
    ? undefined
    : ({ query: { bool: { must } } } as QueryFilterInterface);
};

/**
 * Removing a browse chip truncates the path from that level down — removing
 * "Service" also drops the database and schema picked beneath it.
 */
export const truncateBrowsePath = (
  browseFields: ExploreQuickFilterField[],
  levelKey: string
): ExploreQuickFilterField[] => {
  const levelIndex = browseFields.findIndex((field) => field.key === levelKey);

  return levelIndex < 0 ? browseFields : browseFields.slice(0, levelIndex);
};

const CANONICAL_ENTITY_TYPES = new Map(
  Object.values(EntityType).map((value) => [value.toLowerCase(), value])
);

/**
 * Search aggregations return entityType values in lowercase ("tablecolumn")
 * while the EntityType enum and display-label maps use camelCase
 * ("tableColumn"). Resolve any casing to the canonical enum value so labels
 * and icons keep working regardless of which layer produced the key.
 */
export const getCanonicalEntityType = (entityTypeKey: string): string =>
  CANONICAL_ENTITY_TYPES.get(entityTypeKey.toLowerCase()) ?? entityTypeKey;

const getBrowsePathSignature = (fields: ExploreQuickFilterField[]): string =>
  fields
    .map(
      (field) =>
        `${field.key}=${(field.value ?? [])
          .map((option) => option.key.toLowerCase())
          .sort()
          .join(',')}`
    )
    .join('|');

/**
 * Find the loaded tree node that corresponds to a browse path, so the tree
 * highlight can follow chip removals — dropping the Service chip moves the
 * selection back up to the category root.
 */
export const findTreeNodeKeyByBrowsePath = (
  treeNodes: ExploreTreeNode[],
  browseFields: ExploreQuickFilterField[]
): string | null => {
  let result: string | null = null;
  if (!isEmpty(browseFields)) {
    const targetSignature = getBrowsePathSignature(browseFields);
    const isCategoryPath =
      browseFields.length === 1 &&
      browseFields[0].key === EntityFields.ENTITY_TYPE;

    const visit = (nodes: ExploreTreeNode[]) => {
      nodes.forEach((node) => {
        if (result) {
          return;
        }
        if (isCategoryPath && node.data?.isRoot) {
          const childEntities = (node.data?.childEntities ?? [])
            .map((entityType) => entityType.toLowerCase())
            .sort()
            .join(',');
          const targetEntities = (browseFields[0].value ?? [])
            .map((option) => option.key.toLowerCase())
            .sort()
            .join(',');
          if (childEntities === targetEntities) {
            result = node.key;

            return;
          }
        }
        if (
          node.data?.filterField &&
          getBrowsePathSignature(node.data.filterField) === targetSignature
        ) {
          result = node.key;

          return;
        }
        if (node.children) {
          visit(node.children);
        }
      });
    };
    visit(treeNodes);

    // Deep links and reloads start with only the shallow levels loaded —
    // fall back to the deepest loaded ancestor of the path so the tree still
    // shows where the user is browsing.
    if (!result && browseFields.length > 1) {
      result = findTreeNodeKeyByBrowsePath(
        treeNodes,
        browseFields.slice(0, -1)
      );
    }
  }

  return result;
};

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

  const browseFields = parseBrowsePathFields(parsedSearch.browsePath);

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

  const showDeleted = queryFilterContainsDeleted
    ? undefined
    : parsedSearch.showDeleted === 'true';

  return {
    parsedSearch,
    searchQueryParam,
    browseFields,
    sortValue,
    sortOrder,
    page,
    size,
    showDeleted,
  };
};
