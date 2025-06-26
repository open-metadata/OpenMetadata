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
import { Alert } from 'antd';
import { isEmpty } from 'lodash';
import Qs from 'qs';
import React from 'react';
import { JsonTree, Utils as QbUtils } from 'react-awesome-query-builder';
import { useTranslation } from 'react-i18next';
import '../components/MyData/Widgets/CuratedAssetsWidget/CuratedAssetsModal/curated-assets-modal.less';
import { CURATED_ASSETS_LIST } from '../constants/AdvancedSearch.constants';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { Bucket } from '../interface/search.interface';
import { searchQuery } from '../rest/searchAPI';
import { getJsonTreeFromQueryFilter } from './QueryBuilderUtils';
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

export const APP_CONFIG_PATH = ['sourceConfig', 'config', 'appConfig'];

export const AlertMessage = ({
  assetCount,
  href = '#',
}: {
  assetCount: number;
  href?: string;
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
            <a className="text-primary hover:underline" href={href}>
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
  queryFilterObject: Record<string, any>,
  selectedResource?: Array<string>
) => {
  return {
    query: {
      bool: {
        must: [
          {
            bool: {
              must: [
                ...(queryFilterObject.query?.bool?.must?.[0]?.bool?.must ?? []),
                {
                  bool: {
                    should: [
                      ...(selectedResource ?? []).map((resource) => ({
                        term: { entityType: resource },
                      })),
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  };
};

export const getExploreURLWithFilters = ({
  queryFilter,
  selectedResource,
  config,
}: {
  queryFilter: string;
  selectedResource: Array<string>;
  config: any;
}) => {
  try {
    const queryFilterObject = JSON.parse(queryFilter || '{}');

    const modifiedQueryFilter = getModifiedQueryFilterWithSelectedAssets(
      queryFilterObject,
      selectedResource
    );

    const tree = QbUtils.checkTree(
      QbUtils.loadTree(
        getJsonTreeFromQueryFilter(modifiedQueryFilter) as JsonTree
      ),
      config
    );

    const queryFilterString = !isEmpty(tree)
      ? Qs.stringify({ queryFilter: JSON.stringify(tree) })
      : '';

    return `${getExplorePath({})}${queryFilterString}`;
  } catch {
    return '';
  }
};
