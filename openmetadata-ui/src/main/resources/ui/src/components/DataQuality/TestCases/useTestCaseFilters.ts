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
import { FormProps } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { DefaultOptionType } from 'antd/lib/select';
import { entries, isEmpty, isUndefined, uniq, values } from 'lodash';
import QueryString from 'qs';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TEST_CASE_DIMENSIONS_OPTION,
  TEST_CASE_FILTERS,
  TEST_CASE_FILTERS_LABELS,
  TEST_CASE_PLATFORM_OPTION,
  TEST_CASE_STATUS_OPTION,
  TEST_CASE_TYPE_OPTION,
} from '../../../constants/profiler.constant';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { TestCaseSearchParams } from '../DataQuality.interface';
import {
  FilterControlType,
  FilterDescriptor,
  FilterOptionData,
  FilterValue,
} from './FilterChip.interface';
import { FetchedOption } from './useTestCaseFilterOptions';

const DEFAULT_SELECTED_FILTERS = [
  TEST_CASE_FILTERS.status,
  TEST_CASE_FILTERS.type,
  TEST_CASE_FILTERS.table,
  TEST_CASE_FILTERS.tags,
];

const STATIC_OPTIONS: Record<string, DefaultOptionType[]> = {
  [TEST_CASE_FILTERS.platform]: TEST_CASE_PLATFORM_OPTION,
  [TEST_CASE_FILTERS.type]: TEST_CASE_TYPE_OPTION,
  [TEST_CASE_FILTERS.status]: TEST_CASE_STATUS_OPTION,
  [TEST_CASE_FILTERS.dimension]: TEST_CASE_DIMENSIONS_OPTION,
};

const MULTI_SELECT_FILTERS = new Set<string>([
  TEST_CASE_FILTERS.platform,
  TEST_CASE_FILTERS.tags,
]);

const SEARCHABLE_FILTERS = new Set<string>([
  TEST_CASE_FILTERS.table,
  TEST_CASE_FILTERS.tags,
  TEST_CASE_FILTERS.service,
  TEST_CASE_FILTERS.dataProduct,
]);

// TEST_CASE_FILTERS_LABELS is keyed by filter name (e.g. "table"); descriptors
// key by the param value (e.g. "tableFqn"), so map value -> label once here.
const FILTER_LABEL_BY_KEY: Record<string, string> = Object.fromEntries(
  entries(TEST_CASE_FILTERS).map(([name, value]) => [
    value,
    TEST_CASE_FILTERS_LABELS[name],
  ])
);

const getControlType = (key: string): FilterControlType => {
  let controlType: FilterControlType = 'select';
  if (key === TEST_CASE_FILTERS.lastRun) {
    controlType = 'date';
  } else if (MULTI_SELECT_FILTERS.has(key)) {
    controlType = 'multiselect';
  }

  return controlType;
};

export interface UseTestCaseFiltersProps {
  getInitialOptions: (key: string, isLengthCheck?: boolean) => void;
  isOptionsLoading: boolean;
  asyncOptionsByKey: Record<string, FetchedOption[]>;
  onSearchByKey: Record<string, (search: string) => void>;
}

/**
 * Owns the FILTERS concern: the URL-backed params, the selected-filter set, the
 * antd form, every handler that mutates them and the filter-agnostic
 * {@link FilterDescriptor} builder co-located with that state. The async option
 * lists, their loading flag and the search fetchers are injected from
 * {@link useTestCaseFilterOptions}. The URL parse/stringify stays hand-rolled.
 */
