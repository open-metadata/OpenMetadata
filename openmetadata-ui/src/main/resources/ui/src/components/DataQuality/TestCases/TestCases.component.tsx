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
import { RightOutlined } from '@ant-design/icons';
import {
  EmptyPlaceholderAction,
  MultiSelect,
  SelectItemType,
} from '@openmetadata/ui-core-components';
import { Plus } from '@untitledui/icons';
import { Button, Col, Dropdown, Form, Row, Select, Space } from 'antd';
import { useCallback, useEffect, useMemo } from 'react';
import type { Key } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { useListData } from 'react-stately';
import {
  TEST_CASE_DIMENSIONS_OPTION,
  TEST_CASE_FILTERS,
  TEST_CASE_PLATFORM_OPTION,
  TEST_CASE_STATUS_OPTION,
  TEST_CASE_TYPE_OPTION,
} from '../../../constants/profiler.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { TestCaseStatus } from '../../../generated/tests/testCase';
import { DataQualityPageTabs } from '../../../pages/DataQuality/DataQualityPage.interface';
import { useDataQualityProvider } from '../../../pages/DataQuality/DataQualityProvider';
import { getPopupContainer } from '../../../utils/formPureUtils';
import observabilityRouterClassBase from '../../../utils/ObservabilityRouterClassBase';
import DatePickerMenu from '../../common/DatePickerMenu/DatePickerMenu.component';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import DataQualityTab from '../../Database/Profiler/DataQualityTab/DataQualityTab';
import { TestCaseSearchParams } from '../DataQuality.interface';
import PieChartSummaryPanel from '../SummaryPannel/PieChartSummaryPanel.component';
import TestCaseListTableHeader from './TestCaseListTableHeader.component';
import { useTestCaseListPage } from './useTestCaseListPage';

const TEST_CASE_STATUS_ITEMS: SelectItemType[] = Object.values(
  TestCaseStatus
).map((status) => ({
  id: status,
  label:
    TEST_CASE_STATUS_OPTION.find((option) => option.value === status)?.label ??
    status,
}));

// MultiSelect owns mutable ListData, while chart navigation and browser history
// can change the URL independently, so keep its model aligned with URL state.
const useSyncedListData = (selectedStatuses: TestCaseStatus[]) => {
  const selectedItems = useListData<SelectItemType>({ initialItems: [] });
  const selectedStatusKey = selectedStatuses.join(',');

  useEffect(() => {
    const selectedStatusSet = new Set<string>(selectedStatuses);
    selectedItems.items.forEach(({ id }) => {
      if (!selectedStatusSet.has(String(id))) {
        selectedItems.remove(id);
      }
    });

    const renderedStatusSet = new Set(selectedItems.items.map(({ id }) => id));
    selectedStatuses.forEach((status) => {
      if (!renderedStatusSet.has(status)) {
        const item = TEST_CASE_STATUS_ITEMS.find(({ id }) => id === status);
        if (item) {
          selectedItems.append(item);
        }
      }
    });
    // useListData returns a new facade on every render. URL status changes are
    // the only reason to reconcile it with external state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatusKey]);

  return selectedItems;
};

export const TestCases = () => {
  const { t } = useTranslation();
  const { createActions } = useDataQualityProvider();
  const {
    testCasePermission,
    testSuitePermission,
    testCaseSummary,
    isTestCaseSummaryLoading,
    form,
    params,
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
    debounceFetchTableData,
    debounceFetchTagOptions,
    debounceFetchServiceOptions,
    debounceFetchDataProductOptions,
    testCase,
    isLoading,
    pagingData,
    showPagination,
    fetchTestCases,
    sortTestCase,
    handleTestCaseUpdate,
    handleStatusSubmit,
    extraDropdownContent,
  } = useTestCaseListPage();

  const selectedStatuses = useMemo(() => {
    const status = params.testCaseStatus;

    if (!status) {
      return [];
    }

    return Array.isArray(status) ? status : [status];
  }, [params.testCaseStatus]);
  const selectedStatusItems = useSyncedListData(selectedStatuses);

  const handleStatusInserted = useCallback(
    (key: Key) => {
      const status = Object.values(TestCaseStatus).find(
        (value) => value === String(key)
      );
      if (status && !selectedStatuses.includes(status)) {
        handleSearchParam('testCaseStatus', [...selectedStatuses, status]);
      }
    },
    [handleSearchParam, selectedStatuses]
  );

  const handleStatusCleared = useCallback(
    (key: Key) => {
      const updatedStatuses = selectedStatuses.filter(
        (status) => status !== String(key)
      );
      handleSearchParam(
        'testCaseStatus',
        updatedStatuses.length ? updatedStatuses : undefined
      );
    },
    [handleSearchParam, selectedStatuses]
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

  if (!testCasePermission?.ViewAll && !testCasePermission?.ViewBasic) {
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
    <Row data-testid="test-case-container" gutter={[16, 16]}>
      <Col span={24}>
        <Form<TestCaseSearchParams>
          className="new-form-style"
          form={form}
          layout="horizontal"
          onValuesChange={handleFilterChange}>
          <Space wrap align="center" className="w-full" size={16}>
            <Form.Item noStyle name="selectedFilters">
              <Dropdown
                menu={{
                  items: filterMenu,
                  selectedKeys: selectedFilter,
                  onClick: handleMenuClick,
                }}
                trigger={['click']}>
                <Button
                  ghost
                  className="expand-btn"
                  data-testid="advanced-filter"
                  type="primary">
                  {t('label.advanced')}
                  <RightOutlined />
                </Button>
              </Dropdown>
            </Form.Item>
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
              <div className="tw:w-64">
                <MultiSelect
                  data-testid="status-select-filter"
                  items={TEST_CASE_STATUS_ITEMS}
                  label={t('label.status')}
                  placeholder={t('label.status')}
                  selectedItems={selectedStatusItems}
                  onItemCleared={handleStatusCleared}
                  onItemInserted={handleStatusInserted}>
                  {(item) => (
                    <MultiSelect.Item
                      id={item.id}
                      key={item.id}
                      label={item.label}
                    />
                  )}
                </MultiSelect>
              </div>
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
              <Form.Item
                className="m-0 w-40"
                label={t('label.tier')}
                name="tier">
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
                  options={TEST_CASE_DIMENSIONS_OPTION}
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
          </Space>
        </Form>
      </Col>
      <Col span={24}>
        <PieChartSummaryPanel
          isLoading={isTestCaseSummaryLoading}
          testSummary={testCaseSummary}
        />
      </Col>
      <Col span={24}>
        <DataQualityTab
          afterDeleteAction={fetchTestCases}
          breadcrumbData={[
            {
              name: t('label.data-quality'),
              url: observabilityRouterClassBase.getDataQualityPagePath(
                DataQualityPageTabs.TEST_CASES
              ),
            },
          ]}
          emptyStateAction={emptyStateAction}
          enableBulkActions={Boolean(testSuitePermission?.Create)}
          fetchTestCases={sortTestCase}
          hasActiveFilters={Boolean(searchValue) || hasActiveFilters}
          isLoading={isLoading}
          pagingData={pagingData}
          showPagination={showPagination}
          tableHeader={
            <TestCaseListTableHeader
              extraDropdownContent={extraDropdownContent}
              searchValue={searchValue}
              onSearch={(value) => handleSearchParam('searchValue', value)}
            />
          }
          testCases={testCase}
          onTestCaseResultUpdate={handleStatusSubmit}
          onTestUpdate={handleTestCaseUpdate}
        />
      </Col>
    </Row>
  );
};
