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

import { Space } from 'antd';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import SearchDropdown from '../../SearchDropdown/SearchDropdown';
import { SearchDropdownOption } from '../../SearchDropdown/SearchDropdown.interface';
import {
  AddTestCaseListFilterKey,
  ADD_TEST_CASE_LIST_FILTERS,
} from './AddTestCaseListFilters.constants';
import { AddTestCaseListFiltersProps } from './AddTestCaseListFilters.interface';

const AddTestCaseListFilters = ({
  filterOptions,
  filterSelectedKeys,
  onChange,
  onSearch,
}: AddTestCaseListFiltersProps) => {
  const { t } = useTranslation();

  const handleChange = useCallback(
    (values: SearchDropdownOption[], searchKey: string) => {
      onChange(values, searchKey as AddTestCaseListFilterKey);
    },
    [onChange]
  );

  return (
    <Space className="tw-flex-wrap" size="middle">
      {ADD_TEST_CASE_LIST_FILTERS.map((filter) => (
        <SearchDropdown
          hideCounts
          hideSearchBar
          key={filter.searchKey}
          label={t(filter.labelKey)}
          options={filterOptions[filter.searchKey]}
          searchKey={filter.searchKey}
          selectedKeys={filterSelectedKeys[filter.searchKey]}
          showSelectedCounts={filter.showSelectedCounts}
          singleSelect={filter.singleSelect}
          onChange={handleChange}
          onSearch={onSearch}
        />
      ))}
    </Space>
  );
};

export default AddTestCaseListFilters;
