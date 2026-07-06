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
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { WILD_CARD_CHAR } from '../../../constants/char.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../generated/entity/policies/policy';
import { usePaging } from '../../../hooks/paging/usePaging';
import DataQualityClassBase from '../../../pages/DataQuality/DataQualityClassBase';
import { DataQualityPageTabs } from '../../../pages/DataQuality/DataQualityPage.interface';
import { useDataQualityProvider } from '../../../pages/DataQuality/DataQualityProvider';
import { checkPermission } from '../../../utils/PermissionsUtils';
import { getTestCaseManageMenuItems } from '../../../utils/TestCaseUtils';
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
        showModal
      ),
    [permissions, navigate, showModal]
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
