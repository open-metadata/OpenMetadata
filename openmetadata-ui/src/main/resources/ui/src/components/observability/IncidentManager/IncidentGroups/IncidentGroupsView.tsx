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
  Divider,
  EmptyPlaceholder,
  PaginationCardWithControls,
  TableCard,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
// The core-components icon barrel re-exports the design team's own SVG set
import {
  Search,
  ShieldTick,
  TrendUp01,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { isEmpty, sumBy } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsRouteVisible } from '../../../../context/RouteVisibilityProvider/RouteVisibilityProvider';
import { TestCaseResolutionStatusTypes as CreateStatusTypes } from '../../../../generated/api/tests/createTestCaseResolutionStatus';
import { TestCaseIncidentGroup } from '../../../../generated/tests/testCaseIncidentGroup';
import { useDomainStore } from '../../../../hooks/useDomainStore';
import { Transi18next } from '../../../../utils/i18next/LocalUtil';
import { computeTotalPages } from '../../../../utils/PaginationUtils';
import {
  showErrorToast,
  showInfoToast,
  showSuccessToast,
} from '../../../../utils/ToastUtils';
import Loader from '../../../common/Loader/Loader';
import IncidentGroupBulkFailuresModal from './IncidentGroupBulkFailuresModal';
import IncidentGroupBulkStatusModal from './IncidentGroupBulkStatusModal';
import IncidentGroupByDropdown from './IncidentGroupByDropdown';
import IncidentGroupDetail from './IncidentGroupDetail';
import IncidentGroupDrawer from './IncidentGroupDrawer';
import {
  CLEARED_INCIDENT_GROUP_FILTERS,
  INCIDENT_GROUPS_PAGE_SIZE_OPTIONS,
} from './IncidentGroups.constants';
import {
  BulkIncidentChange,
  BulkIncidentOutcome,
  BulkIncidentStatus,
  IncidentGroupBulkStatusModalProps,
  IncidentGroupsViewProps,
} from './IncidentGroups.types';
import {
  countRecurringIncidentGroups,
  getIncidentGroupKey,
  hasActiveIncidentGroupFilters,
} from './IncidentGroups.utils';
import IncidentGroupsFilters from './IncidentGroupsFilters';
import IncidentGroupsLoadError from './IncidentGroupsLoadError';
import IncidentGroupsSelectionBar from './IncidentGroupsSelectionBar';
import IncidentGroupsTable from './IncidentGroupsTable';
import { useIncidentGroupBulkUpdate } from './useIncidentGroupBulkUpdate';
import { useIncidentGroups } from './useIncidentGroups';

const STAT_COUNT_ELEMENT = (
  <Typography as="span" className="tw:text-primary" weight="semibold" />
);

/**
 * Grouped incident listing: the `Group by` dimension picker, the header stats
 * over the fetched groups, the filter row, and the paged group table — plus
 * the loading/empty/error states of the fetch that feeds them.
 */
