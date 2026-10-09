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

import { Box, Typography } from '@openmetadata/ui-core-components';

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import FilterSelectDropdown from '../../common/FilterSelectDropdown/FilterSelectDropdown';
import { SearchDropdownOption } from '../../SearchDropdown/SearchDropdown.interface';
import {
  AddTestCaseListFilterKey,
  ADD_TEST_CASE_LIST_FILTERS,
} from './AddTestCaseListFilters.constants';
import { AddTestCaseListFiltersProps } from './AddTestCaseListFilters.interface';
import './AddTestCaseListFilters.style.less';

const AddTestCaseListFilters = ({
  filterOptions,
  filterSelectedKeys,
  filterLoading,
  hideTableFilter = false,
  onChange,
  onSearch,
}: AddTestCaseListFiltersProps) => {
  const { t } = useTranslation();
  const filtersToShow = useMemo(
    () =>
      ADD_TEST_CASE_LIST_FILTERS.filter(
        (filter) =>
          !hideTableFilter ||
          filter.searchKey !== AddTestCaseListFilterKey.Table
      ),
    [hideTableFilter]
  );

  const handleChange = useCallback(
    (values: SearchDropdownOption[], searchKey: string) => {
      onChange(values, searchKey as AddTestCaseListFilterKey);
    },
    [onChange]
  );

  const handleSearch = useCallback(
    (searchText: string, searchKey: string) => {
      onSearch(searchText, searchKey as AddTestCaseListFilterKey);
    },
    [onSearch]
  );

  return (
    <Box
      inline
      align="center"
      className="layout-space layout-space-horizontal"
      gap={2}
      itemClassName="layout-space-item">
      <Typography>{t('label.filter-plural')}:</Typography>
      {filtersToShow.map((filter) => (
        <FilterSelectDropdown
          hideCounts
          hideSearchBar={!filter.enableSearch}
          isSuggestionsLoading={filterLoading?.[filter.searchKey]}
          key={filter.searchKey}
          label={t(filter.labelKey)}
          options={filterOptions[filter.searchKey]}
          searchKey={filter.searchKey}
          selectedKeys={filterSelectedKeys[filter.searchKey]}
          singleSelect={filter.singleSelect}
          onChange={handleChange}
          onSearch={handleSearch}
        />
      ))}
    </Box>
  );
};

export default AddTestCaseListFilters;
