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

import Qs from 'qs';
import { QuerySearchParams } from '../../components/Database/TableQueries/TableQueries.interface';
import { SearchDropdownOption } from '../../components/SearchDropdown/SearchDropdown.interface';
import { PAGE_SIZE_BASE } from '../../constants/constants';
import { SearchIndex } from '../../enums/search.enum';
import { searchQuery } from '../../rest/searchAPI';
import { getEntityName } from '../EntityUtils';

export const createQueryFilter = ({
  tableId,
  tags,
  owners,
  timeRange,
}: {
  tableId: string;
  tags?: SearchDropdownOption[];
  owners?: SearchDropdownOption[];
  timeRange?: { startTs: number; endTs: number };
}) => {
  const tagFilter = tags?.length
    ? [
        {
          bool: {
            should: tags.map((data) => ({
              term: { 'tags.tagFQN': data.key },
            })),
          },
        },
      ]
    : [];
  const ownerFilter = owners?.length
    ? [
        {
          bool: {
            should: owners.map((data) => ({
              term: { 'owner.fullyQualifiedName': data.key },
            })),
          },
        },
      ]
    : [];
  const timeRangeFilter = timeRange
    ? [
        {
          range: {
            queryDate: {
              gte: timeRange.startTs,
              lte: timeRange.endTs,
            },
          },
        },
      ]
    : [];
  const filter = {
    query: {
      bool: {
        must: [
          { term: { 'queryUsedIn.id': tableId } },
          ...tagFilter,
          ...ownerFilter,
          ...timeRangeFilter,
        ],
      },
    },
  };

  return filter;
};

export const parseSearchParams = (param: string) => {
  return Qs.parse(
    param.startsWith('?') ? param.substring(1) : param
    // need to typecast into QuerySearchParams as Qs.parse returns as "Qs.ParsedQs" Type object
  ) as unknown as QuerySearchParams;
};
export const stringifySearchParams = (param: QuerySearchParams) => {
  return Qs.stringify(param);
};

export const fetchFilterOptions = async (
  searchText: string,
  filters: string,
  searchIndex: SearchIndex | SearchIndex[]
) => {
  const response = await searchQuery({
    query: `*${searchText}*`,
    filters,
    pageNumber: 1,
    pageSize: PAGE_SIZE_BASE,
    searchIndex,
  });
  const options = response.hits.hits.map((hit) => ({
    key: hit._source.fullyQualifiedName ?? hit._source.name,
    label: getEntityName(hit._source),
  }));

  return options;
};
