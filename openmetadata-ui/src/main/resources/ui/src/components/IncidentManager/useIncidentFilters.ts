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
import { isEqual, omit, pick } from 'lodash';
import { DateRangeObject } from 'Models';
import QueryString, { ParsedQs } from 'qs';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Option } from '../../pages/TasksPage/TasksPage.interface';
import { TestCaseIncidentStatusParams } from '../../rest/incidentManagerAPI';

// Static, single-select options for the incident resolution status filter.
export interface UseIncidentFiltersProps {
  filters: TestCaseIncidentStatusParams;
  allParams: ParsedQs;
}

/**
 * Owns the FILTERS concern: the URL-backed filter mutations and the
 * date-filter state. The parsed params and the coerced filters are injected.
 * The URL stringify stays hand-rolled with QueryString.
 */
export const useIncidentFilters = ({
  filters,
  allParams,
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
  };
};
