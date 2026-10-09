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

import {
    Avatar,
    FieldProp,
    FieldTypes,
    FormSelectItem
} from '@openmetadata/ui-core-components';
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_MEDIUM } from '../constants/constants';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { EntityReference } from '../generated/entity/type';
import { searchQuery } from '../rest/searchAPI';
import { getRandomColor } from '../utils/ColorUtils';
import { getEntityName } from '../utils/EntityNameUtils';
import { getTermQuery } from '../utils/SearchPureUtils';

export interface PersonaUserOption extends FormSelectItem {
  value: EntityReference;
}

export const PERSONA_USERS_FIELD = 'users';

/** Selected options → the user references they carry. */
export const getPersonaUserRefs = (options: PersonaUserOption[] = []) =>
  options.map((option) => option.value);

/**
 * The user-only owner picker used by AddDomainForm ("experts"), as a
 * react-hook-form field for the persona forms.
 */
export const usePersonaUsersField = (dataTestId: string): FieldProp => {
  const { t } = useTranslation();
  const [options, setOptions] = useState<PersonaUserOption[]>([]);

  const fetchUsers = useCallback(async (searchText = '') => {
    try {
      const response = await searchQuery({
        pageNumber: 1,
        pageSize: PAGE_SIZE_MEDIUM,
        query: searchText,
        queryFilter: getTermQuery({ isBot: 'false' }),
        searchIndex: SearchIndex.USER,
        sortField: 'displayName.keyword',
        sortOrder: 'asc',
      });

      setOptions(
        response.hits.hits.map(({ _source: user }) => {
          const { color, backgroundColor, character } = getRandomColor(
            user.displayName ?? user.name ?? ''
          );

          return {
            id: user.id,
            label: getEntityName(user),
            supportingText: user.fullyQualifiedName ?? EntityType.USER,
            icon: (
              <Avatar
                initials={character}
                size="xs"
                src={user.profile?.images?.image ?? undefined}
                style={{ color, backgroundColor }}
              />
            ),
            value: {
              id: user.id,
              type: EntityType.USER,
              name: user.name,
              displayName: user.displayName,
              fullyQualifiedName: user.fullyQualifiedName,
            },
          };
        })
      );
    } catch {
      setOptions([]);
    }
  }, []);

  const debouncedSearch = useMemo(
    () => debounce((searchText: string) => void fetchUsers(searchText), 250),
    [fetchUsers]
  );

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  return {
    id: `root/${PERSONA_USERS_FIELD}`,
    name: PERSONA_USERS_FIELD,
    label: t('label.user-plural'),
    placeholder: t('label.select-field', { field: t('label.user-plural') }),
    required: false,
    type: FieldTypes.USER_TEAM_SELECT,
    props: {
      'data-testid': dataTestId,
      filterOption: () => true,
      multiple: true,
      onFocus: () => void fetchUsers(),
      onSearchChange: (searchText: string) => debouncedSearch(searchText),
      options,
    },
  };
};
