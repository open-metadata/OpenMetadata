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
import { SearchIndex } from '../enums/search.enum';
import { fetchDataProductsElasticSearch } from './dataProductAPI';
import { searchQuery } from './searchAPI';

jest.mock('./searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue({
    hits: { hits: [], total: { value: 0 } },
  }),
}));

describe('fetchDataProductsElasticSearch', () => {
  it("scopes data products to the asset's domains, not the selected navbar domain", async () => {
    await fetchDataProductsElasticSearch('', ['Sales'], 1);

    expect(searchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        searchIndex: SearchIndex.DATA_PRODUCT,
        skipDomainFilter: true,
      })
    );
  });
});
