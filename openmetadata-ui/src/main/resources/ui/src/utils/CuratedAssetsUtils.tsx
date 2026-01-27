/*
 *  Copyright 2022 Collate.
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

import { InfoCircleOutlined } from '@ant-design/icons';
import { Config, Utils as QbUtils } from '@react-awesome-query-builder/antd';
import { Alert } from 'antd';
import { isEmpty } from 'lodash';
import { Bucket } from 'Models';
import Qs from 'qs';
import { useTranslation } from 'react-i18next';
import '../components/MyData/Widgets/CuratedAssetsWidget/CuratedAssetsModal/curated-assets-modal.less';
import { CURATED_ASSETS_LIST } from '../constants/AdvancedSearch.constants';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { QueryFilterInterface } from '../pages/ExplorePage/ExplorePage.interface';
import { searchQuery } from '../rest/searchAPI';
import {
  getEntityTypeAggregationFilter,
  getJsonTreeFromQueryFilter,
} from './QueryBuilderUtils';
import { getExplorePath } from './RouterUtils';

export interface CuratedAssetsFormSelectedAssetsInfo {
  resourceCount?: number;
  filteredResourceCount?: number;
  resourcesWithNonZeroCount: Array<EntityType>;
}

// Query filter strings that are considered empty
export const EMPTY_QUERY_FILTER_STRINGS = [
  '{"query":{"bool":{"must":[]}}}',
  '{}',
  '',
];

interface ElasticsearchCondition {
  term?: Record<string, unknown>;
  terms?: Record<string, unknown[]>;
  exists?: { field: string };
  bool?: ElasticsearchBoolQuery;
}

interface ElasticsearchBoolQuery {
  must?: ElasticsearchCondition[];
  should?: ElasticsearchCondition[];
  must_not?: ElasticsearchCondition | ElasticsearchCondition[];
}

// Simple validation functions using function declarations for hoisting
function isValidCondition(condition: ElasticsearchCondition): boolean {
  if (!condition) {
    return false;
  }

  // Check term conditions - must have non-empty field names
  if (condition.term) {
    const termKeys = Object.keys(condition.term);

    return (
      termKeys.length > 0 && termKeys.every((field) => field.trim() !== '')
    );
  }

  // Check terms conditions - must have non-empty field names
  if (condition.terms) {
    const termsKeys = Object.keys(condition.terms);

    return (
      termsKeys.length > 0 && termsKeys.every((field) => field.trim() !== '')
    );
  }

  // Check exists conditions - must have non-empty field
  if (condition.exists) {
    return Boolean(
      condition.exists.field && condition.exists.field.trim() !== ''
    );
  }

  // Check nested bool conditions
  if (condition.bool) {
    return isValidBoolQuery(condition.bool);
  }

  return true;
}

function isValidBoolQuery(boolQuery: ElasticsearchBoolQuery): boolean {
  if (!boolQuery) {
    return false;
  }

  const { must, should, must_not } = boolQuery;

  // Validate must conditions (AND)
  if (Array.isArray(must)) {
    if (must.length === 0) {
      return false;
    }
    if (!must.every(isValidCondition)) {
      return false;
    }
  }

  // Validate should conditions (OR)
  if (Array.isArray(should)) {
    if (should.length === 0) {
      return false;
    }
    if (!should.every(isValidCondition)) {
      return false;
    }
  }

  // Validate must_not conditions
  if (Array.isArray(must_not)) {
    if (!must_not.every(isValidCondition)) {
      return false;
    }
  } else if (must_not) {
    if (!isValidCondition(must_not)) {
      return false;
    }
  }

  return true;
}

// Main validation function for queryFilter string
export const isValidElasticsearchQuery = (
  queryFilterString: string
): boolean => {
  if (
    !queryFilterString ||
    EMPTY_QUERY_FILTER_STRINGS.includes(queryFilterString)
  ) {
    return false;
  }

  try {
    const queryFilter = JSON.parse(queryFilterString);

    // Check if it has query structure
    if (!queryFilter.query) {
      return false;
    }

    // Validate the bool query structure
    if (queryFilter.query.bool) {
      return isValidBoolQuery(queryFilter.query.bool);
    }

    // For other query types, assume valid
    return true;
  } catch {
    return false;
  }
};

export const AlertMessage = ({
  assetCount,
  href = '#',
  target,
}: {
  assetCount?: number;
  href?: string;
  target?: string;
}) => {
  const { t } = useTranslation();

  return (
    <Alert
      closable
      className="bg-transparent border-none"
      message={
        <div className="flex items-center">
          <InfoCircleOutlined className="m-r-xs text-xl flex self-center" />
          <span>
            {t('message.search-entity-count', {
              count: assetCount,
            })}
            &nbsp;
            <a
              className="text-primary hover:underline"
              href={href}
              target={target}>
              {t('label.view-in-explore-page')}
            </a>
          </span>
        </div>
      }
    />
  );
};

export const getTotalResourceCount = (
  entityCounts: Bucket[],
  selectedResource: Array<string>
) => {
  // Calculate the total entity count for the selected resources
  const entityCount = entityCounts.reduce((acc: number, bucket: Bucket) => {
    // Check if the selected resource is 'all' and the bucket key is in the list of all options
    const isResourceFromAllOptionsInBucket =
      selectedResource.includes('all') &&
      CURATED_ASSETS_LIST.includes(bucket.key as EntityType);

    // Check if the bucket key is in the selected resource list
    const isSelectedResourceInBucket = selectedResource.includes(bucket.key);

    if (isResourceFromAllOptionsInBucket || isSelectedResourceInBucket) {
      return acc + bucket.doc_count;
    }

    return acc;
  }, 0);

  return entityCount;
};

export const getSelectedResourceCount = async ({
  selectedResource,
  queryFilter,
  shouldUpdateResourceList = true,
}: {
  selectedResource: Array<string>;
  queryFilter?: string;
  shouldUpdateResourceList?: boolean;
}) => {
  try {
    // Fetch entity count for the selected resources
    const response = await searchQuery({
      searchIndex: SearchIndex.ALL,
      queryFilter: JSON.parse(queryFilter ?? '{}'),
    });

    // Get the entity count for the selected resources
    const entityCounts = response.aggregations.entityType.buckets ?? [];

    // Extract the resource list having non zero assets count for the selected resources
    const resourcesWithNonZeroCount: Array<EntityType> = entityCounts.reduce(
      (acc: Array<EntityType>, bucket: Bucket) => {
        // Check if the selected resource is 'all' and the bucket key is in the list of all options
        const isResourceFromAllOptionsInBucket =
          selectedResource.includes('all') &&
          CURATED_ASSETS_LIST.includes(bucket.key as EntityType);

        // Check if the bucket key is in the selected resource list
        const isSelectedResourceInBucket = selectedResource.includes(
          bucket.key
        );

        // If the resource is selected and asset count is non zero add the resource in the list
        if (
          (isSelectedResourceInBucket || isResourceFromAllOptionsInBucket) &&
          bucket.doc_count > 0
        ) {
          return [...acc, bucket.key as EntityType];
        }

        return acc;
      },
      [] as Array<EntityType>
    );

    return {
      entityCount: getTotalResourceCount(entityCounts, selectedResource),
      ...(shouldUpdateResourceList ? { resourcesWithNonZeroCount } : {}),
    };
  } catch {
    return {
      entityCount: 0,
    };
  }
};

export const getModifiedQueryFilterWithSelectedAssets = (
  queryFilterObject: QueryFilterInterface,
  selectedResource?: Array<string>
) => {
  // If no resources selected or resources include 'all', return original query without entity type filter
  if (!selectedResource?.length || selectedResource.includes(EntityType.ALL)) {
    return queryFilterObject;
  }

  // Create entityType filter for selected resources
  const entityTypeFilter = {
    bool: {
      should: [
        ...selectedResource.map((resource) => ({
          term: { entityType: resource },
        })),
      ],
    },
  };

  // If no original query, return just the entityType filter
  if (!queryFilterObject.query) {
    return {
      query: {
        bool: {
          must: [entityTypeFilter],
        },
      },
    };
  }

  // If original query exists, combine it with entity type filter using AND logic
  // This ensures the user's query conditions AND the entity type selection are both satisfied
  return {
    query: {
      bool: {
        must: [
          queryFilterObject.query, // Preserve original query structure completely
          entityTypeFilter, // Add entity type filter
        ],
      },
    },
  };
};

export const getExpandedResourceList = (resources: Array<string>) => {
  if (resources.includes(EntityType.ALL)) {
    // Return all entity types except 'all' itself
    return CURATED_ASSETS_LIST.filter((type) => type !== EntityType.ALL);
  }

  return resources;
};

export const getSimpleExploreURLForAssetTypes = (
  selectedResource: Array<string>
) => {
  if (isEmpty(selectedResource)) {
    return getExplorePath({});
  }

  const expandedResources = getExpandedResourceList(selectedResource);

  // Create query filter with the correct structure for quickFilter
  const quickFilter = {
    query: {
      bool: {
        must: [
          {
            bool: {
              should: expandedResources.map((resource) => ({
                term: { entityType: resource },
              })),
            },
          },
        ],
      },
    },
  };

  const queryString = Qs.stringify({
    page: 1,
    size: 15,
    quickFilter: JSON.stringify(quickFilter),
  });

  return `${getExplorePath({})}?${queryString}`;
};

export const getExploreURLForAdvancedFilter = ({
  queryFilter,
  selectedResource,
  config,
}: {
  queryFilter: string;
  selectedResource: Array<string>;
  config: Config;
}) => {
  try {
    if (isEmpty(selectedResource)) {
      return getExplorePath({});
    }

    const expandedResources = getExpandedResourceList(selectedResource);

    // Create quickFilter for entity types only - this handles the OR logic between entity types
    const quickFilter = {
      query: {
        bool: {
          must: [
            {
              bool: {
                should: expandedResources.map((resource) => ({
                  term: { entityType: resource },
                })),
              },
            },
          ],
        },
      },
    };

    // Parse the queryFilter WITHOUT adding entity type filters
    // This preserves the original query builder tree structure
    const queryFilterObject = JSON.parse(queryFilter || '{}');

    const params: Record<string, unknown> = {
      page: 1,
      size: 15,
      quickFilter: JSON.stringify(quickFilter),
    };

    // Only add queryFilter if there's an actual query (not just empty object)
    if (!isEmpty(queryFilterObject) && queryFilterObject.query) {
      // Convert elasticsearch query to tree format using the fixed function
      const tree = QbUtils.sanitizeTree(
        QbUtils.loadTree(getJsonTreeFromQueryFilter(queryFilterObject)),
        config
      ).fixedTree;

      if (!isEmpty(tree)) {
        params.queryFilter = JSON.stringify(tree);
      }
    }

    const queryString = Qs.stringify(params);

    return `${getExplorePath({})}?${queryString}`;
  } catch {
    return getExplorePath({});
  }
};

export const getExploreURLWithFilters = ({
  queryFilter,
  selectedResource,
  config,
}: {
  queryFilter: string;
  selectedResource: Array<string>;
  config: Config;
}) => {
  try {
    const expandedResources = getExpandedResourceList(selectedResource);

    const queryFilterObject = JSON.parse(queryFilter || '{}');

    const qFilter = getEntityTypeAggregationFilter(
      queryFilterObject as unknown as QueryFilterInterface,
      expandedResources
    );

    const tree = QbUtils.sanitizeTree(
      QbUtils.loadTree(getJsonTreeFromQueryFilter(qFilter)),
      config
    ).fixedTree;

    const queryFilterString = !isEmpty(tree)
      ? Qs.stringify({ queryFilter: JSON.stringify(tree) })
      : '';

    return `${getExplorePath({})}${queryFilterString}`;
  } catch {
    return getExplorePath({});
  }
};
