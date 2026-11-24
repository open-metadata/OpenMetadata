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
import { EntityType } from '../../../../enums/entity.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import domainClassBase from '../../../../utils/Domain/DomainClassBase';
import searchClassBase from '../../../../utils/SearchClassBase';
import { ASSETS_CATEGORY, ASSET_FACETS } from './GlobalSearch.constants';
import { GlobalSearchCategory } from './GlobalSearch.types';

export interface GlobalSearchFilterConfig {
  index: SearchIndex;
  /** `label` is an i18n key; `ExploreQuickFilters` translates it. */
  fields: { key: string; label: string }[];
}

/**
 * The filters a result type offers, reusing the definitions its own pages
 * already use: Explore's per-index quick filters, and the Domains listing's
 * filters for domains. Types with none (users, teams, …) get no filter bar.
 */
export const getCategoryFilterConfig = (
  category: GlobalSearchCategory
): GlobalSearchFilterConfig | undefined => {
  if (category === ASSETS_CATEGORY) {
    return {
      index: SearchIndex.DATA_ASSET,
      fields: ASSET_FACETS.map(({ field, labelKey }) => ({
        key: field,
        label: labelKey,
      })),
    };
  }
  if (category === EntityType.DOMAIN) {
    return {
      index: SearchIndex.DOMAIN,
      fields: domainClassBase.getListingFilters(),
    };
  }
  const index = searchClassBase.getEntityTypeSearchIndexMapping()[category];
  const fields = index ? searchClassBase.getDropDownItems(index) : [];

  return fields.length > 0 ? { index, fields } : undefined;
};
