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

import { t } from 'i18next';
import { get, isEmpty, isUndefined } from 'lodash';
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
import { EntityFields } from '../enums/AdvancedSearch.enum';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { Aggregations, Bucket } from '../interface/search.interface';
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