const IncidentGroupsView = ({ refreshKey }: IncidentGroupsViewProps) => {
  const { t } = useTranslation();
  const {
    refresh,
    groupBy,
    filters,
    incidentGroups,
    paging,
    sortType,
    currentPage,
    pageSize,
    isLoading,
    isError,
    retry,
    detailKey,
    detailGroup,
    isDetailLoading,
    isDetailError,
    retryDetail,
    openGroup,
    closeGroup,
    handleGroupByChange,
    handleFiltersChange,
    handleSortTypeChange,
    handlePageChange,
    handlePageSizeChange,
  } = useIncidentGroups({ refreshKey });
  const { isApplying, applyBulkChange } = useIncidentGroupBulkUpdate({
    filters,
  });

  /**
   * Only the loaded page can be counted: the endpoint reports the group total
   * but no recurring total, and a group is recurring by a field that only
   * arrives with the group itself.
   */
  const recurringCount = useMemo(
    () => countRecurringIncidentGroups(incidentGroups),
    [incidentGroups]
  );

  /**
   * A refetch keeps the rows it already has: swapping the table for a loader on
   * every sort click or status change flashes the section away, drops keyboard
   * focus from the sort header, and shifts the incidents table the user is
   * working in. Only a load with nothing to show yet takes the whole space.
   */
  const isInitialLoading = isLoading && isEmpty(incidentGroups);

  // Picked groups by key, kept across pages so a selection can span them.
  const [selection, setSelection] = useState<
    ReadonlyMap<string, TestCaseIncidentGroup>
  >(new Map());
  // The status that needs more than itself (an assignee, a reason), while its
  // details are being asked for.
  const [pendingStatus, setPendingStatus] =
    useState<IncidentGroupBulkStatusModalProps['status']>();
  const [bulkOutcome, setBulkOutcome] = useState<BulkIncidentOutcome>();

  // Another dimension or other filters make other groups; a page or a sort
  // only shows the same ones differently.
  const { activeDomain } = useDomainStore();
  // The domain scopes the groups as the filters do, so a selection made under
  // another one would apply its change outside what is listed.
  useEffect(() => setSelection(new Map()), [groupBy, filters, activeDomain]);

  const selectedGroups = [...selection.values()];
  const selectedKeys = useMemo(() => new Set(selection.keys()), [selection]);
  const selectedIncidentCount = sumBy(selectedGroups, 'incidentCount');
  const clearSelection = () => setSelection(new Map());

  const handleGroupSelect = (
    group: TestCaseIncidentGroup,
    isSelected: boolean
  ) =>
    setSelection((previous) => {
      const next = new Map(previous);
      if (isSelected) {
        next.set(getIncidentGroupKey(group), group);
      } else {
        next.delete(getIncidentGroupKey(group));
      }

      return next;
    });

  const handlePageSelect = (isSelected: boolean) =>
    incidentGroups.forEach((group) => handleGroupSelect(group, isSelected));

  const runBulkChange = async (change: BulkIncidentChange) => {
    try {
      const outcome = await applyBulkChange(selectedGroups, change);

      if (outcome.failures.length > 0) {
        setBulkOutcome(outcome);
      } else if (outcome.total === 0) {
        showInfoToast(t('message.bulk-incident-no-change'));
      } else {
        showSuccessToast(
          outcome.unchanged > 0
            ? t('message.bulk-incident-update-success-skipped', {
                count: outcome.passed,
                skipped: outcome.unchanged,
              })
            : t('message.bulk-incident-update-success', {
                count: outcome.passed,
              })
        );
      }
      clearSelection();
      refresh();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setPendingStatus(undefined);
    }
  };

  const handleSetStatus = (status: BulkIncidentStatus) =>
    status === CreateStatusTypes.ACK
      ? runBulkChange({ kind: 'status', status })
      : setPendingStatus(status);

  const [previewGroup, setPreviewGroup] = useState<TestCaseIncidentGroup>();
  const isRouteVisible = useIsRouteVisible();
  // The row the user drilled in from, to hand focus back to on the way out.
  const [returnFocusKey, setReturnFocusKey] = useState<string>();

  const handleOpenGroup = useCallback(
    (group: TestCaseIncidentGroup) => {
      setPreviewGroup(undefined);

      return openGroup(group);
    },
    [openGroup]
  );

  const handleBack = useCallback(() => {
    setReturnFocusKey(detailGroup && getIncidentGroupKey(detailGroup));

    return closeGroup();
  }, [closeGroup, detailGroup]);

  useEffect(() => {
    if (detailKey !== undefined || !returnFocusKey) {
      return;
    }
    // The table builds its rows a pass after it mounts, so the row is looked
    // up once they are in.
    const testId = `group-open-${returnFocusKey}`.replaceAll(
      '"',
      String.raw`\"`
    );
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.focus();
      setReturnFocusKey(undefined);
    });

    return () => cancelAnimationFrame(frame);
  }, [detailKey, returnFocusKey]);

  const renderContent = () => {
    if (isInitialLoading) {
      return (
        // As tall as the empty and error states, so the page does not jump.
        <Box
          className="tw:min-h-80 tw:items-center tw:justify-center"
          data-testid="incident-groups-loader">
          <Loader />
        </Box>
      );
    }

    if (isError) {
      return (
        <IncidentGroupsLoadError
          data-testid="incident-groups-error"
          onRetry={retry}
        />
      );
    }

    if (isEmpty(incidentGroups)) {
      // Filtered down to nothing is not the same as having no incidents.
      return hasActiveIncidentGroupFilters(filters) ? (
        <Box
          className="tw:relative tw:min-h-80 tw:w-full"
          data-testid="incident-groups-no-match">
          <EmptyPlaceholder
            actions={[
              {
                key: 'clear-filters',
                color: 'secondary',
                label: t('label.clear-filter-plural'),
                onPress: () =>
                  handleFiltersChange(CLEARED_INCIDENT_GROUP_FILTERS),
              },
            ]}
            description={t('message.try-adjusting-filter')}
            icon={<Search className="tw:text-fg-quaternary" />}
            title={t('message.no-match-found')}
            variant="blank"
          />
        </Box>
      ) : (
        <Box
          className="tw:relative tw:min-h-80 tw:w-full"
          data-testid="incident-groups-empty">
          <EmptyPlaceholder
            description={t('message.no-active-incidents-description')}
            icon={<ShieldTick className="tw:text-fg-brand-primary" />}
            title={t('message.no-active-incidents')}
            variant="blank"
          />
        </Box>
      );
    }

    return (
      <>
        {selectedGroups.length > 0 && (
          <IncidentGroupsSelectionBar
            incidentCount={selectedIncidentCount}
            isApplying={isApplying}
            selectedCount={selectedGroups.length}
            onClearSelection={clearSelection}
            onSetSeverity={(severity) =>
              runBulkChange({ kind: 'severity', severity })
            }
            onSetStatus={handleSetStatus}
          />
        )}
        <TableCard.Root>
          <IncidentGroupsTable
            groupBy={groupBy}
            groups={incidentGroups}
            selectedKeys={selectedKeys}
            sortType={sortType}
            onGroupOpen={handleOpenGroup}
            onGroupPreview={setPreviewGroup}
            onGroupSelect={handleGroupSelect}
            onPageSelect={handlePageSelect}
            onSortTypeChange={handleSortTypeChange}
          />
          <PaginationCardWithControls
            className="tw:border-0"
            page={currentPage}
            pageSize={pageSize}
            pageSizeOptions={INCIDENT_GROUPS_PAGE_SIZE_OPTIONS}
            total={Math.max(
              1,
              computeTotalPages(
                pageSize,
                paging?.total ?? incidentGroups.length
              )
            )}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </TableCard.Root>
      </>
    );
  };

  const renderDetail = () => {
    if (detailGroup) {
      return (
        <IncidentGroupDetail
          filters={filters}
          group={detailGroup}
          onBack={handleBack}
          onClearFilters={() =>
            handleFiltersChange(CLEARED_INCIDENT_GROUP_FILTERS)
          }
        />
      );
    }

    if (isDetailLoading) {
      return (
        <Box
          className="tw:min-h-80 tw:items-center tw:justify-center"
          data-testid="incident-group-detail-loader">
          <Loader />
        </Box>
      );
    }

    return isDetailError ? (
      <IncidentGroupsLoadError
        data-testid="incident-group-detail-error"
        onRetry={retryDetail}
      />
    ) : (
      // The group a link names may have no open incident left in this scope.
      <Box
        className="tw:relative tw:min-h-80 tw:w-full"
        data-testid="incident-group-detail-missing">
        <EmptyPlaceholder
          actions={[
            {
              key: 'back',
              color: 'secondary',
              label: t('label.back-to-group-plural'),
              onPress: handleBack,
            },
          ]}
          description={t('message.try-adjusting-filter')}
          icon={<Search className="tw:text-fg-quaternary" />}
          title={t('message.no-match-found')}
          variant="blank"
        />
      </Box>
    );
  };

  const hasStats = !isInitialLoading && !isError;
  const groupCount = paging?.total ?? incidentGroups.length;

  return (
    <Box
      aria-busy={isLoading}
      className="tw:gap-4"
      data-testid="incident-groups"
      direction="col">
      {detailKey === undefined ? (
        <>
          <Box className="tw:items-center tw:justify-between tw:gap-2">
            {/* Kept when empty, so the dimension picker stays on the right. */}
            <Box align="center" gap={3}>
              {hasStats && (
                <>
                  <Typography
                    as="span"
                    className="tw:text-secondary"
                    data-testid="incident-groups-count"
                    size="text-sm">
                    <Transi18next
                      i18nKey="label.group-count"
                      renderElement={STAT_COUNT_ELEMENT}
                      values={{ count: groupCount }}
                    />
                  </Typography>
                  <Divider className="tw:h-4" orientation="vertical" />
                  <Tooltip
                    placement="top"
                    title={t('message.recurring-groups-loaded')}>
                    <TooltipTrigger>
                      <Box align="center" gap={1}>
                        <TrendUp01 className="tw:size-4 tw:text-fg-error-primary" />
                        <Typography
                          as="span"
                          className="tw:text-secondary"
                          data-testid="incident-groups-recurring-count"
                          size="text-sm">
                          <Transi18next
                            i18nKey="label.recurring-count"
                            renderElement={STAT_COUNT_ELEMENT}
                            values={{ count: recurringCount }}
                          />
                        </Typography>
                      </Box>
                    </TooltipTrigger>
                  </Tooltip>
                </>
              )}
            </Box>
            <IncidentGroupByDropdown
              value={groupBy}
              onChange={handleGroupByChange}
            />
          </Box>
          <IncidentGroupsFilters
            filters={filters}
            onChange={handleFiltersChange}
          />
          {renderContent()}
        </>
      ) : (
        renderDetail()
      )}
      <IncidentGroupBulkStatusModal
        incidentCount={selectedIncidentCount}
        isApplying={isApplying}
        status={pendingStatus}
        onApply={(details) =>
          pendingStatus &&
          runBulkChange({ kind: 'status', status: pendingStatus, details })
        }
        onCancel={() => setPendingStatus(undefined)}
      />
      <IncidentGroupBulkFailuresModal
        outcome={bulkOutcome}
        onClose={() => setBulkOutcome(undefined)}
      />
      <IncidentGroupDrawer
        filters={filters}
        // The app keeps this page mounted, hidden, while another route shows,
        // but the drawer is portaled above everything: it waits for the page to
        // come back, as open as it was left.
        group={isRouteVisible ? previewGroup : undefined}
        onClose={() => setPreviewGroup(undefined)}
        onViewAll={handleOpenGroup}
      />
    </Box>
  );
};

export default IncidentGroupsView;
