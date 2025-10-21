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
import { isEmpty } from 'lodash';
import { PAGE_SIZE } from '../constants/constants';
import { queryFilterToRemoveSomeClassification } from '../constants/Tag.constants';
import { SearchIndex } from '../enums/search.enum';
import { searchQuery } from '../rest/searchAPI';
import { getTermQuery } from './SearchUtils';
import { escapeESReservedCharacters, getEncodedFqn } from './StringsUtils';

class TagClassBase {
  public async getTags(
    searchText: string,
    page: number,
    emptyQueryFilter?: boolean
  ) {
    // this is to escape and encode any chars which is known by ES search internally
    const encodedValue = getEncodedFqn(escapeESReservedCharacters(searchText));

    // Build the queryFilter by merging disabled:false with any existing filters
    const disabledFilter = getTermQuery({ disabled: 'false' });

    let mergedQueryFilter = {};
    if (emptyQueryFilter) {
      // If emptyQueryFilter is true, only use the disabled filter
      mergedQueryFilter = disabledFilter;
    } else if (!isEmpty(queryFilterToRemoveSomeClassification)) {
      // Merge both filters: disabled:false (must) + classification exclusions (must_not)
      mergedQueryFilter = {
        query: {
          bool: {
            must: disabledFilter.query.bool.must,
            must_not: queryFilterToRemoveSomeClassification.query.bool.must_not,
          },
        },
      };
    } else {
      mergedQueryFilter = disabledFilter;
    }

    const res = await searchQuery({
      query: `*${encodedValue}*`,
      pageNumber: page,
      pageSize: PAGE_SIZE,
      queryFilter: mergedQueryFilter,
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
