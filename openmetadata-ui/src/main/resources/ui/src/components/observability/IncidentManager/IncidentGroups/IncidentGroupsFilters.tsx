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

import {
  Box,
  Button,
  FilterSelect,
  Typography,
} from '@openmetadata/ui-core-components';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { WILD_CARD_CHAR } from '../../../../constants/char.constants';
import { TEST_CASE_RESOLUTION_STATUS_LABELS } from '../../../../constants/TestSuite.constant';
import { OpenIncidentStatus } from '../../../../rest/incidentManagerAPI';
import { getNameFromFQN } from '../../../../utils/FqnUtils';
import { useIncidentFilterOptions } from '../../../IncidentManager/useIncidentFilterOptions';
import DqDateRangeFilter from '../../DataQuality/Dashboard/DqDateRangeFilter';
import {
  DEFAULT_INCIDENT_LIST_DATE_FIELD,
  INCIDENT_GROUP_STATUS_OPTIONS,
} from './IncidentGroups.constants';
import {
  IncidentGroupFilters,
  IncidentGroupsFiltersProps,
  IncidentListDateField,
} from './IncidentGroups.types';

// Every filter key, emptied: an absent date field reads back as the default.
const CLEARED_FILTERS: Partial<IncidentGroupFilters> = {
  testCaseFQN: undefined,
  assignee: undefined,
  status: [],
  dateField: undefined,
  startTs: undefined,
  endTs: undefined,
};

const STATUS_OPTIONS = INCIDENT_GROUP_STATUS_OPTIONS.map((status) => ({
  value: status,
  label: TEST_CASE_RESOLUTION_STATUS_LABELS[status],
}));

const toSelection = (value?: string) => (value ? [value] : []);

const FilterField = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <Box className="tw:min-w-40 tw:flex-1" direction="col" gap={2}>
    <Typography
      as="span"
      className="tw:text-secondary"
      size="text-sm"
      weight="medium">
      {label}
    </Typography>
    {children}
  </Box>
);

/**
 * The filter row above the incident groups. Every control reports a partial
 * change of the filter set; persisting it — and going back to the first page —
 * is the caller's job.
 */
const IncidentGroupsFilters = ({
  filters,
  onChange,
}: IncidentGroupsFiltersProps) => {
  const { t } = useTranslation();
  const {
    assigneeOptionsWithSelected,
    fetchUserFilterOptions,
    testCaseFilterOptions,
    isTestCaseOptionsLoading,
    fetchTestCaseFilterOptions,
  } = useIncidentFilterOptions({ filters });

  const dateFieldOptions = [
    { value: 'timestamp', label: t('label.created-at') },
    { value: 'updatedAt', label: t('label.updated-at') },
  ];

  const assigneeOptions = assigneeOptionsWithSelected.map((option) => ({
    value: option.value,
    label: option.label,
  }));

  const hasActiveFilters =
    [
      filters.testCaseFQN,
      filters.assignee,
      filters.startTs,
      filters.endTs,
    ].some((value) => value !== undefined) ||
    filters.status.length > 0 ||
    filters.dateField !== DEFAULT_INCIDENT_LIST_DATE_FIELD;

  return (
    <Box
      align="start"
      data-testid="incident-groups-filters"
      gap={3}
      wrap="wrap">
      <FilterField label={t('label.test-case')}>
        <FilterSelect
          searchable
          data-testid="incident-groups-test-case"
          isLoading={isTestCaseOptionsLoading}
          label={t('label.test-case')}
          options={testCaseFilterOptions}
          resolveMissingLabel={getNameFromFQN}
          selectedValues={toSelection(filters.testCaseFQN)}
          selectionMode="single"
          triggerVariant="input"
          onChange={([testCaseFQN]) => onChange({ testCaseFQN })}
          onOpenChange={(isOpen) => isOpen && fetchTestCaseFilterOptions()}
          onSearch={(text) =>
            fetchTestCaseFilterOptions(text || WILD_CARD_CHAR)
          }
        />
      </FilterField>
      <FilterField label={t('label.assignee')}>
        <FilterSelect
          searchable
          data-testid="incident-groups-assignee"
          label={t('label.assignee')}
          options={assigneeOptions}
          selectedValues={toSelection(filters.assignee)}
          selectionMode="single"
          triggerVariant="input"
          onChange={([assignee]) => onChange({ assignee })}
          onOpenChange={(isOpen) =>
            isOpen && fetchUserFilterOptions(WILD_CARD_CHAR)
          }
          onSearch={(text) => fetchUserFilterOptions(text || WILD_CARD_CHAR)}
        />
      </FilterField>
      <FilterField label={t('label.status')}>
        <FilterSelect
          hideCounts
          data-testid="incident-groups-status"
          label={t('label.status')}
          options={STATUS_OPTIONS}
          selectedValues={filters.status}
          selectionMode="multiple"
          triggerVariant="input"
          onChange={(status) =>
            onChange({ status: status as OpenIncidentStatus[] })
          }
        />
      </FilterField>
      <FilterField label={t('label.date-filter')}>
        <FilterSelect
          data-testid="incident-groups-date-field"
          label={t('label.date-filter')}
          options={dateFieldOptions}
          selectedValues={[filters.dateField]}
          selectionMode="single"
          triggerVariant="input"
          onChange={([dateField]) =>
            onChange({
              dateField: (dateField ??
                DEFAULT_INCIDENT_LIST_DATE_FIELD) as IncidentListDateField,
            })
          }
        />
      </FilterField>
      <FilterField label={t('label.date-range')}>
        <DqDateRangeFilter
          fullWidth
          endTs={filters.endTs}
          size="sm"
          startTs={filters.startTs}
          onApply={(range) => onChange(range)}
        />
      </FilterField>
      {hasActiveFilters && (
        <Button
          className="tw:self-end"
          color="link-gray"
          data-testid="incident-groups-clear-filters"
          size="sm"
          onPress={() => onChange(CLEARED_FILTERS)}>
          {t('label.clear-all')}
        </Button>
      )}
    </Box>
  );
};

export default IncidentGroupsFilters;
