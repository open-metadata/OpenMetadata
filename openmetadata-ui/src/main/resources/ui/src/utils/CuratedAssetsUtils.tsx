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
import { Bucket } from 'Models';
import { useTranslation } from 'react-i18next';
import '../components/MyData/Widgets/CuratedAssetsWidget/CuratedAssetsModal/curated-assets-modal.less';
import { CURATED_ASSETS_LIST } from '../constants/AdvancedSearch.constants';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { searchQuery } from '../rest/searchAPI';
import { getTotalResourceCount } from './CuratedAssetsPureUtils';

export {
  EMPTY_QUERY_FILTER_STRINGS,
  getExpandedResourceList,
  getExploreURLForAdvancedFilter,
  getExploreURLWithFilters,
  getModifiedQueryFilterWithSelectedAssets,
  getSimpleExploreURLForAssetTypes,
  getTotalResourceCount,
  isValidElasticsearchQuery,
} from './CuratedAssetsPureUtils';

export interface CuratedAssetsFormSelectedAssetsInfo {
  resourceCount?: number;
  filteredResourceCount?: number;
  resourcesWithNonZeroCount: Array<EntityType>;
}

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
