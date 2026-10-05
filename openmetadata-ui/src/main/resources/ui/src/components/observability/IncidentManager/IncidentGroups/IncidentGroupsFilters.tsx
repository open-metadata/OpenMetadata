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
  Dot,
  FilterSelect,
  TriggerButton,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { startCase } from 'lodash';
import { ReactNode, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WILD_CARD_CHAR } from '../../../../constants/char.constants';
import { TEST_CASE_RESOLUTION_STATUS_LABELS } from '../../../../constants/TestSuite.constant';
import { EntityType } from '../../../../enums/entity.enum';
import { EntityReference } from '../../../../generated/entity/type';
import { useDebouncedValue } from '../../../../hooks/common/useDebouncedValue';
import { OpenIncidentStatus } from '../../../../rest/incidentManagerAPI';
import { getTeamByName } from '../../../../rest/teamsAPI';
import { getUserByName } from '../../../../rest/userAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getEntityReferenceFromEntity } from '../../../../utils/EntityReferenceUtils';
import { getNameFromFQN } from '../../../../utils/FqnUtils';
import { UserTeamSelectableList } from '../../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import { useIncidentFilterOptions } from '../../../IncidentManager/useIncidentFilterOptions';
import DqDateRangeFilter from '../../DataQuality/Dashboard/DqDateRangeFilter';
import {
  CLEARED_INCIDENT_GROUP_FILTERS,
  DEFAULT_INCIDENT_LIST_DATE_FIELD,
  INCIDENT_GROUP_STATUS_OPTIONS,
  INCIDENT_SEVERITY_DOT_CLASS,
  INCIDENT_SEVERITY_FILTER_OPTIONS,
  NO_SEVERITY_FILTER,
} from './IncidentGroups.constants';
import {
  IncidentGroupsFiltersProps,
  IncidentListDateField,
  IncidentSeverityFilter,
} from './IncidentGroups.types';
import { hasActiveIncidentGroupFilters } from './IncidentGroups.utils';

const STATUS_OPTIONS = INCIDENT_GROUP_STATUS_OPTIONS.map((status) => ({
  value: status,
  label: TEST_CASE_RESOLUTION_STATUS_LABELS[status],
}));

const TEST_CASE_SEARCH_DEBOUNCE_MS = 300;
const NO_OPTIONS: { value: string; label: string }[] = [];

const toSelection = (value?: string) => (value ? [value] : []);

const assigneeQueryKey = (name?: string) =>
  ['incident-group-assignee', name] as const;

/**
 * The assignee the URL names, a user or a team. The filter keeps only the name,
 * so a reloaded page has to read who it is to show them picked.
 */
const fetchAssignee = async (name: string): Promise<EntityReference> => {
  try {
    return getEntityReferenceFromEntity(
      await getUserByName(name),
      EntityType.USER
    );
  } catch {
    try {
      return getEntityReferenceFromEntity(
        await getTeamByName(name),
        EntityType.TEAM
      );
    } catch {
      return { id: name, name, type: EntityType.USER };
    }
  }
};

/**
 * A captioned filter. The caption names the group its control sits in, so a
 * trigger showing only the picked value is still announced with its field.
 */
