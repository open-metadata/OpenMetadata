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
import {
  Box,
  Button,
  Card,
  FilterSelect,
  TriggerButton,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WILD_CARD_CHAR } from '../../constants/char.constants';
import { TEST_CASE_RESOLUTION_STATUS_LABELS } from '../../constants/TestSuite.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType } from '../../enums/entity.enum';
import { EntityReference } from '../../generated/entity/type';
import { TestCaseResolutionStatusTypes } from '../../generated/tests/testCaseResolutionStatus';
import { useDebouncedValue } from '../../hooks/common/useDebouncedValue';
import { getTeamByName } from '../../rest/teamsAPI';
import { getUserByName } from '../../rest/userAPI';
import { getEntityName } from '../../utils/EntityNameUtils';
import { getEntityReferenceFromEntity } from '../../utils/EntityReferenceUtils';
import { getNameFromFQN } from '../../utils/FqnUtils';
import observabilityRouterClassBase from '../../utils/ObservabilityRouterClassBase';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import ErrorPlaceHolder from '../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { UserTeamSelectableList } from '../common/UserTeamSelectableList/UserTeamSelectableList.component';
import DqDateRangeFilter from '../observability/DataQuality/Dashboard/DqDateRangeFilter';
import { IncidentManagerProps } from './IncidentManager.interface';
import IncidentManagerTable from './IncidentManagerTable.component';
import { useIncidentManagerListPage } from './useIncidentManagerListPage';

const toSelection = (value?: string) => (value ? [value] : []);

