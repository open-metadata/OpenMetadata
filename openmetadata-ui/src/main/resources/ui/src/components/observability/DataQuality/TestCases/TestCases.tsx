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
import { Plus } from '@untitledui/icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { DataQualityPageTabs } from '../../../../pages/DataQuality/DataQualityPage.interface';
import { useDataQualityProvider } from '../../../../pages/DataQuality/DataQualityProvider';
import observabilityRouterClassBase from '../../../../utils/ObservabilityRouterClassBase';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import DataQualityTab from '../../../Database/Profiler/DataQualityTab/DataQualityTab';
import TestCaseListTableHeader from '../../../DataQuality/TestCases/TestCaseListTableHeader.component';
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
    isLoading,
    pagingData,
    showPagination,
    fetchTestCases,
    sortTestCase,
    handleTestCaseUpdate,
    handleStatusSubmit,
    extraDropdownContent,
  } = useTestCaseListPage();

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
        className="tw:overflow-hidden tw:rounded-xl tw:bg-primary tw:outline-1 tw:outline-secondary"
        direction="col">
        <Box className="tw:p-4">
          <TestCaseListTableHeader
            extraDropdownContent={extraDropdownContent}
            searchValue={searchValue}
            onSearch={(value) => handleSearchParam('searchValue', value)}
          />
        </Box>
        <DataQualityTab
          removeTableBorder
          afterDeleteAction={fetchTestCases}
          breadcrumbData={[
            {
              name: t('label.data-quality'),
              url: observabilityRouterClassBase.getDataQualityPagePath(
                DataQualityPageTabs.TEST_CASES
              ),
            },
          ]}
          editVariant="modal"
          emptyStateAction={emptyStateAction}
          enableBulkActions={Boolean(testSuitePermission?.Create)}
          fetchTestCases={sortTestCase}
          hasActiveFilters={hasActiveFilters}
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