const FilterField = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => {
  const captionId = useId();

  return (
    <Box
      aria-labelledby={captionId}
      className="tw:min-w-40 tw:flex-1"
      direction="col"
      gap={2}
      role="group">
      <Typography
        as="span"
        className="tw:text-secondary"
        id={captionId}
        size="text-sm"
        weight="medium">
        {label}
      </Typography>
      {children}
    </Box>
  );
};

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
  // The same coloured dot each severity's badge is drawn in, before its name.
  const severityOptions = useMemo(
    () =>
      INCIDENT_SEVERITY_FILTER_OPTIONS.map((severity) => ({
        value: severity,
        label:
          severity === NO_SEVERITY_FILTER
            ? t('label.no-entity', { entity: t('label.severity') })
            : startCase(severity),
        icon: (
          <Dot
            aria-hidden="true"
            className={INCIDENT_SEVERITY_DOT_CLASS[severity]}
            size="md"
          />
        ),
      })),
    [t]
  );
  const queryClient = useQueryClient();
  const { searchTestCases } = useIncidentFilterOptions({
    filters: { testCaseFQN: filters.testCaseFQN, assignee: filters.assignee },
  });
  const [isTestCasePickerOpened, setIsTestCasePickerOpened] = useState(false);
  const [testCaseSearch, setTestCaseSearch] = useState('');
  const debouncedTestCaseSearch = useDebouncedValue(
    testCaseSearch,
    TEST_CASE_SEARCH_DEBOUNCE_MS
  );
  // One query per search text, so a slow older search never overwrites the
  // results of a newer one.
  const { data: testCaseOptions = NO_OPTIONS, isFetching: isTestCaseLoading } =
    useQuery({
      queryKey: ['incident-group-test-case-options', debouncedTestCaseSearch],
      queryFn: async () =>
        (
          await searchTestCases(debouncedTestCaseSearch || WILD_CARD_CHAR)
        ).reduce<{ value: string; label: string }[]>(
          (options, { value, label }) =>
            value ? [...options, { value, label }] : options,
          []
        ),
      enabled: isTestCasePickerOpened,
      placeholderData: keepPreviousData,
    });
  const { data: selectedAssignee } = useQuery({
    queryKey: assigneeQueryKey(filters.assignee),
    // Only runs with an assignee to read, as `enabled` below says.
    queryFn: () => fetchAssignee(filters.assignee as string),
    enabled: Boolean(filters.assignee),
    staleTime: Infinity,
  });

  const handleAssigneeUpdate = (assignees?: EntityReference[]) => {
    const assignee = assignees?.[0];
    // The picker hands back who it is, so the name needs no lookup.
    if (assignee?.name) {
      queryClient.setQueryData(assigneeQueryKey(assignee.name), assignee);
    }
    onChange({ assignee: assignee?.name });
  };

  const dateFieldOptions = [
    { value: 'timestamp', label: t('label.created-at') },
    { value: 'updatedAt', label: t('label.updated-at') },
  ];

  const hasActiveFilters = hasActiveIncidentGroupFilters(filters);

  return (
    <Box align="start" gap={3} wrap="wrap">
      <FilterField label={t('label.test-case')}>
        <FilterSelect
          searchable
          data-testid="incident-groups-test-case"
          isLoading={isTestCaseLoading}
          label={t('label.test-case')}
          options={testCaseOptions}
          resolveMissingLabel={getNameFromFQN}
          selectedValues={toSelection(filters.testCaseFQN)}
          selectionMode="single"
          size="md"
          triggerVariant="input"
          onChange={([testCaseFQN]) => onChange({ testCaseFQN })}
          onOpenChange={(isOpen) =>
            isOpen ? setIsTestCasePickerOpened(true) : setTestCaseSearch('')
          }
          onSearch={setTestCaseSearch}
        />
      </FilterField>
      <FilterField label={t('label.assignee')}>
        {/* Incidents are assigned to users and to teams: the shared picker
            lists both, a tab each. */}
        <UserTeamSelectableList
          hasPermission
          label={t('label.assignee')}
          owner={filters.assignee && selectedAssignee ? [selectedAssignee] : []}
          onUpdate={handleAssigneeUpdate}>
          <TriggerButton
            hasSelection={Boolean(filters.assignee)}
            label={t('label.assignee')}
            size="md"
            testId="incident-groups-assignee"
            text={
              filters.assignee
                ? getEntityName(selectedAssignee) || filters.assignee
                : t('label.assignee')
            }
            variant="input"
          />
        </UserTeamSelectableList>
      </FilterField>
      <FilterField label={t('label.status')}>
        <FilterSelect
          hideCounts
          data-testid="incident-groups-status"
          label={t('label.status')}
          options={STATUS_OPTIONS}
          selectedValues={filters.status}
          selectionMode="multiple"
          size="md"
          triggerVariant="input"
          onChange={(status) =>
            onChange({ status: status as OpenIncidentStatus[] })
          }
        />
      </FilterField>
      <FilterField label={t('label.severity')}>
        <FilterSelect
          hideCounts
          data-testid="incident-groups-severity"
          label={t('label.severity')}
          options={severityOptions}
          selectedValues={filters.severity}
          selectionMode="multiple"
          size="md"
          triggerVariant="input"
          onChange={(severity) =>
            onChange({ severity: severity as IncidentSeverityFilter[] })
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
          size="md"
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
          onPress={() => onChange(CLEARED_INCIDENT_GROUP_FILTERS)}>
          {t('label.clear-all')}
        </Button>
      )}
    </Box>
  );
};

export default IncidentGroupsFilters;
