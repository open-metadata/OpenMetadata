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
import { isEmpty } from 'lodash';
import { useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { WILD_CARD_CHAR } from '../../../constants/char.constants';
import { PAGE_SIZE_LARGE } from '../../../constants/constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { SORT_ORDER } from '../../../enums/common.enum';
import { TabSpecificField } from '../../../enums/entity.enum';
import { Operation } from '../../../generated/entity/policies/policy';
import { TestCase } from '../../../generated/tests/testCase';
import { usePaging } from '../../../hooks/paging/usePaging';
import DataQualityClassBase from '../../../pages/DataQuality/DataQualityClassBase';
import { DataQualityPageTabs } from '../../../pages/DataQuality/DataQualityPage.interface';
import { useDataQualityProvider } from '../../../pages/DataQuality/DataQualityProvider';
import { getListTestCaseBySearch } from '../../../rest/testAPI';
import { getTestCaseFiltersValue } from '../../../utils/DataQuality/DataQualityPureUtils';
import { checkPermission } from '../../../utils/PermissionsUtils';
import {
  convertTestCasesToCSV,
  getTestCaseManageMenuItems,
} from '../../../utils/TestCaseUtils';
import { useEntityExportModalProvider } from '../../Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import { useTestCaseActions } from './useTestCaseActions';
import { useTestCaseFilterOptions } from './useTestCaseFilterOptions';
import { useTestCaseFilters } from './useTestCaseFilters';
import { useTestCaseList } from './useTestCaseList';

/**
 * Back-compat aliases for existing importers. The descriptor the hook emits is
 * the generic, filter-agnostic {@link FilterDescriptor}; these names are kept so
 * Test-Cases callers keep compiling.
 */
export type {
  FilterDescriptor as TestCaseFilterDescriptor,
  FilterOptionData as TestCaseFilterOptionData,
  FilterValue as TestCaseFilterValue,
} from './FilterChip.interface';

const EXPORT_SORT_FIELD = 'fullyQualifiedName.keyword';
// Export pages can shift while records are updated. A stable sort plus a few
// bounded reconciliation passes avoids silently dropping moving rows.
const MAX_EXPORT_PASSES = 3;

export const useTestCaseListPage = () => {
  const { tab = DataQualityClassBase.getDefaultActiveTab() } = useParams<{
    tab: DataQualityPageTabs;
  }>();
  const navigate = useNavigate();
  const { permissions } = usePermissionProvider();
  const { isTestCaseSummaryLoading, testCaseSummary } =
    useDataQualityProvider();
  const { testCase: testCasePermission, testSuite: testSuitePermission } =
    permissions;
  const { showModal } = useEntityExportModalProvider();

  const paging = usePaging();

  const {
    getInitialOptions,
    isOptionsLoading,
    asyncOptionsByKey,
    onSearchByKey,
    tableOptions,
    tagOptions,
    tierOptions,
    serviceOptions,
    dataProductOptions,
    debounceFetchTableData,
    debounceFetchTagOptions,
    debounceFetchServiceOptions,
    debounceFetchDataProductOptions,
  } = useTestCaseFilterOptions();

  const {
    params,
    searchValue,
    selectedFilter,
    setSelectedFilter,
    form,
    handleMenuClick,
    handleSearchParam,
    handleFilterChange,
    filterMenu,
    filters,
    hasActiveFilters,
    clearAll,
  } = useTestCaseFilters({
    getInitialOptions,
    isOptionsLoading,
    asyncOptionsByKey,
    onSearchByKey,
  });

  const {
    testCase,
    setTestCase,
    isLoading,
    fetchTestCases,
    sortTestCase,
    pagingData,
    showPagination,
  } = useTestCaseList({
    params,
    selectedFilter,
    setSelectedFilter,
    searchValue,
    form,
    getInitialOptions,
    tab,
    testCasePermission,
    currentPage: paging.currentPage,
    pageSize: paging.pageSize,
    paging: paging.paging,
    handlePageChange: paging.handlePageChange,
    handlePageSizeChange: paging.handlePageSizeChange,
    handlePagingChange: paging.handlePagingChange,
    showPagination: paging.showPagination,
  });

  const { handleTestCaseUpdate, handleStatusSubmit } = useTestCaseActions({
    setTestCase,
  });

  const exportFilteredTestCases = useCallback(async () => {
    const updatedParams = getTestCaseFiltersValue(params, selectedFilter);
    const exportParams = {
      ...updatedParams,
      testCaseStatus: isEmpty(params.testCaseStatus)
        ? undefined
        : params.testCaseStatus,
      includeAllTests: true,
      fields: [TabSpecificField.TEST_DEFINITION, TabSpecificField.TESTSUITE],
      q: searchValue ? `*${searchValue}*` : undefined,
      sortField: EXPORT_SORT_FIELD,
      sortType: SORT_ORDER.ASC,
    };
    let pass = 0;
    let reconciledTestCases: TestCase[] = [];

    do {
      // Each pass intentionally starts fresh so rows deleted or edited out of
      // the active filters are not retained from an earlier pass.
      const testCasesById = new Map<string, TestCase>();
      let offset = 0;
      let total = 0;
      let previousReportedTotal: number | undefined;
      let reportedTotalChanged = false;

      do {
        const response = await getListTestCaseBySearch({
          ...exportParams,
          limit: PAGE_SIZE_LARGE,
          offset,
        });
        response.data.forEach((testCase) =>
          testCasesById.set(testCase.id, testCase)
        );
        if (response.paging.total !== undefined) {
          if (
            previousReportedTotal !== undefined &&
            previousReportedTotal !== response.paging.total
          ) {
            reportedTotalChanged = true;
          }
          previousReportedTotal = response.paging.total;
        }
        total = response.paging.total ?? testCasesById.size;
        offset += response.data.length;

        // The reported total can lag behind concurrent deletes. Stop on an
        // empty page instead of repeatedly requesting the stale range.
        if (response.data.length === 0) {
          break;
        }
      } while (offset < total);

      reconciledTestCases = [...testCasesById.values()];
      pass += 1;

      // A changing total means the result set moved while paging. Only accept
      // a later pass that observes a stable total from start to finish.
      if (!reportedTotalChanged && testCasesById.size >= total) {
        break;
      }
    } while (pass < MAX_EXPORT_PASSES);

    return convertTestCasesToCSV(reconciledTestCases);
  }, [params, searchValue, selectedFilter]);

  // Keep the server-side export for unfiltered lists; only materialize rows in
  // the browser when the current search/filter state must be preserved.
  const filteredExportAction =
    hasActiveFilters || searchValue ? exportFilteredTestCases : undefined;

  const extraDropdownContent = useMemo(
    () =>
      getTestCaseManageMenuItems(
        WILD_CARD_CHAR,
        {
          ViewAll:
            checkPermission(
              Operation.ViewAll,
              ResourceEntity.TEST_CASE,
              permissions
            ) ?? false,
          EditAll:
            checkPermission(
              Operation.EditAll,
              ResourceEntity.TEST_CASE,
              permissions
            ) ?? false,
        },
        false,
        navigate,
        showModal,
        undefined,
        filteredExportAction
      ),
    [permissions, navigate, showModal, filteredExportAction]
  );

  return {
    // permissions + summary
    testCasePermission,
    testSuitePermission,
    testCaseSummary,
    isTestCaseSummaryLoading,
    // filter bar (OSS antd form + AI descriptors)
    form,
    params,
    searchValue,
    selectedFilter,
    handleMenuClick,
    handleSearchParam,
    handleFilterChange,
    filterMenu,
    filters,
    hasActiveFilters,
    clearAll,
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
    // table + paging
    testCase,
    isLoading,
    pagingData,
    showPagination,
    fetchTestCases,
    sortTestCase,
    handleTestCaseUpdate,
    handleStatusSubmit,
    extraDropdownContent,
  };
};
