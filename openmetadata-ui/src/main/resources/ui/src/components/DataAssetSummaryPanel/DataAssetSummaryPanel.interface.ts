/*
 *  Copyright 2025 Collate.
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
import { EntityTags } from 'Models';
import { EntityType } from '../../enums/entity.enum';
import { DataProduct } from '../../generated/entity/domains/dataProduct';
import { DRAWER_NAVIGATION_OPTIONS } from '../../utils/EntityUtils';
import { SearchedDataProps } from '../SearchedData/SearchedData.interface';

export type DataAssetSummaryPanelProps = {
  tags?: EntityTags[];
  componentType?: DRAWER_NAVIGATION_OPTIONS;
  isLoading?: boolean;
  highlights?: SearchedDataProps['data'][number]['highlight'];
  dataAsset: SearchedDataProps['data'][number]['_source'] & {
    dataProducts: DataProduct[];
  };
  entityType: EntityType;
  isDomainVisible?: boolean;
  isLineageView?: boolean;
};