export const useTestCaseFilters = ({
  getInitialOptions,
  isOptionsLoading,
  asyncOptionsByKey,
  onSearchByKey,
}: UseTestCaseFiltersProps) => {
  const navigate = useNavigate();
  const location = useCustomLocation();
  const [form] = useForm();

  const params = useMemo(() => {
    const search = location.search;
    const parsed = QueryString.parse(
      search.startsWith('?') ? search.substring(1) : search
    ) as TestCaseSearchParams;

    return parsed;
  }, [location.search]);

  const { searchValue = '' } = params;

  const [selectedFilter, setSelectedFilter] = useState<string[]>(
    DEFAULT_SELECTED_FILTERS
  );

  const handleSearchParam = useCallback(
    <K extends keyof TestCaseSearchParams>(
      key: K,
      value?: TestCaseSearchParams[K]
    ) => {
      navigate({
        search: QueryString.stringify(
          { ...params, [key]: value ?? undefined },
          { arrayFormat: 'brackets' }
        ),
      });
    },
    [navigate, params]
  );

  const handleFilterChange: FormProps<TestCaseSearchParams>['onValuesChange'] =
    (value?: TestCaseSearchParams) => {
      if (!isUndefined(value)) {
        const [data] = Object.entries(value);
        handleSearchParam(data[0] as keyof TestCaseSearchParams, data[1]);
      }
    };

  const handleMenuClick = ({ key }: { key: string }) => {
    setSelectedFilter((prevSelected) => {
      if (prevSelected.includes(key)) {
        const updatedValue = prevSelected.filter(
          (selected) => selected !== key
        );
        form.setFieldsValue({ [key]: undefined });

        return updatedValue;
      }

      return uniq([...prevSelected, key]);
    });
    getInitialOptions(key);
    handleSearchParam(key as keyof TestCaseSearchParams);
  };

  const filterMenu: ItemType[] = useMemo(
    () =>
      entries(TEST_CASE_FILTERS).map(([name, filter]) => ({
        key: filter,
        label: TEST_CASE_FILTERS_LABELS[name],
        value: filter,
      })),
    []
  );

  const toPlainOptions = (options: DefaultOptionType[]): FilterOptionData[] =>
    options.map((option) => ({
      value: String(option.value),
      label:
        (option as FetchedOption).name ??
        (typeof option.label === 'string'
          ? option.label
          : String(option.value)),
      subLabel: (option as FetchedOption).subLabel,
    }));

  const filters = useMemo<FilterDescriptor[]>(() => {
    const keys = entries(TEST_CASE_FILTERS)
      .map(([, filter]) => filter)
      .filter((filter) => selectedFilter.includes(filter));

    return keys.map((key) => {
      const paramKey = key;
      const options = STATIC_OPTIONS[key] ?? asyncOptionsByKey[key] ?? [];

      return {
        key,
        paramKey,
        label: FILTER_LABEL_BY_KEY[key],
        controlType: getControlType(key),
        searchable: SEARCHABLE_FILTERS.has(key),
        value: params[paramKey],
        options: toPlainOptions(options),
        isLoading: isOptionsLoading,
        onGetInitialOptions: () => getInitialOptions(key),
        onSearch: onSearchByKey[key],
        onChange: (value?: FilterValue) =>
          handleSearchParam(
            paramKey,
            value as TestCaseSearchParams[typeof paramKey]
          ),
      };
    });
  }, [selectedFilter, params, isOptionsLoading, asyncOptionsByKey]);

  // True when any filter (table/type/status/tags/…) currently has a value; the
  // table-header search is intentionally excluded so it survives a clear-all.
  const hasActiveFilters = useMemo(
    () =>
      values(TEST_CASE_FILTERS).some((paramKey) => !isEmpty(params[paramKey])),
    [params]
  );

  const clearAll = useCallback(() => {
    setSelectedFilter(DEFAULT_SELECTED_FILTERS);
    form.resetFields();
    navigate({
      search: QueryString.stringify(searchValue ? { searchValue } : {}, {
        arrayFormat: 'brackets',
      }),
    });
  }, [form, navigate, searchValue]);

  return {
    params,
    searchValue,
    selectedFilter,
    setSelectedFilter,
    form,
    handleMenuClick,
    handleSearchParam,
    handleFilterChange,
    filterMenu,
    filters,
    hasActiveFilters,
    clearAll,
  };
};
