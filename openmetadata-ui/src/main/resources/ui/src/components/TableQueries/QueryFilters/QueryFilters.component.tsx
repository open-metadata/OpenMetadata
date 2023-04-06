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

import { Space, Typography } from 'antd';
import SearchDropdown from 'components/SearchDropdown/SearchDropdown';
import { SearchDropdownOption } from 'components/SearchDropdown/SearchDropdown.interface';
import { WILD_CARD_CHAR } from 'constants/char.constants';
import { INITIAL_PAGING_VALUE } from 'constants/constants';
import { QUERY_PAGE_FILTER } from 'constants/Query.constant';
import { PROMISE_STATE } from 'enums/common.enum';
import { debounce, isEmpty } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation } from 'react-router-dom';
import {
  getSearchedTeams,
  getSearchedUsers,
  getSuggestedTeams,
  getSuggestedUsers,
} from 'rest/miscAPI';
import { parseSearchParams } from 'utils/Query/QueryUtils';
import { QueryFiltersProps, QueryFiltersType } from '../TableQueries.interface';

const QueryFilters = ({ onFilterChange }: QueryFiltersProps) => {
  const { t } = useTranslation();
  const location = useLocation();
  const history = useHistory();

  const { selectedFilters, searchData } = useMemo(() => {
    const searchData = parseSearchParams(location.search);

    const filters = {
      user: searchData.user || [],
      team: searchData.team || [],
    } as QueryFiltersType;

    return { selectedFilters: filters, searchData };
  }, [location]);

  const [initialOwnerFilter, setInitialOwnerFilter] =
    useState<QueryFiltersType>(QUERY_PAGE_FILTER);
  const [ownerFilerOptions, setOwnerFilerOptions] =
    useState<QueryFiltersType>(QUERY_PAGE_FILTER);
  const [selectedFilter, setSelectedFilter] = useState<QueryFiltersType>(
    selectedFilters ?? QUERY_PAGE_FILTER
  );

  const onOwnerFilterChange = (
    value: SearchDropdownOption[],
    searchKey: string
  ) => {
    setSelectedFilter((pre) => {
      const updatedFilter = { ...pre, [searchKey]: value };
      onFilterChange(updatedFilter);

      return updatedFilter;
    });
  };

  const onUserSearch = async (searchText: string) => {
    if (isEmpty(searchText)) {
      setOwnerFilerOptions((pre) => ({
        ...pre,
        user: initialOwnerFilter.user,
      }));

      return;
    }

    try {
      const users = await getSuggestedUsers(searchText);
      const userList = users.data.suggest['metadata-suggest'][0].options;
      const options = userList.map((user) => ({
        key: user._source.id,
        label: user._source.displayName || user._source.name,
      }));
      setOwnerFilerOptions((pre) => ({ ...pre, user: options }));
    } catch (error) {
      setOwnerFilerOptions((pre) => ({ ...pre, user: [] }));
    }
  };
  const onTeamSearch = async (searchText: string) => {
    if (isEmpty(searchText)) {
      setOwnerFilerOptions((pre) => ({
        ...pre,
        team: initialOwnerFilter.team,
      }));

      return;
    }

    try {
      const teams = await getSuggestedTeams(searchText);
      const teamList = teams.data.suggest['metadata-suggest'][0].options;
      const options = teamList.map((team) => ({
        key: team._source.id,
        label: team._source.displayName || team._source.name,
      }));
      setOwnerFilerOptions((pre) => ({ ...pre, team: options }));
    } catch (error) {
      setOwnerFilerOptions((pre) => ({ ...pre, team: [] }));
    }
  };

  const debounceOnUserSearch = debounce(onUserSearch, 500);
  const debounceOnTeamSearch = debounce(onTeamSearch, 500);

  const getInitialUserAndTeam = () => {
    const promise = [
      getSearchedUsers(WILD_CARD_CHAR, INITIAL_PAGING_VALUE),
      getSearchedTeams(WILD_CARD_CHAR, INITIAL_PAGING_VALUE),
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
        setInitialOwnerFilter((pre) => ({ ...pre, team, user }));
        setOwnerFilerOptions((pre) => ({ ...pre, team, user }));
      })
      .catch(() => {
        setInitialOwnerFilter((pre) => ({ ...pre, team: [], user: [] }));
        setOwnerFilerOptions((pre) => ({ ...pre, team: [], user: [] }));
      });
  };

  useEffect(() => {
    getInitialUserAndTeam();
  }, []);

  return (
    <Space size={8}>
      <Typography.Text>{t('label.owner')}</Typography.Text>
      <SearchDropdown
        showProfilePicture
        label={t('label.user')}
        options={ownerFilerOptions.user}
        searchKey="user"
        selectedKeys={selectedFilter.user}
        onChange={onOwnerFilterChange}
        onGetInitialOptions={() =>
          setOwnerFilerOptions((pre) => ({
            ...pre,
            user: initialOwnerFilter.user,
          }))
        }
        onSearch={debounceOnUserSearch}
      />
      <SearchDropdown
        label={t('label.team')}
        options={ownerFilerOptions.team}
        searchKey="team"
        selectedKeys={selectedFilter.team}
        onChange={onOwnerFilterChange}
        onGetInitialOptions={() =>
          setOwnerFilerOptions((pre) => ({
            ...pre,
            user: initialOwnerFilter.team,
          }))
        }
        onSearch={debounceOnTeamSearch}
      />
    </Space>
  );
};

export default QueryFilters;
