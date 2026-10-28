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
import { Box, EmptyPlaceholderAction } from '@openmetadata/ui-core-components';
import { Plus } from '@openmetadata/ui-core-components/icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TEST_CASE_DELETION_MODE } from '../../../../constants/DataQuality.constants';
import { DataQualityPageTabs } from '../../../../pages/DataQuality/DataQualityPage.interface';
import { useDataQualityProvider } from '../../../../pages/DataQuality/DataQualityProvider';
import observabilityRouterClassBase from '../../../../utils/ObservabilityRouterClassBase';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';
import PermissionPlaceholder from '../../../common/EmptyPlaceholder/PermissionPlaceholder';
import DataQualityTab from '../../../Database/Profiler/DataQualityTab/DataQualityTab';
import TestCaseListTableHeader from '../../../DataQuality/TestCases/TestCaseListTableHeader.component';
import { getTestCaseListDisplayState } from '../../../DataQuality/TestCases/TestCases.utils';
import { useTestCaseListPage } from '../../../DataQuality/TestCases/useTestCaseListPage';
import FilterBar from '../../common/FilterChip/FilterBar';
import DqSummaryPanel from '../DqSummaryPanel';

/**
 * App-mode Test Cases tab — composes its own layout (untitled-ui filter bar +
 * reused OSS summary + table) from the shared useTestCaseListPage hook, mirroring
 * the dashboard pattern. Only the filter bar differs from the classic renderer.
 */
const TestCases = () => {
  const { t } = useTranslation();
  const { createActions } = useDataQualityProvider();
  const {
    testCasePermission,
    testSuitePermission,
    testCaseSummary,
    isTestCaseSummaryLoading,
    searchValue,
    selectedFilter,
    handleMenuClick,
    handleSearchParam,
    filterMenu,
    filters,
    hasActiveFilters,
    clearAll,
    testCase,
    entityPermissions,
    isLoading,
    pagingData,
    showPagination,
    sortTestCase,
    handleTestCaseUpdate,
    handleStatusSubmit,
    extraDropdownContent,
    showDeleted,
    handleShowDeletedChange,
    handleAfterDeleteAction,
  } = useTestCaseListPage();

  // testCasePermission is a resource-level permission (usePermissionProvider().permissions.
  // testCase, threaded through useTestCaseListPage). Itself OperationPermission-shaped, so it
  // runs through getDerivedPermissionFlags exactly like an entity-level fetch, mirroring the
  // classic TestCases.component.tsx precedent. Falls back to DEFAULT_ENTITY_PERMISSION
  // (all-false) to reproduce the old `?.` optional-chaining undefined-is-falsy behavior.
  const testCaseFlags = useMemo(
    () =>
      getDerivedPermissionFlags(
        testCasePermission ?? DEFAULT_ENTITY_PERMISSION
      ),
    [testCasePermission]
  );

  const emptyStateAction: EmptyPlaceholderAction | undefined = useMemo(() => {
    let action: EmptyPlaceholderAction | undefined;
    if (createActions?.canCreateTestCase && createActions?.onAddTestCase) {
      action = {
        key: 'new-test-case',
        label: t('label.new-entity', { entity: t('label.test-case') }),
        color: 'primary',
        iconLeading: Plus,
        onPress: createActions.onAddTestCase,
      };
    }

    return action;
  }, [createActions?.canCreateTestCase, createActions?.onAddTestCase, t]);

  const { displayedEmptyStateAction, enableBulkActions, hasListActiveFilters } =
    getTestCaseListDisplayState({
      canCreate: Boolean(testSuitePermission?.Create),
      emptyStateAction,
      hasActiveFilters,
      searchValue,
      showDeleted,
    });

  if (!testCaseFlags.hasViewAccess) {
    return (
      <div className="tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface">
        <PermissionPlaceholder
          data-testid="permission-error-placeholder"
          permissionValue={t('label.view-entity', {
            entity: t('label.test-case'),
          })}
        />
      </div>
    );
  }

  return (
    <Box direction="col" gap={6}>
      <FilterBar
        advancedMenu={filterMenu}
        filters={filters}
        hasActiveFilters={hasActiveFilters}
        selectedFilter={selectedFilter}
        onClearAll={clearAll}
        onToggleFilter={handleMenuClick}
      />
      <DqSummaryPanel
        isLoading={isTestCaseSummaryLoading}
        testSummary={testCaseSummary}
      />
      <Box
        className="tw:overflow-hidden tw:rounded-xl tw:bg-surface tw:outline-1 tw:outline-secondary"
        direction="col">
        <Box className="tw:p-4">
          <TestCaseListTableHeader
            extraDropdownContent={extraDropdownContent}
            searchValue={searchValue}
            showDeleted={showDeleted}
            onSearch={(value) => handleSearchParam('searchValue', value)}
            onShowDeletedChange={handleShowDeletedChange}
          />
        </Box>
        <DataQualityTab
          removeTableBorder
          afterDeleteAction={handleAfterDeleteAction}
          breadcrumbData={[
            {
              name: t('label.data-quality'),
              url: observabilityRouterClassBase.getDataQualityPagePath(
                DataQualityPageTabs.TEST_CASES
              ),
            },
          ]}
          deletionMode={TEST_CASE_DELETION_MODE.SOFT}
          emptyStateAction={displayedEmptyStateAction}
          enableBulkActions={enableBulkActions}
          entityPermissions={entityPermissions}
          fetchTestCases={sortTestCase}
          hasActiveFilters={hasListActiveFilters}
          isLoading={isLoading}
          pagingData={pagingData}
          showPagination={showPagination}
          testCases={testCase}
          onTestCaseResultUpdate={handleStatusSubmit}
          onTestUpdate={handleTestCaseUpdate}
        />
      </Box>
    </Box>
  );
};

export default TestCases;
