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

import { get } from 'lodash';
import { Bucket } from 'Models';
import React from 'react';
import { ExploreTreeNode } from '../components/Explore/ExploreTree/ExploreTree.interface';
import { SearchDropdownOption } from '../components/SearchDropdown/SearchDropdown.interface';
import {
  QueryFieldInterface,
  QueryFilterInterface,
} from '../pages/ExplorePage/ExplorePage.interface';
import { getParseValueFromLocation } from './ExploreFilterUtils';

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
