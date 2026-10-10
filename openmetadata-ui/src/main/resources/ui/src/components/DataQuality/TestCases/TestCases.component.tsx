/*
 *  Copyright 2023 Collate.
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
  Dropdown,
  EmptyPlaceholderAction,
  Grid,
} from '@openmetadata/ui-core-components';
import { ChevronRight, Plus } from '@openmetadata/ui-core-components/icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TEST_CASE_DELETION_MODE } from '../../../constants/DataQuality.constants';
import { TEST_CASE_FILTERS } from '../../../constants/profiler.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { DataQualityPageTabs } from '../../../pages/DataQuality/DataQualityPage.interface';
import { useDataQualityProvider } from '../../../pages/DataQuality/DataQualityProvider';
import { getLayoutGutter } from '../../../utils/common/layout.utils';
import observabilityRouterClassBase from '../../../utils/ObservabilityRouterClassBase';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import DataQualityTab from '../../Database/Profiler/DataQualityTab/DataQualityTab';
import PieChartSummaryPanel from '../SummaryPannel/PieChartSummaryPanel.component';
import { ClassicTestCaseFilter } from './ClassicTestCaseFilter';
import TestCaseListTableHeader from './TestCaseListTableHeader.component';
import { getTestCaseListDisplayState } from './TestCases.utils';
import { useTestCaseListPage } from './useTestCaseListPage';

export const TestCases = () => {
  const { t } = useTranslation();
  const { createActions } = useDataQualityProvider();
  const {
    testCasePermission,
    testSuitePermission,
    testCaseSummary,
    isTestCaseSummaryLoading,
    searchValue,
    selectedFilter,
    hasActiveFilters,
    handleMenuClick,
    handleSearchParam,
    filterMenu,
    filters,
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
  // runs through getDerivedPermissionFlags exactly like an entity-level fetch (Task 8 Batch 3
  // DatabaseSchemaTable.tsx precedent). Falls back to DEFAULT_ENTITY_PERMISSION (all-false) to
  // reproduce the old `?.` optional-chaining undefined-is-falsy behavior.
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

  const filterLayout = [
    {
      key: TEST_CASE_FILTERS.table,
      width: 'tw:w-80',
      testId: 'table-select-filter',
    },
    {
      key: TEST_CASE_FILTERS.platform,
      width: 'tw:min-w-20',
      testId: 'platform-select-filter',
    },
    {
      key: TEST_CASE_FILTERS.type,
      width: 'tw:w-40',
      testId: 'test-case-type-select-filter',
    },
    {
      key: TEST_CASE_FILTERS.status,
      width: 'tw:w-64',
      testId: 'status-select-filter',
    },
    { key: TEST_CASE_FILTERS.lastRun, testId: 'last-run-filter' },
    {
      key: TEST_CASE_FILTERS.tags,
      width: 'tw:w-80',
      testId: 'tags-select-filter',
    },
    {
      key: TEST_CASE_FILTERS.tier,
      width: 'tw:w-40',
      testId: 'tier-select-filter',
    },
    {
      key: TEST_CASE_FILTERS.service,
      width: 'tw:w-80',
      testId: 'service-select-filter',
    },
    {
      key: TEST_CASE_FILTERS.dimension,
      width: 'tw:w-80',
      testId: 'dimension-select-filter',
    },
    {
      key: TEST_CASE_FILTERS.dataProduct,
      width: 'tw:w-80',
      testId: 'data-product-select-filter',
    },
  ];

  if (!testCaseFlags.hasViewAccess) {
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
    <Grid
      className="layout-row layout-grid"
      data-testid="test-case-container"
      style={{ ...getLayoutGutter(16, 16) }}>
      <Grid.Item className="layout-column" span={24}>
        <Box
          inline
          align="center"
          className="layout-space layout-space-horizontal w-full"
          gap={4}
          itemClassName="layout-space-item"
          wrap="wrap">
          <Dropdown.Root>
            <Button
              className="tw:text-brand-secondary tw:after:outline-brand"
              color="secondary"
              data-testid="advanced-filter"
              iconTrailing={<ChevronRight size={14} />}
              size="sm">
              {t('label.advanced')}
            </Button>
            <Dropdown.Popover className="tw:w-auto" placement="bottom start">
              <Dropdown.Menu
                aria-label={t('label.advanced')}
                selectedKeys={selectedFilter}
                selectionMode="multiple"
                onAction={(key) => handleMenuClick({ key: String(key) })}>
                {filterMenu.map((item) => (
                  <Dropdown.Item
                    shouldCloseOnSelect
                    data-testid={`advanced-filter-option-${item.key}`}
                    id={item.key}
                    key={item.key}
                    label={item.label}
                  />
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.Root>

          {filterLayout.map(({ key, width, testId }) => {
            const filter = filters.find((item) => item.key === key);

            return filter ? (
              <ClassicTestCaseFilter
                className={width}
                filter={filter}
                key={key}
                testId={testId}
              />
            ) : null;
          })}
        </Box>
      </Grid.Item>
      <Grid.Item className="layout-column" span={24}>
        <PieChartSummaryPanel
          isLoading={isTestCaseSummaryLoading}
          testSummary={testCaseSummary}
        />
      </Grid.Item>
      <Grid.Item className="layout-column" span={24}>
        <DataQualityTab
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
          tableHeader={
            <TestCaseListTableHeader
              extraDropdownContent={extraDropdownContent}
              searchValue={searchValue}
              showDeleted={showDeleted}
              onSearch={(value) => handleSearchParam('searchValue', value)}
              onShowDeletedChange={handleShowDeletedChange}
            />
          }
          testCases={testCase}
          onTestCaseResultUpdate={handleStatusSubmit}
          onTestUpdate={handleTestCaseUpdate}
        />
      </Grid.Item>
    </Grid>
  );
};
