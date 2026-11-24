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

import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityDetailsObjectInterface } from '../../../Explore/ExplorePage.interface';
import { SearchedDataProps } from '../../../SearchedData/SearchedData.interface';

import { AssetsOfEntity } from '../../../../enums/Assets.enum';

export { AssetsOfEntity };

export interface AssetsTabsProps {
  onAddAsset: () => void;
  onRemoveAsset?: () => void;
  entityFqn?: string;
  permissions: OperationPermission;
  assetCount?: number;
  onAssetClick?: (asset?: EntityDetailsObjectInterface) => void;
  isSummaryPanelOpen: boolean;
  isEntityDeleted?: boolean;
  type?: AssetsOfEntity;
  queryFilter?: string | Record<string, unknown>;
  noDataPlaceholder?: string | AssetNoDataPlaceholderProps;
  addDisabledMessage?: string;
  preloadedData?: SearchedDataProps['data'];
  skipSearch?: boolean;
  /**
   * Route the asset search through `POST /v1/search/query` (searchAPI.searchQueryPost)
   * instead of the GET path. Set this for callers whose `queryFilter` can grow large
   * enough to overflow the server's request-line size limit — e.g. the metric Assets
   * tab, which embeds every linked asset id in an `ids` filter.
   */
  useQueryPost?: boolean;
}

export interface AssetNoDataPlaceholderProps {
  message: string;
}
