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

import SearchDropdown from 'components/SearchDropdown/SearchDropdown';
import { SearchDropdownOption } from 'components/SearchDropdown/SearchDropdown.interface';
import { WILD_CARD_CHAR } from 'constants/char.constants';
import { INITIAL_PAGING_VALUE } from 'constants/constants';
import { PROMISE_STATE } from 'enums/common.enum';
import { debounce, isEmpty } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import {
  getSearchedTeams,
  getSearchedUsers,
  getUserSuggestions,
} from 'rest/miscAPI';
import { parseSearchParams } from 'utils/Query/QueryUtils';
import { QueryFiltersProps } from '../TableQueries.interface';

const QueryFilters = ({ onFilterChange }: QueryFiltersProps) => {
  const { t } = useTranslation();
  const location = useLocation();

  const selectedFilters = useMemo(() => {
    const searchData = parseSearchParams(location.search);

    return searchData;
  }, [location]);

  const [initialOwnerFilter, setInitialOwnerFilter] = useState<
    SearchDropdownOption[]
  >([]);
  const [ownerFilerOptions, setOwnerFilerOptions] = useState<
    SearchDropdownOption[]
  >([]);
  const [selectedFilter, setSelectedFilter] = useState<SearchDropdownOption[]>(
    selectedFilters.owner ?? []
  );

  const onOwnerFilterChange = (value: SearchDropdownOption[]) => {
    setSelectedFilter(value);
    onFilterChange(value);
  };

  const onOwnerSearch = async (searchText: string) => {
    if (isEmpty(searchText)) {
      setOwnerFilerOptions(initialOwnerFilter);

      return;
    }

    try {
      const users = await getUserSuggestions(searchText);
      const userList = users.data.suggest['metadata-suggest'][0].options;
      const options = userList.map((owner) => ({
        key: owner._source.id,
        label: owner._source.displayName || owner._source.name,
      }));
      setOwnerFilerOptions(options);
    } catch (error) {
      setOwnerFilerOptions([]);
    }
  };

  const debounceOnOwnerSearch = debounce(onOwnerSearch, 500);

  const getInitialUserAndTeam = () => {
    const promise = [
      getSearchedUsers(WILD_CARD_CHAR, INITIAL_PAGING_VALUE),
      getSearchedTeams(WILD_CARD_CHAR, INITIAL_PAGING_VALUE, 'teamType:Group'),
    ];
    Promise.allSettled(promise)
      .then((res) => {
        const [user, team] = res.map((value) => {
          if (value.status === PROMISE_STATE.FULFILLED) {
            const userList = value.value.data.hits.hits;
            const options = userList.map((user) => ({
              key: user._source.id,
              label: user._source.displayName || user._source.name,
            }));

            return options;
          }

          return [];
        });
        setInitialOwnerFilter([...user, ...team]);
        setOwnerFilerOptions([...user, ...team]);
      })
      .catch(() => {
        setInitialOwnerFilter([]);
        setOwnerFilerOptions([]);
      });
  };

  useEffect(() => {
    getInitialUserAndTeam();
  }, []);

  return (
    <SearchDropdown
      showProfilePicture
      label={t('label.owner')}
      options={ownerFilerOptions}
      searchKey="owner"
      selectedKeys={selectedFilter}
      onChange={onOwnerFilterChange}
      onGetInitialOptions={() => setOwnerFilerOptions(initialOwnerFilter)}
      onSearch={debounceOnOwnerSearch}
    />
  );
};

export default QueryFilters;
