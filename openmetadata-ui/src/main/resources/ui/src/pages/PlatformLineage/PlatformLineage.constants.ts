/*
 *  Copyright 2026 Collate.
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
import { SearchIndex } from '../../enums/search.enum';
import { LineageLens } from '../../generated/api/lineage/lineageScene';

export const LINEAGE_SEARCH_INDEXES = [
  SearchIndex.DATA_ASSET,
  SearchIndex.DOMAIN,
  SearchIndex.SERVICE,
];

// What a Layer level of each lens lists, and so what its search looks for.
export const LAYER_SEARCH_BY_LENS: Record<
  LineageLens,
  { index: SearchIndex; labelKey: string }
> = {
  [LineageLens.Service]: {
    index: SearchIndex.SERVICE,
    labelKey: 'label.service-lowercase',
  },
  [LineageLens.Domain]: {
    index: SearchIndex.DOMAIN,
    labelKey: 'label.domain-lowercase',
  },
  [LineageLens.DataProduct]: {
    index: SearchIndex.DATA_PRODUCT,
    labelKey: 'label.data-product-lowercase',
  },
};

// A 404 means the entity is gone and a 403 that it can't be viewed; any other
// failed fetch can be retried.
export const ENTITY_LOAD_ERRORS: Record<number, 'missing' | 'denied'> = {
  403: 'denied',
  404: 'missing',
};
