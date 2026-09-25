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
import { isEmpty, uniq } from 'lodash';
import { PAGE_SIZE_LARGE } from '../../constants/constants';
import { UUID_REGEX } from '../../constants/regex.constants';
import { SearchIndex } from '../../enums/search.enum';
import { searchQuery } from '../../rest/searchAPI';
import alertsClassBase from '../AlertsClassBase';
import searchClassBase from '../SearchClassBase';
import { getTermQuery } from '../SearchPureUtils';
import { getFqnSearchIndexes, searchEntity } from './AlertsUtil';

export interface NameOption {
  label: string;
  value: string;
}

export type NameSearch = (searchText: string) => Promise<NameOption[]>;

export interface FoundById {
  id: string;
  fullyQualifiedName: string;
}

export interface AlertSourceSearch {
  /** The indexes names are chosen from, so a name chosen earlier can be resolved again. */
  indexes: SearchIndex[];
  containerEntities: string[];
  byName: NameSearch;
  byId: (searchText?: string) => Promise<FoundById[]>;
}

/**
 * How the fields of an alert search what its sources hold. A source with a search of its own uses
 * it; data contracts, for one, are not in the search indexes. The other sources share one search
 * over their indexes and those of their containers. An id is looked up in the index of every
 * selected source.
 */
export const getAlertSourceSearch = (
  sources: string[],
  containerEntities: string[] = []
): AlertSourceSearch => {
  const ownSearches = alertsClassBase.getSourceNameSearch();
  const withOwnSearch = sources.filter((source) => ownSearches[source]);
  const indexed = sources.filter((source) => !ownSearches[source]);
  const mapping = searchClassBase.getEntityTypeSearchIndexMapping();
  const idIndexes = uniq(
    sources
      .map((source) => mapping[source])
      .filter((index): index is SearchIndex => Boolean(index))
  );

  const byName: NameSearch = async (searchText) => {
    const [own, entities] = await Promise.all([
      Promise.all(
        withOwnSearch.map((source) => ownSearches[source](searchText))
      ),
      isEmpty(indexed)
        ? []
        : searchEntity({
            searchText,
            searchIndex: getFqnSearchIndexes(indexed, containerEntities),
            showDisplayNameAsLabel: false,
            wildcardEntityTypes: containerEntities,
          }),
    ]);

    return [...own.flat(), ...entities];
  };

  const byId = async (searchText = ''): Promise<FoundById[]> => {
    if (isEmpty(idIndexes)) {
      return [];
    }
    const trimmed = searchText.trim();
    const response = await searchQuery({
      query: trimmed,
      pageNumber: 1,
      pageSize: PAGE_SIZE_LARGE,
      queryFilter: UUID_REGEX.test(trimmed)
        ? getTermQuery({ id: trimmed })
        : undefined,
      searchIndex: idIndexes,
    });

    return response.hits.hits.map((hit) => ({
      id: hit._source.id ?? '',
      fullyQualifiedName: hit._source.fullyQualifiedName ?? '',
    }));
  };

  return {
    indexes: getFqnSearchIndexes(sources, containerEntities),
    containerEntities,
    byName,
    byId,
  };
};
