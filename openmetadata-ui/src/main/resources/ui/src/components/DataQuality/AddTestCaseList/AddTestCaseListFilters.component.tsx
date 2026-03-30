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

import { Space, Typography } from 'antd';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SearchDropdown from '../../SearchDropdown/SearchDropdown';
import { SearchDropdownOption } from '../../SearchDropdown/SearchDropdown.interface';
import {
    AddTestCaseListFilterKey,
    ADD_TEST_CASE_LIST_FILTERS
} from './AddTestCaseListFilters.constants';
import { AddTestCaseListFiltersProps } from './AddTestCaseListFilters.interface';
import './AddTestCaseListFilters.style.less';

const AddTestCaseListFilters = ({
  filterOptions,
  filterSelectedKeys,
  filterLoading,
  getPopupContainer,
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
    <Space size={8}>
      <Typography.Text>{t('label.filter-plural')}:</Typography.Text>
      {filtersToShow.map((filter) => (
        <SearchDropdown
          hideCounts
          dropdownClassName="add-test-case-filter-dropdown"
          getPopupContainer={getPopupContainer}
          hideSearchBar={!filter.enableSearch}
          isSuggestionsLoading={filterLoading?.[filter.searchKey]}
          key={filter.searchKey}
          label={t(filter.labelKey)}
          options={filterOptions[filter.searchKey]}
          searchKey={filter.searchKey}
          selectedKeys={filterSelectedKeys[filter.searchKey]}
          showSelectedCounts={filter.showSelectedCounts}
          singleSelect={filter.singleSelect}
          onChange={handleChange}
          onSearch={handleSearch}
        />
      ))}
    </Space>
  );
};

export default AddTestCaseListFilters;
