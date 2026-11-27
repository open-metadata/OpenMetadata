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
import { EntityFields } from '../../../../enums/AdvancedSearch.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { getCategoryFilterConfig } from './GlobalSearchFilterBar.utils';

describe('getCategoryFilterConfig', () => {
  it('gives data assets the asset facets on the dataAsset index', () => {
    const config = getCategoryFilterConfig('assets');

    expect(config?.index).toBe(SearchIndex.DATA_ASSET);
    expect(config?.fields.map((field) => field.key)).toEqual(
      expect.arrayContaining([
        EntityFields.ENTITY_TYPE_KEYWORD,
        EntityFields.OWNERS,
        EntityFields.TIER,
        EntityFields.ENTITY_STATUS,
      ])
    );
  });

  it.each([
    ['glossaryTerm', SearchIndex.GLOSSARY_TERM, EntityFields.GLOSSARY],
    ['tag', SearchIndex.TAG, EntityFields.CLASSIFICATION],
    ['dataProduct', SearchIndex.DATA_PRODUCT, EntityFields.DOMAINS],
    ['table', SearchIndex.TABLE, EntityFields.OWNERS],
  ])('uses Explore’s quick filters for %s', (entityType, index, field) => {
    const config = getCategoryFilterConfig(entityType);

    expect(config?.index).toBe(index);
    expect(config?.fields.map((item) => item.key)).toContain(field);
  });

  it('uses the Domains listing filters for domains', () => {
    const config = getCategoryFilterConfig('domain');

    expect(config?.index).toBe(SearchIndex.DOMAIN);
    expect(config?.fields.map((field) => field.key)).toContain(
      EntityFields.DOMAIN_TYPE
    );
  });

  it.each(['user', 'team', 'tasks', 'chats', 'aiFrameworkControl'])(
    'offers no filters for %s',
    (category) => {
      expect(getCategoryFilterConfig(category)).toBeUndefined();
    }
  );
});
