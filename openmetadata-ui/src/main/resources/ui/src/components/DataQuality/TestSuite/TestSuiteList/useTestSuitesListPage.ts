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
import { useParams } from 'react-router-dom';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { usePaging } from '../../../../hooks/paging/usePaging';
import {
  DataQualityPageTabs,
  DataQualitySubTabs,
} from '../../../../pages/DataQuality/DataQualityPage.interface';
import { useDataQualityProvider } from '../../../../pages/DataQuality/DataQualityProvider';
import { useTestSuiteFilters } from './useTestSuiteFilters';
import { useTestSuitesData } from './useTestSuitesData';
import { useTestSuiteSortedTable } from './useTestSuiteSortedTable';

/**
 * Shared headless logic for the Test Suites tab: URL-driven filters
 * (owner/search/sub-tab), paging, sorting, the suites fetch and permission/
 * summary state. Both the OSS renderer and the AI-mode renderer consume this so
 * data fetching lives in one place and only the chrome (filter bar, sub-tab
 * toggle, search) differs per mode.
 */
export const useTestSuitesListPage = () => {
  const {
    tab = DataQualityPageTabs.TEST_CASES,
    subTab = DataQualitySubTabs.TABLE_SUITES,
  } = useParams<{
    tab?: DataQualityPageTabs;
    subTab?: DataQualitySubTabs;
  }>();
  const { isTestCaseSummaryLoading, testCaseSummary } =
    useDataQualityProvider();
  const { permissions } = usePermissionProvider();
  const { testSuite: testSuitePermission } = permissions;

  const paging = usePaging();

  const {
    params,
    searchValue,
    owner,
    selectedOwner,
    ownerFilterValue,
    handleSearchParam,
    handleOwnerSelect,
    handleSubTabChange,
  } = useTestSuiteFilters({ tab });

  const {
    testSuites,
    isLoading,
    handleTestSuitesPageChange,
    handlePageSizeChange,
  } = useTestSuitesData({
    searchValue,
    owner,
    ownerFilterValue,
    subTab,
    testSuitePermission,
    currentPage: paging.currentPage,
    pageSize: paging.pageSize,
    handlePageChange: paging.handlePageChange,
    handlePageSizeChange: paging.handlePageSizeChange,
    handlePagingChange: paging.handlePagingChange,
  });

  const { sortDescriptor, setSortDescriptor, columnList, sortedData } =
    useTestSuiteSortedTable({ testSuites });

  return {
    // tab + URL-driven filters
    tab,
    subTab,
    params,
    searchValue,
    selectedOwner,
    ownerFilterValue,
    // permissions
    testSuitePermission,
    // data table + sorting
    testSuites,
    sortedData,
    isLoading,
    columnList,
    sortDescriptor,
    setSortDescriptor,
    // paging
    currentPage: paging.currentPage,
    pageSize: paging.pageSize,
    paging: paging.paging,
    showPagination: paging.showPagination,
    handlePageSizeChange,
    handleTestSuitesPageChange,
    // filter handlers
    handleSearchParam,
    handleOwnerSelect,
    handleSubTabChange,
    // dq summary passthrough
    isTestCaseSummaryLoading,
    testCaseSummary,
  };
};
