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

import { Config, Utils as QbUtils } from '@react-awesome-query-builder/antd';
import { isEmpty } from 'lodash';
import { Bucket } from 'Models';
import Qs from 'qs';
import { CURATED_ASSETS_LIST } from '../constants/AdvancedSearch.constants';
import { EntityType } from '../enums/entity.enum';
import type { QueryFilterInterface } from '../pages/ExplorePage/ExplorePage.interface';
import {
  getEntityTypeAggregationFilter,
  getJsonTreeFromQueryFilter,
} from './QueryBuilderUtils';
import { getExplorePath } from './RouterUtils';

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

/* eslint-disable @typescript-eslint/no-use-before-define */
function isValidBoolQuery(boolQuery: ElasticsearchBoolQuery): boolean {
  if (!boolQuery) {
    return false;
  }

  const { must, should, must_not } = boolQuery;

  if (Array.isArray(must)) {
    if (must.length === 0) {
      return false;
    }
    if (!must.every(isValidCondition)) {
      return false;
    }
  }

  if (Array.isArray(should)) {
    if (should.length === 0) {
      return false;
    }
    if (!should.every(isValidCondition)) {
      return false;
    }
  }

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
/* eslint-enable @typescript-eslint/no-use-before-define */

function isValidCondition(condition: ElasticsearchCondition): boolean {
  if (!condition) {
    return false;
  }

  if (condition.term) {
    const termKeys = Object.keys(condition.term);

    return (
      termKeys.length > 0 && termKeys.every((field) => field.trim() !== '')
    );
  }

  if (condition.terms) {
    const termsKeys = Object.keys(condition.terms);

    return (
      termsKeys.length > 0 && termsKeys.every((field) => field.trim() !== '')
    );
  }

  if (condition.exists) {
    return Boolean(
      condition.exists.field && condition.exists.field.trim() !== ''
    );
  }

  if (condition.bool) {
    return isValidBoolQuery(condition.bool);
  }

  return true;
}

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

    if (!queryFilter.query) {
      return false;
    }

    if (queryFilter.query.bool) {
      return isValidBoolQuery(queryFilter.query.bool);
    }

    return true;
  } catch {
    return false;
  }
};

export const getTotalResourceCount = (
  entityCounts: Bucket[],
  selectedResource: Array<string>
) => {
  const entityCount = entityCounts.reduce((acc: number, bucket: Bucket) => {
    const isResourceFromAllOptionsInBucket =
      selectedResource.includes('all') &&
      CURATED_ASSETS_LIST.includes(bucket.key as EntityType);

    const isSelectedResourceInBucket = selectedResource.includes(bucket.key);

    if (isResourceFromAllOptionsInBucket || isSelectedResourceInBucket) {
      return acc + bucket.doc_count;
    }

    return acc;
  }, 0);

  return entityCount;
};

export const getModifiedQueryFilterWithSelectedAssets = (
  queryFilterObject: QueryFilterInterface,
  selectedResource?: Array<string>
) => {
  if (!selectedResource?.length || selectedResource.includes(EntityType.ALL)) {
    return queryFilterObject;
  }

  const entityTypeFilter = {
    bool: {
      should: [
        ...selectedResource.map((resource) => ({
          term: { entityType: resource },
        })),
      ],
    },
  };

  if (!queryFilterObject.query) {
    return {
      query: {
        bool: {
          must: [entityTypeFilter],
        },
      },
    };
  }

  return {
    query: {
      bool: {
        must: [queryFilterObject.query, entityTypeFilter],
      },
    },
  };
};

export const getExpandedResourceList = (resources: Array<string>) => {
  if (resources.includes(EntityType.ALL)) {
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

    const queryFilterObject = JSON.parse(queryFilter || '{}');

    const params: Record<string, unknown> = {
      page: 1,
      size: 15,
      quickFilter: JSON.stringify(quickFilter),
    };

    if (!isEmpty(queryFilterObject) && queryFilterObject.query) {
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
