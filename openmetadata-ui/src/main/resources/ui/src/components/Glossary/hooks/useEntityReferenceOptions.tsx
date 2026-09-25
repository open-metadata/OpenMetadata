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
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PAGE_SIZE_MEDIUM } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { Domain } from '../../../generated/entity/domains/domain';
import { searchDomains } from '../../../rest/domainAPI';
import { searchQuery } from '../../../rest/searchAPI';
import { formatTeamsResponse } from '../../../utils/APIUtils';
import { getRandomColor } from '../../../utils/ColorUtils';
import { getEntityReferenceListFromEntities } from '../../../utils/EntityReferenceUtils';
import { getTermQuery } from '../../../utils/SearchPureUtils';
import { EntityReferenceOption } from '../AddGlossary/AddGlossary.interface';
import { toEntityReferenceOption } from '../AddGlossary/AddGlossary.utils';

const SEARCH_DEBOUNCE_MS = 250;

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

/**
 * Server-searched option lists for the owner / reviewer / domain pickers of
 * the glossary and glossary term forms. Options load lazily on first focus
 * and re-query (debounced) as the user types.
 */
export const useEntityReferenceOptions = () => {
  const [userOptions, setUserOptions] = useState<EntityReferenceOption[]>([]);
  const [teamOptions, setTeamOptions] = useState<EntityReferenceOption[]>([]);
  const [domainOptions, setDomainOptions] = useState<EntityReferenceOption[]>(
    []
  );

  const loadUserTeamOptions = useCallback(async (searchText = '') => {
    try {
      const [users, teams] = await Promise.all([
        fetchUserOptions(searchText),
        fetchTeamOptions(searchText),
      ]);
      setUserOptions(users);
      setTeamOptions(teams);
    } catch {
      setUserOptions([]);
      setTeamOptions([]);
    }
  }, []);

  const loadDomainOptions = useCallback(async (searchText = '') => {
    try {
      const domains = await searchDomains(searchText, 1);
      setDomainOptions(
        domains.map((domain: Domain) =>
          toEntityReferenceOption({
            id: domain.id,
            type: EntityType.DOMAIN,
            name: domain.name,
            displayName: domain.displayName,
            fullyQualifiedName: domain.fullyQualifiedName,
          })
        )
      );
    } catch {
      setDomainOptions([]);
    }
  }, []);

  const searchUserTeams = useMemo(
    () =>
      debounce(
        (searchText: string) => void loadUserTeamOptions(searchText),
        SEARCH_DEBOUNCE_MS
      ),
    [loadUserTeamOptions]
  );

  const searchDomainOptions = useMemo(
    () =>
      debounce(
        (searchText: string) => void loadDomainOptions(searchText),
        SEARCH_DEBOUNCE_MS
      ),
    [loadDomainOptions]
  );

  useEffect(
    () => () => {
      searchUserTeams.cancel();
      searchDomainOptions.cancel();
    },
    [searchUserTeams, searchDomainOptions]
  );

  const userTeamOptions = useMemo(
    () => [...userOptions, ...teamOptions],
    [userOptions, teamOptions]
  );

  return {
    userTeamOptions,
    domainOptions,
    onUserTeamFocus: useCallback(
      () => void loadUserTeamOptions(),
      [loadUserTeamOptions]
    ),
    onUserTeamSearch: searchUserTeams,
    onDomainFocus: useCallback(
      () => void loadDomainOptions(),
      [loadDomainOptions]
    ),
    onDomainSearch: searchDomainOptions,
  };
};
