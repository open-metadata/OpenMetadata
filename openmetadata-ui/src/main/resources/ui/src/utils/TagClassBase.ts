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
import { PAGE_SIZE } from '../constants/constants';
import { queryFilterToRemoveSomeClassification } from '../constants/Tag.constants';
import { SearchIndex } from '../enums/search.enum';
import { searchQuery } from '../rest/searchAPI';
import { escapeESReservedCharacters, getEncodedFqn } from './StringsUtils';

class TagClassBase {
  public async getTags(
    searchText: string,
    page: number,
    emptyQueryFilter?: boolean
  ) {
    // this is to escape and encode any chars which is known by ES search internally
    const encodedValue = getEncodedFqn(escapeESReservedCharacters(searchText));
    const res = await searchQuery({
      query: `*${encodedValue}*`,
      filters: 'disabled:false',
      pageNumber: page,
      pageSize: PAGE_SIZE,
      queryFilter: emptyQueryFilter
        ? {}
        : queryFilterToRemoveSomeClassification,
      searchIndex: SearchIndex.TAG,
    });

    return {
      data: res.hits.hits.map(({ _source }) => ({
        label: _source.fullyQualifiedName ?? '',
        value: _source.fullyQualifiedName ?? '',
        data: _source,
      })),
      paging: {
        total: res.hits.total.value,
      },
    };
  }
}

const tagClassBase = new TagClassBase();

export default tagClassBase;
export { TagClassBase };
