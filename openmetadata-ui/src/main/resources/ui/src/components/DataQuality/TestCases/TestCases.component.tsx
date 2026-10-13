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
import { Form, Select } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TEST_CASE_DELETION_MODE } from '../../../constants/DataQuality.constants';
import {
  TEST_CASE_FILTERS,
  TEST_CASE_PLATFORM_OPTION,
  TEST_CASE_STATUS_FILTER_OPTIONS,
  TEST_CASE_TYPE_OPTION,
} from '../../../constants/profiler.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { DataQualityPageTabs } from '../../../pages/DataQuality/DataQualityPage.interface';
import { useDataQualityProvider } from '../../../pages/DataQuality/DataQualityProvider';
import { getLayoutGutter } from '../../../utils/common/layout.utils';
import { getPopupContainer } from '../../../utils/formPureUtils';
import observabilityRouterClassBase from '../../../utils/ObservabilityRouterClassBase';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import DatePickerMenu from '../../common/DatePickerMenu/DatePickerMenu.component';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import DataQualityTab from '../../Database/Profiler/DataQualityTab/DataQualityTab';
import { TestCaseSearchParams } from '../DataQuality.interface';
import PieChartSummaryPanel from '../SummaryPannel/PieChartSummaryPanel.component';
import TestCaseListTableHeader from './TestCaseListTableHeader.component';
import { getTestCaseListDisplayState } from './TestCases.utils';
import { useTestCaseListPage } from './useTestCaseListPage';

export const TestCases = () => {
  const { t } = useTranslation();
  const { createActions } = useDataQualityProvider();
  const [form] = Form.useForm();
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
    handleFilterChange,
    filterMenu,
    isOptionsLoading,
    tableOptions,
    tagOptions,
    tierOptions,
    serviceOptions,
    dataProductOptions,
    dimensionOptions,
    debounceFetchTableData,
    debounceFetchTagOptions,
    debounceFetchServiceOptions,
    debounceFetchDataProductOptions,
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
  } = useTestCaseListPage({ form });

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

  const renderPrimaryFilters = () => (
    <>
      {selectedFilter.includes(TEST_CASE_FILTERS.table) && (
        <Form.Item
          className="m-0 w-80"
          label={t('label.table')}
          name="tableFqn">
          <Select
            allowClear
            showSearch
            data-testid="table-select-filter"
            getPopupContainer={getPopupContainer}
            loading={isOptionsLoading}
            options={tableOptions}
            placeholder={t('label.table')}
            onSearch={debounceFetchTableData}
          />
        </Form.Item>
      )}
      {selectedFilter.includes(TEST_CASE_FILTERS.platform) && (
        <Form.Item
          className="m-0 w-min-20"
          label={t('label.platform')}
          name="testPlatforms">
          <Select
            allowClear
            data-testid="platform-select-filter"
            getPopupContainer={getPopupContainer}
            mode="multiple"
            options={TEST_CASE_PLATFORM_OPTION}
            placeholder={t('label.platform')}
          />
        </Form.Item>
      )}
      {selectedFilter.includes(TEST_CASE_FILTERS.type) && (
        <Form.Item
          className="m-0 w-40"
          label={t('label.type')}
          name="testCaseType">
          <Select
            allowClear
            data-testid="test-case-type-select-filter"
            getPopupContainer={getPopupContainer}
            options={TEST_CASE_TYPE_OPTION}
            placeholder={t('label.type')}
          />
        </Form.Item>
      )}
      {selectedFilter.includes(TEST_CASE_FILTERS.status) && (
        <Form.Item
          className="m-0 w-64"
          label={t('label.status')}
          name="testCaseStatus">
          <Select
            allowClear
            data-testid="status-select-filter"
            getPopupContainer={getPopupContainer}
            mode="multiple"
            options={TEST_CASE_STATUS_FILTER_OPTIONS}
            placeholder={t('label.status')}
          />
        </Form.Item>
      )}
      {selectedFilter.includes(TEST_CASE_FILTERS.lastRun) && (
        <Form.Item
          className="m-0"
          label={t('label.last-run')}
          name="lastRunRange"
          trigger="handleDateRangeChange"
          valuePropName="defaultDateRange">
          <DatePickerMenu showSelectedCustomRange size="small" />
        </Form.Item>
      )}
    </>
  );

  const renderSecondaryFilters = () => (
    <>
      {selectedFilter.includes(TEST_CASE_FILTERS.tags) && (
        <Form.Item
          className="m-0 w-80"
          label={t('label.tag-plural')}
          name="tags">
          <Select
            allowClear
            showSearch
            data-testid="tags-select-filter"
            getPopupContainer={getPopupContainer}
            loading={isOptionsLoading}
            mode="multiple"
            options={tagOptions}
            placeholder={t('label.tag-plural')}
            onSearch={debounceFetchTagOptions}
          />
        </Form.Item>
      )}
      {selectedFilter.includes(TEST_CASE_FILTERS.tier) && (
        <Form.Item className="m-0 w-40" label={t('label.tier')} name="tier">
          <Select
            allowClear
            showSearch
            data-testid="tier-select-filter"
            getPopupContainer={getPopupContainer}
            options={tierOptions}
            placeholder={t('label.tier')}
          />
        </Form.Item>
      )}
      {selectedFilter.includes(TEST_CASE_FILTERS.service) && (
        <Form.Item
          className="m-0 w-80"
          label={t('label.service')}
          name="serviceName">
          <Select
            allowClear
            showSearch
            data-testid="service-select-filter"
            getPopupContainer={getPopupContainer}
            loading={isOptionsLoading}
            options={serviceOptions}
            placeholder={t('label.service')}
            onSearch={debounceFetchServiceOptions}
          />
        </Form.Item>
      )}
      {selectedFilter.includes(TEST_CASE_FILTERS.dimension) && (
        <Form.Item
          className="m-0 w-80"
          label={t('label.dimension')}
          name="dataQualityDimension">
          <Select
            allowClear
            showSearch
            data-testid="dimension-select-filter"
            getPopupContainer={getPopupContainer}
            loading={isOptionsLoading}
            options={dimensionOptions}
            placeholder={t('label.dimension')}
          />
        </Form.Item>
      )}
      {selectedFilter.includes(TEST_CASE_FILTERS.dataProduct) && (
        <Form.Item
          className="m-0 w-80"
          label={t('label.data-product-plural')}
          name="dataProductFqn">
          <Select
            allowClear
            showSearch
            data-testid="data-product-select-filter"
            getPopupContainer={getPopupContainer}
            loading={isOptionsLoading}
            options={dataProductOptions}
            placeholder={t('label.data-product-plural')}
            onSearch={debounceFetchDataProductOptions}
          />
        </Form.Item>
      )}
    </>
  );

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
        <Form<TestCaseSearchParams>
          className="new-form-style"
          form={form}
          layout="horizontal"
          onValuesChange={handleFilterChange}>
          <Box
            inline
            align="center"
            className="layout-space layout-space-horizontal w-full"
            gap={4}
            itemClassName="layout-space-item"
            wrap="wrap">
            <Form.Item noStyle name="selectedFilters">
              <Dropdown.Root>
                <Button
                  className="tw:text-brand-secondary tw:after:outline-brand"
                  color="secondary"
                  data-testid="advanced-filter"
                  iconTrailing={<ChevronRight size={14} />}
                  size="sm">
                  {t('label.advanced')}
                </Button>
                <Dropdown.Popover
                  className="tw:w-auto"
                  placement="bottom start">
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
            </Form.Item>
            {renderPrimaryFilters()}
            {renderSecondaryFilters()}
          </Box>
        </Form>
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
