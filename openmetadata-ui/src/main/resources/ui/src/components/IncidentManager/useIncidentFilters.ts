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
import { isEqual, noop, omit, pick } from 'lodash';
import { DateRangeObject } from 'Models';
import QueryString, { ParsedQs } from 'qs';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { TEST_CASE_RESOLUTION_STATUS_LABELS } from '../../constants/TestSuite.constant';
import { EntityReference } from '../../generated/tests/testCase';
import { TestCaseResolutionStatusTypes } from '../../generated/tests/testCaseResolutionStatus';
import { TestCaseIncidentStatusData } from '../../pages/IncidentManager/IncidentManager.interface';
import { Option } from '../../pages/TasksPage/TasksPage.interface';
import { TestCaseIncidentStatusParams } from '../../rest/incidentManagerAPI';
import {
  FilterDateValue,
  FilterDescriptor,
  FilterOptionData,
} from '../DataQuality/TestCases/FilterChip.interface';

// Static, single-select options for the incident resolution status filter.
const STATUS_FILTER_OPTIONS: FilterOptionData[] = Object.values(
  TestCaseResolutionStatusTypes
).map((value) => ({
  value,
  label: TEST_CASE_RESOLUTION_STATUS_LABELS[value],
}));

export interface UseIncidentFiltersProps {
  filters: TestCaseIncidentStatusParams;
  allParams: ParsedQs;
  testCaseListData: TestCaseIncidentStatusData;
  testCaseFilterOptions: FilterOptionData[];
  isTestCaseOptionsLoading: boolean;
  fetchTestCaseFilterOptions: (query?: string) => void;
}

/**
 * Owns the FILTERS concern: the URL-backed filter mutations, the date-filter
 * state, the picker-selected assignee derivation and the filter-agnostic
 * {@link FilterDescriptor} builder consumed by the AI-mode FilterBar. The parsed
 * params, the coerced filters, the loaded rows and the test-case option cluster
 * are injected. The URL stringify stays hand-rolled with QueryString.
 */
