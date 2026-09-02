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

import type { Bucket } from 'Models';
import '../components/MyData/Widgets/CuratedAssetsWidget/CuratedAssetsModal/curated-assets-modal.less';
import QueryBuilderCountBanner from '../components/common/QueryBuilder/QueryBuilderCountBanner/QueryBuilderCountBanner';
import { CURATED_ASSETS_LIST } from '../constants/AdvancedSearch.constants';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { searchQuery } from '../rest/searchAPI';
import { getTotalResourceCount } from './CuratedAssetsPureUtils';

export interface CuratedAssetsFormSelectedAssetsInfo {
  resourceCount?: number;
  filteredResourceCount?: number;
  resourcesWithNonZeroCount: Array<EntityType>;
}

export const AlertMessage = ({
  assetCount,
  href,
  target,
  showExploreLink = true,
}: {
  assetCount?: number;
  href?: string;
  target?: string;
  /** Offer the click-through, or show the count on its own. */
  showExploreLink?: boolean;
}) => (
  // The same banner every other query-builder surface renders; this screen
  // only supplies a count the builder cannot derive on its own.
  <QueryBuilderCountBanner
    count={assetCount}
    exploreUrl={showExploreLink ? href : undefined}
    linkLabelKey="label.view-in-explore-page"
    target={target}
  />
);

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
    const response = await searchQuery({
      searchIndex: SearchIndex.ALL,
      queryFilter: JSON.parse(queryFilter ?? '{}'),
    });

    const entityCounts = response.aggregations.entityType.buckets ?? [];

    const resourcesWithNonZeroCount: Array<EntityType> = entityCounts.reduce(
      (acc: Array<EntityType>, bucket: Bucket) => {
        const isResourceFromAllOptionsInBucket =
          selectedResource.includes('all') &&
          CURATED_ASSETS_LIST.includes(bucket.key as EntityType);

        const isSelectedResourceInBucket = selectedResource.includes(
          bucket.key
        );

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
