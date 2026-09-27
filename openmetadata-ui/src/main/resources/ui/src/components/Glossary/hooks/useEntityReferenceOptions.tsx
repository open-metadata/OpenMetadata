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
import { Avatar } from '@openmetadata/ui-core-components';
import { Teams } from '@openmetadata/ui-core-components/icons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { PAGE_SIZE_MEDIUM } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { Domain } from '../../../generated/entity/domains/domain';
import { useDebouncedValue } from '../../../hooks/common/useDebouncedValue';
import { searchDomains } from '../../../rest/domainAPI';
import { searchQuery } from '../../../rest/searchAPI';
import { formatTeamsResponse } from '../../../utils/APIUtils';
import { getRandomColor } from '../../../utils/ColorUtils';
import { getEntityReferenceListFromEntities } from '../../../utils/EntityReferenceUtils';
import { getTermQuery } from '../../../utils/SearchPureUtils';
import { EntityReferenceOption } from '../AddGlossary/AddGlossary.interface';
import { toEntityReferenceOption } from '../AddGlossary/AddGlossary.utils';

const SEARCH_DEBOUNCE_MS = 250;
const OPTIONS_STALE_TIME_MS = 30_000;
const NO_OPTIONS: EntityReferenceOption[] = [];

const fetchUserOptions = async (
  searchText: string
): Promise<EntityReferenceOption[]> => {
  const response = await searchQuery({
    pageNumber: 1,
    pageSize: PAGE_SIZE_MEDIUM,
    query: searchText,
    queryFilter: getTermQuery({ isBot: 'false' }),
    searchIndex: SearchIndex.USER,
    sortField: 'displayName.keyword',
    sortOrder: 'asc',
  });

  return response.hits.hits.map(({ _source: source }) => {
    const { color, backgroundColor, character } = getRandomColor(
      source.displayName ?? source.name ?? ''
    );

    return {
      ...toEntityReferenceOption({
        id: source.id,
        type: EntityType.USER,
        name: source.name,
        displayName: source.displayName,
        fullyQualifiedName: source.fullyQualifiedName,
      }),
      icon: (
        <Avatar
          initials={character}
          size="xs"
          src={source.profile?.images?.image ?? undefined}
          style={{ color, backgroundColor }}
        />
      ),
    };
  });
};

const fetchTeamOptions = async (
  searchText: string
): Promise<EntityReferenceOption[]> => {
  const response = await searchQuery({
    pageNumber: 1,
    pageSize: PAGE_SIZE_MEDIUM,
    query: searchText,
    queryFilter: getTermQuery({}, 'must', undefined, {
      matchTerms: { teamType: 'Group' },
    }),
    searchIndex: SearchIndex.TEAM,
    sortField: 'displayName.keyword',
    sortOrder: 'asc',
  });

  return getEntityReferenceListFromEntities(
    formatTeamsResponse(response.hits.hits),
    EntityType.TEAM
  ).map((reference) => ({
    ...toEntityReferenceOption(reference),
    icon: <Avatar placeholderIcon={Teams} size="xs" />,
  }));
};

export interface EntityReferencePicker {
  options: EntityReferenceOption[];
  onFocus: () => void;
  onSearchChange: (searchText: string) => void;
}

const fetchUserTeamOptions = async (
  searchText: string
): Promise<EntityReferenceOption[]> => {
  const [users, teams] = await Promise.all([
    fetchUserOptions(searchText),
    fetchTeamOptions(searchText),
  ]);

  return [...users, ...teams];
};

const fetchDomainOptions = async (
  searchText: string
): Promise<EntityReferenceOption[]> => {
  const domains: Domain[] = await searchDomains(searchText, 1);

  return domains.map((domain) =>
    toEntityReferenceOption({
      id: domain.id,
      type: EntityType.DOMAIN,
      name: domain.name,
      displayName: domain.displayName,
      fullyQualifiedName: domain.fullyQualifiedName,
    })
  );
};

/**
 * Server-searched options for one picker. Each search text is its own query,
 * and only the current one renders — so a slow, older response (e.g. the
 * unfiltered focus search) can never overwrite the results for what the user
 * typed since. Nothing is fetched until the picker is first focused.
 */
const useSearchPicker = (
  queryKey: string,
  fetchOptions: (searchText: string) => Promise<EntityReferenceOption[]>
): EntityReferencePicker => {
  const [isActive, setIsActive] = useState(false);
  const [searchText, setSearchText] = useState('');
  const debouncedSearchText = useDebouncedValue(searchText, SEARCH_DEBOUNCE_MS);

  const { data: options = NO_OPTIONS } = useQuery({
    queryKey: ['glossary-form', queryKey, debouncedSearchText],
    queryFn: () => fetchOptions(debouncedSearchText),
    enabled: isActive,
    staleTime: OPTIONS_STALE_TIME_MS,
    // Keeps the last list on screen while the next search is in flight.
    placeholderData: keepPreviousData,
  });

  const onFocus = useCallback(() => setIsActive(true), []);

  // Stable identity, so field configs memoized on the picker stay memoized.
  return useMemo(
    () => ({ options, onFocus, onSearchChange: setSearchText }),
    [options, onFocus]
  );
};

/** Users and teams, for an owners or reviewers picker. */
export const useUserTeamOptions = () =>
  useSearchPicker('user-team-options', fetchUserTeamOptions);

export const useDomainOptions = () =>
  useSearchPicker('domain-options', fetchDomainOptions);