const IncidentManager = ({
  isIncidentPage = true,
  tableDetails,
  isDateRangePickerVisible = true,
}: IncidentManagerProps) => {
  const { t } = useTranslation();
  const breadcrumbData = useMemo(
    () => [
      {
        name: t('label.incident-manager'),
        url: observabilityRouterClassBase.getIncidentManagerPath(),
      },
    ],
    [t]
  );
  const {
    commonTestCasePermission,
    filters,
    testCaseListData,
    isPermissionLoading,
    testCasePermissions,
    showPagination,
    pagingData,
    handleSeveritySubmit,
    handleAssigneeUpdate,
    updateFilters,
    clearFilters,
    handleStatusSubmit,
    searchTestCases,
  } = useIncidentManagerListPage({ isIncidentPage, tableDetails });

  const captionId = useId();
  const queryClient = useQueryClient();
  const [isTestCasePickerOpen, setIsTestCasePickerOpen] = useState(false);
  const [testCaseSearch, setTestCaseSearch] = useState('');
  const debouncedSearch = useDebouncedValue(testCaseSearch, 300);
  const { data: testCaseOptions = [], isFetching: isTestCaseLoading } =
    useQuery({
      queryKey: ['incident-filter-test-case-options', debouncedSearch],
      queryFn: async () =>
        (await searchTestCases(debouncedSearch || WILD_CARD_CHAR)).reduce<
          { value: string; label: string }[]
        >(
          (options, { value, label }) =>
            value ? [...options, { value, label }] : options,
          []
        ),
      enabled: isTestCasePickerOpen,
      placeholderData: keepPreviousData,
    });
  const { data: selectedAssignee } = useQuery({
    queryKey: ['incident-filter-assignee', filters.assignee],
    queryFn: async (): Promise<EntityReference> => {
      const name = filters.assignee as string;
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
    },
    enabled: Boolean(filters.assignee),
    staleTime: Infinity,
  });
  const onAssigneeFilterUpdate = (assignees?: EntityReference[]) => {
    const assignee = assignees?.[0];
    if (assignee?.name) {
      queryClient.setQueryData(
        ['incident-filter-assignee', assignee.name],
        assignee
      );
    }
    updateFilters({ assignee: assignee?.name });
  };
  const hasActiveFilters =
    [
      filters.testCaseFQN,
      filters.assignee,
      filters.testCaseResolutionStatusType,
      filters.startTs,
      filters.endTs,
    ].some((value) => value !== undefined && value !== '') ||
    filters.dateField === 'updatedAt';

  // Consumer via a hook return value (useIncidentManagerListPage is out of this batch's
  // scope — incident permissions decouple from test-case perms in an open upstream PR
  // #26521). Pure rename: `!hasViewAccess` is De Morgan's law applied to the old
  // `!ViewAll && !ViewBasic` — the exact same condition, just via the named flag.
  const hasViewAccess = getDerivedPermissionFlags(
    commonTestCasePermission ?? DEFAULT_ENTITY_PERMISSION
  ).hasViewAccess;

  if (!hasViewAccess) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.test-case'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <Card className="tw:rounded-(--om-radius-10) tw:border-border-secondary">
      <Box
        align="start"
        className="tw:p-4"
        data-testid="incident-filter-bar"
        gap={3}
        wrap="wrap">
        <Box
          aria-labelledby={`${captionId}-test-case`}
          className="tw:min-w-40 tw:flex-1"
          direction="col"
          gap={2}
          role="group">
          <Typography
            as="span"
            className="tw:text-secondary"
            id={`${captionId}-test-case`}
            size="text-sm"
            weight="medium">
            {t('label.test-case')}
          </Typography>
          <FilterSelect
            searchable
            data-testid="test-case-select"
            isLoading={isTestCaseLoading}
            label={t('label.test-case')}
            options={testCaseOptions}
            resolveMissingLabel={getNameFromFQN}
            selectedValues={toSelection(filters.testCaseFQN)}
            selectionMode="single"
            size="md"
            triggerVariant="input"
            onChange={([testCaseFQN]) => updateFilters({ testCaseFQN })}
            onOpenChange={(isOpen) => {
              setIsTestCasePickerOpen(isOpen);
              if (!isOpen) {
                setTestCaseSearch('');
              }
            }}
            onSearch={setTestCaseSearch}
          />
        </Box>
        <Box
          aria-labelledby={`${captionId}-assignee`}
          className="tw:min-w-40 tw:flex-1"
          direction="col"
          gap={2}
          role="group">
          <Typography
            as="span"
            className="tw:text-secondary"
            id={`${captionId}-assignee`}
            size="text-sm"
            weight="medium">
            {t('label.assignee')}
          </Typography>
          <UserTeamSelectableList
            hasPermission
            label={t('label.assignee')}
            owner={selectedAssignee ? [selectedAssignee] : []}
            onUpdate={onAssigneeFilterUpdate}>
            <TriggerButton
              hasSelection={Boolean(filters.assignee)}
              label={t('label.assignee')}
              size="md"
              testId="select-assignee"
              text={
                getEntityName(selectedAssignee) ||
                filters.assignee ||
                t('label.assignee')
              }
              variant="input"
            />
          </UserTeamSelectableList>
        </Box>
        <Box
          aria-labelledby={`${captionId}-status`}
          className="tw:min-w-40 tw:flex-1"
          direction="col"
          gap={2}
          role="group">
          <Typography
            as="span"
            className="tw:text-secondary"
            id={`${captionId}-status`}
            size="text-sm"
            weight="medium">
            {t('label.status')}
          </Typography>
          <FilterSelect
            hideCounts
            data-testid="status-select"
            label={t('label.status')}
            options={Object.values(TestCaseResolutionStatusTypes).map(
              (status) => ({
                value: status,
                label: TEST_CASE_RESOLUTION_STATUS_LABELS[status],
              })
            )}
            selectedValues={toSelection(filters.testCaseResolutionStatusType)}
            selectionMode="single"
            size="md"
            triggerVariant="input"
            onChange={([status]) =>
              updateFilters({
                testCaseResolutionStatusType: status as
                  | TestCaseResolutionStatusTypes
                  | undefined,
              })
            }
          />
        </Box>
        {isDateRangePickerVisible && (
          <>
            <Box
              aria-labelledby={`${captionId}-date-filter`}
              className="tw:min-w-40 tw:flex-1"
              direction="col"
              gap={2}
              role="group">
              <Typography
                as="span"
                className="tw:text-secondary"
                id={`${captionId}-date-filter`}
                size="text-sm"
                weight="medium">
                {t('label.date-filter')}
              </Typography>
              <FilterSelect
                data-testid="sort-field-dropdown-trigger"
                label={t('label.date-filter')}
                options={[
                  { value: 'timestamp', label: t('label.created-at') },
                  { value: 'updatedAt', label: t('label.updated-at') },
                ]}
                selectedValues={[filters.dateField ?? 'timestamp']}
                selectionMode="single"
                size="md"
                triggerVariant="input"
                onChange={([dateField]) =>
                  updateFilters({
                    dateField: (dateField ?? 'timestamp') as
                      | 'timestamp'
                      | 'updatedAt',
                  })
                }
              />
            </Box>
            <Box
              aria-labelledby={`${captionId}-date-range`}
              className="tw:min-w-40 tw:flex-1"
              direction="col"
              gap={2}
              role="group">
              <Typography
                as="span"
                className="tw:text-secondary"
                id={`${captionId}-date-range`}
                size="text-sm"
                weight="medium">
                {t('label.date-range')}
              </Typography>
              <DqDateRangeFilter
                fullWidth
                endTs={filters.endTs}
                startTs={filters.startTs}
                onApply={(range) => updateFilters(range)}
              />
            </Box>
          </>
        )}
        {hasActiveFilters && (
          <Button
            className="tw:self-end"
            color="link-gray"
            data-testid="incident-clear-filters"
            size="sm"
            onPress={clearFilters}>
            {t('label.clear-all')}
          </Button>
        )}
      </Box>

      <IncidentManagerTable
        breadcrumbData={breadcrumbData}
        handleAssigneeUpdate={handleAssigneeUpdate}
        handleSeveritySubmit={handleSeveritySubmit}
        handleStatusSubmit={handleStatusSubmit}
        isIncidentPage={isIncidentPage}
        isPermissionLoading={isPermissionLoading}
        pagingData={pagingData}
        showPagination={showPagination}
        tableDetails={tableDetails}
        testCaseListData={testCaseListData}
        testCasePermissions={testCasePermissions}
      />
    </Card>
  );
};

export default IncidentManager;
