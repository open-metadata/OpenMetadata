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

import { noop } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TEST_CASE_RESOLUTION_STATUS_LABELS } from '../../../../constants/TestSuite.constant';
import { EntityReference } from '../../../../generated/entity/type';
import { IncidentDateField } from '../../../../rest/incidentManagerAPI';
import {
  FilterDateValue,
  FilterDescriptor,
  FilterOptionData,
} from '../../../DataQuality/TestCases/FilterChip.interface';
import { useIncidentFilterOptions } from '../../../IncidentManager/useIncidentFilterOptions';
import {
  DEFAULT_INCIDENT_DATE_FIELD,
  INCIDENT_DATE_FIELD_OPTIONS,
  INCIDENT_GROUPS_FILTER_PARAMS,
  OPEN_INCIDENT_STATUSES,
} from './IncidentGroups.constants';
import { IncidentGroupsFilters } from './IncidentGroups.types';

const STATUS_FILTER_OPTIONS: FilterOptionData[] = OPEN_INCIDENT_STATUSES.map(
  (status) => ({
    value: status,
    label: TEST_CASE_RESOLUTION_STATUS_LABELS[status],
  })
);

interface UseIncidentGroupsFiltersProps {
  filters: IncidentGroupsFilters;
  onFiltersChange: (filters: Partial<IncidentGroupsFilters>) => void;
}

/**
 * The groups filter bar, as the descriptors the shared `FilterBar` renders:
 * each control maps onto one groups endpoint param and hands its change back
 * through `onFiltersChange`, which owns the URL.
 */
export const useIncidentGroupsFilters = ({
  filters,
  onFiltersChange,
}: UseIncidentGroupsFiltersProps) => {
  const { t } = useTranslation();
  const {
    testCaseFilterOptions,
    isTestCaseOptionsLoading,
    fetchTestCaseFilterOptions,
  } = useIncidentFilterOptions({ filters: { assignee: filters.assignee } });

  // The URL only carries the assignee's name. The reference picked here gives
  // the chip a display name; a shared link falls back to showing the name.
  const [pickedAssignee, setPickedAssignee] = useState<EntityReference>();
  const selectedAssignees = useMemo(
    () =>
      pickedAssignee && pickedAssignee.name === filters.assignee
        ? [pickedAssignee]
        : [],
    [filters.assignee, pickedAssignee]
  );

  const handleAssigneeChange = useCallback(
    (owners: EntityReference[] = []) => {
      setPickedAssignee(owners[0]);
      onFiltersChange({ assignee: owners[0]?.name });
    },
    [onFiltersChange]
  );

  const dateFieldOptions = useMemo(
    () =>
      INCIDENT_DATE_FIELD_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    [t]
  );

  const filterDescriptors = useMemo<FilterDescriptor[]>(
    () => [
      {
        key: INCIDENT_GROUPS_FILTER_PARAMS.testCaseFQN,
        paramKey: INCIDENT_GROUPS_FILTER_PARAMS.testCaseFQN,
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
          onFiltersChange({ testCaseFQN: (value as string) || undefined }),
      },
      {
        key: INCIDENT_GROUPS_FILTER_PARAMS.assignee,
        paramKey: INCIDENT_GROUPS_FILTER_PARAMS.assignee,
        label: t('label.assignee'),
        controlType: 'user',
        searchable: false,
        value: filters.assignee,
        options: [],
        isLoading: false,
        onGetInitialOptions: noop,
        onChange: noop,
        selectedOwners: selectedAssignees,
        onOwnerChange: handleAssigneeChange,
      },
      {
        key: INCIDENT_GROUPS_FILTER_PARAMS.status,
        paramKey: INCIDENT_GROUPS_FILTER_PARAMS.status,
        label: t('label.status'),
        controlType: 'multiselect',
        searchable: false,
        value: filters.status,
        options: STATUS_FILTER_OPTIONS,
        isLoading: false,
        onGetInitialOptions: noop,
        onChange: (value) =>
          onFiltersChange({
            status: value as IncidentGroupsFilters['status'],
          }),
      },
      {
        key: INCIDENT_GROUPS_FILTER_PARAMS.dateField,
        paramKey: INCIDENT_GROUPS_FILTER_PARAMS.dateField,
        label: t('label.date-filter'),
        controlType: 'select',
        searchable: false,
        value: filters.dateField ?? DEFAULT_INCIDENT_DATE_FIELD,
        options: dateFieldOptions,
        isLoading: false,
        onGetInitialOptions: noop,
        // The default is left out of the URL, where the flat listing below
        // would not recognise it.
        onChange: (value) =>
          onFiltersChange({
            dateField:
              value === DEFAULT_INCIDENT_DATE_FIELD || !value
                ? undefined
                : (value as IncidentDateField),
          }),
      },
      {
        key: 'dateRange',
        paramKey: INCIDENT_GROUPS_FILTER_PARAMS.startTs,
        label: t('label.date-range'),
        controlType: 'date',
        searchable: false,
        value: { startTs: filters.startTs, endTs: filters.endTs },
        options: [],
        isLoading: false,
        onGetInitialOptions: noop,
        onChange: (value) => {
          const range = value as FilterDateValue | undefined;
          onFiltersChange({ startTs: range?.startTs, endTs: range?.endTs });
        },
      },
    ],
    [
      t,
      filters,
      testCaseFilterOptions,
      isTestCaseOptionsLoading,
      fetchTestCaseFilterOptions,
      onFiltersChange,
      selectedAssignees,
      handleAssigneeChange,
      dateFieldOptions,
    ]
  );

  return filterDescriptors;
};