export const useIncidentFilters = ({
  filters,
  allParams,
  testCaseListData,
  testCaseFilterOptions,
  isTestCaseOptionsLoading,
  fetchTestCaseFilterOptions,
}: UseIncidentFiltersProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const dateRangeKey = useMemo(() => {
    // Only return date range if URL has explicit date params
    if (allParams.key && filters.startTs && filters.endTs) {
      return {
        key: allParams.key as string,
        title: allParams.title as string,
        startTs: filters.startTs,
        endTs: filters.endTs,
      };
    }

    // No date range selected - show placeholder
    return undefined;
  }, [allParams.key, allParams.title, filters.startTs, filters.endTs]);

  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);

  const dateFilterOptions = useMemo(
    () => [
      { name: t('label.created-at'), value: 'timestamp' },
      { name: t('label.updated-at'), value: 'updatedAt' },
    ],
    [t]
  );

  const selectedDateFilterKey = (filters.dateField as string) ?? 'timestamp';
  const selectedDateFilterOption =
    dateFilterOptions.find((o) => o.value === selectedDateFilterKey) ??
    dateFilterOptions[0];

  const updateFilters = useCallback(
    (
      newFilters: Partial<TestCaseIncidentStatusParams>,
      dateRangeParams?: { key: string; title: string }
    ) => {
      const updatedFilters = { ...filters, ...newFilters };
      const allUpdatedParams = dateRangeParams
        ? { ...updatedFilters, ...dateRangeParams }
        : { ...allParams, ...updatedFilters };

      navigate(
        {
          search: QueryString.stringify(allUpdatedParams),
        },
        {
          replace: true,
        }
      );
    },
    [filters, allParams, navigate]
  );

  const handleAssigneeChange = (value?: Option[]) => {
    updateFilters({ assignee: value ? value[0]?.name : value });
  };

  const handleDateRangeChange = (value: DateRangeObject) => {
    const updatedFilter = pick(value, ['startTs', 'endTs']);
    const existingFilters = pick(filters, ['startTs', 'endTs']);
    const dateRangeParams = pick(value, ['key', 'title']) as {
      key: string;
      title: string;
    };

    if (!isEqual(existingFilters, updatedFilter)) {
      updateFilters(updatedFilter, dateRangeParams);
    }
  };

  const handleDateFieldChange = useCallback(
    (value: string) => {
      updateFilters({ dateField: value as 'timestamp' | 'updatedAt' });
    },
    [updateFilters]
  );

  const handleDateRangeClear = useCallback(() => {
    const updatedFilters = omit(allParams, [
      'startTs',
      'endTs',
      'key',
      'title',
      'dateField',
    ]);
    navigate(
      {
        search: QueryString.stringify(updatedFilters),
      },
      {
        replace: true,
      }
    );
  }, [allParams, navigate]);

  const [assigneeOwnerRefs, setAssigneeOwnerRefs] = useState<EntityReference[]>(
    []
  );

  const handleAssigneeOwnerChange = useCallback(
    (owners: EntityReference[] = []) => {
      setAssigneeOwnerRefs(owners);
      updateFilters({ assignee: owners[0]?.name });
    },
    [updateFilters]
  );

  // On a shared/refreshed link (?assignee=foo) the picker state starts empty.
  // Since the list is filtered by that assignee, each loaded incident carries
  // their full EntityReference — derive the selected owner from it so the picker
  // pre-selects and the chip shows the display name, without an extra lookup.
  const assigneeOwners = useMemo<EntityReference[]>(() => {
    if (!filters.assignee) {
      return [];
    }
    // Use the picker-selected refs only when they still match the active filter,
    // so a stale ref doesn't survive clear-all / browser nav / a URL change to a
    // different ?assignee=.
    if (assigneeOwnerRefs.some((owner) => owner?.name === filters.assignee)) {
      return assigneeOwnerRefs;
    }
    const match = testCaseListData.data
      .map((record) => record.testCaseResolutionStatusDetails?.assignee)
      .find((assignee) => assignee?.name === filters.assignee);

    return match ? [match] : [];
  }, [assigneeOwnerRefs, filters.assignee, testCaseListData.data]);

  // Filter descriptors consumed by the AI-mode FilterBar. Migrated one at a time;
  // the OSS renderer keeps its own antd filter bar. Memoized (with useCallback'd
  // handlers) so the descriptor array stays referentially stable for the renderer.
  const filterDescriptors = useMemo<FilterDescriptor[]>(
    () => [
      {
        key: 'testCaseFQN',
        paramKey: 'testCaseFQN',
        label: t('label.test-case'),
        controlType: 'select',
        searchable: true,
        value: filters.testCaseFQN,
        options: testCaseFilterOptions,
        isLoading: isTestCaseOptionsLoading,
        onGetInitialOptions: () => {
          fetchTestCaseFilterOptions();
        },
        onSearch: (query: string) => {
          fetchTestCaseFilterOptions(query);
        },
        onChange: (value) =>
          updateFilters({ testCaseFQN: value as string | undefined }),
      },
      {
        key: 'assignee',
        paramKey: 'assignee',
        label: t('label.assignee'),
        controlType: 'user',
        searchable: false,
        value: filters.assignee,
        options: [],
        isLoading: false,
        onGetInitialOptions: noop,
        onChange: noop,
        selectedOwners: assigneeOwners,
        onOwnerChange: handleAssigneeOwnerChange,
      },
      {
        key: 'testCaseResolutionStatusType',
        paramKey: 'testCaseResolutionStatusType',
        label: t('label.status'),
        controlType: 'select',
        searchable: false,
        value: filters.testCaseResolutionStatusType,
        options: STATUS_FILTER_OPTIONS,
        isLoading: false,
        onGetInitialOptions: noop,
        onChange: (value) =>
          updateFilters({
            testCaseResolutionStatusType: value as
              | TestCaseResolutionStatusTypes
              | undefined,
          }),
      },
      {
        key: 'dateField',
        paramKey: 'dateField',
        label: t('label.date-filter'),
        controlType: 'select',
        searchable: false,
        value: selectedDateFilterKey,
        options: dateFilterOptions.map((option) => ({
          label: option.name,
          value: option.value,
        })),
        isLoading: false,
        onGetInitialOptions: noop,
        onChange: (value) =>
          handleDateFieldChange((value as string) ?? 'timestamp'),
      },
      {
        key: 'dateRange',
        paramKey: 'startTs',
        label: t('label.date-range'),
        controlType: 'date',
        searchable: false,
        value: { startTs: filters.startTs, endTs: filters.endTs },
        options: [],
        isLoading: false,
        onGetInitialOptions: noop,
        onChange: (value) => {
          const range = value as FilterDateValue | undefined;
          updateFilters({ startTs: range?.startTs, endTs: range?.endTs });
        },
      },
    ],
    [
      t,
      filters,
      testCaseFilterOptions,
      isTestCaseOptionsLoading,
      fetchTestCaseFilterOptions,
      updateFilters,
      assigneeOwners,
      handleAssigneeOwnerChange,
      selectedDateFilterKey,
      dateFilterOptions,
      handleDateFieldChange,
    ]
  );

  const hasActiveFilters = Boolean(
    filters.testCaseFQN ||
      filters.testCaseResolutionStatusType ||
      filters.assignee ||
      filters.startTs ||
      filters.endTs
  );

  const clearAllFilters = useCallback(() => {
    setAssigneeOwnerRefs([]);
    updateFilters({
      testCaseFQN: undefined,
      testCaseResolutionStatusType: undefined,
      assignee: undefined,
      startTs: undefined,
      endTs: undefined,
      dateField: undefined,
    });
  }, [updateFilters]);

  return {
    dateRangeKey,
    isDateFilterOpen,
    setIsDateFilterOpen,
    dateFilterOptions,
    selectedDateFilterKey,
    selectedDateFilterOption,
    updateFilters,
    handleAssigneeChange,
    handleDateRangeChange,
    handleDateFieldChange,
    handleDateRangeClear,
    filterDescriptors,
    hasActiveFilters,
    clearAllFilters,
  };
};
