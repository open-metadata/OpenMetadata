/*
 *  Copyright 2024 Collate.
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

import { Box, Button } from '@mui/material';
import { XClose } from '@untitledui/icons';
import { Space } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SearchDropdown from '../../../components/SearchDropdown/SearchDropdown';
import { SearchDropdownOption } from '../../../components/SearchDropdown/SearchDropdown.interface';
import {
  CATEGORIES,
  LEARNING_RESOURCE_STATUSES,
  PAGE_IDS,
  RESOURCE_TYPE_VALUES,
} from '../../../constants/Learning.constants';
import { translateWithNestedKeys } from '../../../utils/i18next/LocalUtil';

export interface LearningResourceFilterState {
  type?: string[];
  category?: string[];
  context?: string[];
  status?: string[];
}

interface UseLearningResourceFiltersConfig {
  filterState: LearningResourceFilterState;
  onFilterChange: (filters: LearningResourceFilterState) => void;
}

const TYPE_OPTIONS: SearchDropdownOption[] = RESOURCE_TYPE_VALUES.map((v) => ({
  key: v,
  label: v,
}));

const CATEGORY_OPTIONS: SearchDropdownOption[] = CATEGORIES.map((c) => ({
  key: c.value,
  label: c.label,
}));

const CONTEXT_OPTIONS: SearchDropdownOption[] = PAGE_IDS.map((p) => ({
  key: p.value,
  label: p.label,
}));

const STATUS_OPTIONS: SearchDropdownOption[] = LEARNING_RESOURCE_STATUSES.map(
  (s) => ({ key: s, label: s })
);

const FILTER_FIELDS = [
  { key: 'type' as const, labelKey: 'label.type', options: TYPE_OPTIONS },
  {
    key: 'category' as const,
    labelKey: 'label.category-plural',
    options: CATEGORY_OPTIONS,
  },
  {
    key: 'context' as const,
    labelKey: 'label.context',
    options: CONTEXT_OPTIONS,
  },
  { key: 'status' as const, labelKey: 'label.status', options: STATUS_OPTIONS },
];

export const useLearningResourceFilters = (
  config: UseLearningResourceFiltersConfig
) => {
  const { t } = useTranslation();
  const { filterState, onFilterChange } = config;
  const [optionsByKey, setOptionsByKey] = useState<
    Record<string, SearchDropdownOption[]>
  >({});

  const handleFilterChange = useCallback(
    (key: keyof LearningResourceFilterState, value: string[] | undefined) => {
      onFilterChange({ ...filterState, [key]: value });
    },
    [filterState, onFilterChange]
  );

  const handleRemoveFilter = useCallback(
    (key: keyof LearningResourceFilterState) => {
      onFilterChange({ ...filterState, [key]: undefined });
    },
    [filterState, onFilterChange]
  );

  const handleClearAll = useCallback(() => {
    onFilterChange({
      type: undefined,
      category: undefined,
      context: undefined,
      status: undefined,
    });
  }, [onFilterChange]);

  const getSelectedKeys = useCallback(
    (key: keyof LearningResourceFilterState): SearchDropdownOption[] => {
      const values = filterState[key];
      if (!values || values.length === 0) {
        return [];
      }
      const field = FILTER_FIELDS.find((f) => f.key === key);

      return values
        .map((val) => {
          const option = field?.options.find((o) => o.key === val);

          return option ?? { key: val, label: val };
        })
        .filter(Boolean);
    },
    [filterState]
  );

  const handleDropdownChange = useCallback(
    (values: SearchDropdownOption[], searchKey: string) => {
      const key = searchKey as keyof LearningResourceFilterState;
      const selectedValues =
        values.length > 0 ? values.map((v) => v.key) : undefined;

      handleFilterChange(key, selectedValues);
    },
    [handleFilterChange]
  );

  const handleGetInitialOptions = useCallback((searchKey: string) => {
    const field = FILTER_FIELDS.find((f) => f.key === searchKey);

    if (field) {
      setOptionsByKey((prev) => ({ ...prev, [searchKey]: field.options }));
    }
  }, []);

  const handleSearch = useCallback((searchText: string, searchKey: string) => {
    const field = FILTER_FIELDS.find((f) => f.key === searchKey);

    if (field) {
      const filtered = searchText
        ? field.options.filter((o) =>
            o.label.toLowerCase().includes(searchText.toLowerCase())
          )
        : field.options;

      setOptionsByKey((prev) => ({ ...prev, [searchKey]: filtered }));
    }
  }, []);

  const quickFilters = useMemo(
    () => (
      <Space wrap className="explore-quick-filters-container" size={[8, 0]}>
        {FILTER_FIELDS.map((field) => (
          <SearchDropdown
            hideCounts
            showSelectedCounts
            isSuggestionsLoading={false}
            key={field.key}
            label={translateWithNestedKeys(field.labelKey)}
            options={optionsByKey[field.key] ?? field.options}
            searchKey={field.key}
            selectedKeys={getSelectedKeys(field.key)}
            triggerButtonSize="middle"
            onChange={handleDropdownChange}
            onGetInitialOptions={handleGetInitialOptions}
            onSearch={handleSearch}
          />
        ))}
      </Space>
    ),
    [
      filterState,
      optionsByKey,
      getSelectedKeys,
      handleDropdownChange,
      handleGetInitialOptions,
      handleSearch,
    ]
  );

  const selectedFilters = useMemo(() => {
    const filters: {
      key: keyof LearningResourceFilterState;
      label: string;
      value: string;
    }[] = [];
    if (filterState.type?.length) {
      const labels = filterState.type
        .map((v) => TYPE_OPTIONS.find((o) => o.key === v)?.label ?? v)
        .join(', ');

      filters.push({
        key: 'type',
        label: t('label.type'),
        value: labels,
      });
    }
    if (filterState.category?.length) {
      const labels = filterState.category
        .map((v) => CATEGORIES.find((c) => c.value === v)?.label ?? v)
        .join(', ');

      filters.push({
        key: 'category',
        label: t('label.category-plural'),
        value: labels,
      });
    }
    if (filterState.context?.length) {
      const labels = filterState.context
        .map((v) => PAGE_IDS.find((p) => p.value === v)?.label ?? v)
        .join(', ');

      filters.push({
        key: 'context',
        label: t('label.context'),
        value: labels,
      });
    }
    if (filterState.status?.length) {
      const labels = filterState.status.join(', ');

      filters.push({
        key: 'status',
        label: t('label.status'),
        value: labels,
      });
    }

    return filters;
  }, [filterState, t]);

  const filterSelectionDisplay = useMemo(() => {
    if (selectedFilters.length === 0) {
      return null;
    }

    return (
      <Box className="filter-selection-container">
        <Box className="filter-selection-chips-wrapper">
          {selectedFilters.map((filter) => (
            <Box className="filter-selection-chip" key={filter.key}>
              <Box className="filter-selection-chip-content" component="span">
                <span className="filter-selection-label">{filter.label}: </span>
                <span className="filter-selection-value" title={filter.value}>
                  {filter.value}
                </span>
              </Box>
              <Box
                aria-label="Remove filter"
                className="filter-selection-remove-btn"
                component="button"
                onClick={() => handleRemoveFilter(filter.key)}>
                <XClose size={14} />
              </Box>
            </Box>
          ))}
        </Box>
        <Button
          className="filter-selection-clear-all"
          variant="text"
          onClick={handleClearAll}>
          {t('label.clear-entity', { entity: t('label.all-lowercase') })}
        </Button>
      </Box>
    );
  }, [selectedFilters, handleRemoveFilter, handleClearAll, t]);

  return {
    quickFilters,
    filterSelectionDisplay,
    selectedFilters,
    hasFilters: selectedFilters.length > 0,
  };
};
