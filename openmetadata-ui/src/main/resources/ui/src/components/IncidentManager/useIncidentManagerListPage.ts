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
import { isString, isUndefined, omit, parseInt } from 'lodash';
import QueryString from 'qs';
import { useMemo } from 'react';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { Table } from '../../generated/entity/data/table';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import { TestCaseIncidentStatusParams } from '../../rest/incidentManagerAPI';
import { useIncidentActions } from './useIncidentActions';
import { useIncidentFilterOptions } from './useIncidentFilterOptions';
import { useIncidentFilters } from './useIncidentFilters';
import { useIncidentList } from './useIncidentList';
import { useIncidentRowPermissions } from './useIncidentRowPermissions';

export interface UseIncidentManagerListPageProps {
  isIncidentPage?: boolean;
  tableDetails?: Table;
}

export const useIncidentManagerListPage = ({
  isIncidentPage = true,
  tableDetails,
}: UseIncidentManagerListPageProps) => {
  const location = useCustomLocation();
  const allParams = useMemo(() => {
    const param = location.search;
    const searchData = QueryString.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return isUndefined(searchData) ? {} : searchData;
  }, [location.search]);

  const filters = useMemo(() => {
    const urlParams = omit(allParams, ['key', 'title']);

    const params: TestCaseIncidentStatusParams = {
      ...urlParams,
    };

    // Only use date params if they exist in the URL
    if (urlParams.startTs || urlParams.endTs) {
      if (urlParams.startTs && isString(urlParams.startTs)) {
        params.startTs = parseInt(urlParams.startTs, 10);
      }
      if (urlParams.endTs && isString(urlParams.endTs)) {
        params.endTs = parseInt(urlParams.endTs, 10);
      }
    }

    return params;
  }, [allParams]);

  const { getEntityPermissionByFqn, permissions } = usePermissionProvider();
  const { testCase: commonTestCasePermission } = permissions;

  const {
    setUsers,
    assigneeOptionsWithSelected,
    selectedAssignees,
    fetchUserFilterOptions,
    searchTestCases,
    testCaseFilterOptions,
    isTestCaseOptionsLoading,
    fetchTestCaseFilterOptions,
  } = useIncidentFilterOptions({ filters });

  const { testCaseListData, setTestCaseListData, pagingData, showPagination } =
    useIncidentList({
      filters,
      setUsers,
      commonTestCasePermission,
      tableDetails,
    });

  const { isPermissionLoading, testCasePermissions } =
    useIncidentRowPermissions({
      testCaseListData,
      getEntityPermissionByFqn,
    });

  const {
    dateRangeKey,
    isDateFilterOpen,
    setIsDateFilterOpen,
    dateFilterOptions,
    selectedDateFilterKey,
    selectedDateFilterOption,
    updateFilters,
    handleAssigneeChange,
    handleDateRangeChange,
    handleDateFieldChange,
    handleDateRangeClear,
    filterDescriptors,
    hasActiveFilters,
    clearAllFilters,
  } = useIncidentFilters({
    filters,
    allParams,
    testCaseListData,
    testCaseFilterOptions,
    isTestCaseOptionsLoading,
    fetchTestCaseFilterOptions,
  });

  const { handleSeveritySubmit, handleAssigneeUpdate, handleStatusSubmit } =
    useIncidentActions({ setTestCaseListData });

  return {
    isIncidentPage,
    tableDetails,
    commonTestCasePermission,
    filters,
    dateRangeKey,
    testCaseListData,
    isDateFilterOpen,
    setIsDateFilterOpen,
    assigneeOptionsWithSelected,
    selectedAssignees,
    isPermissionLoading,
    testCasePermissions,
    dateFilterOptions,
    selectedDateFilterKey,
    selectedDateFilterOption,
    showPagination,
    pagingData,
    handleSeveritySubmit,
    handleAssigneeUpdate,
    fetchUserFilterOptions,
    updateFilters,
    handleAssigneeChange,
    handleDateRangeChange,
    handleDateFieldChange,
    handleDateRangeClear,
    handleStatusSubmit,
    searchTestCases,
    filterDescriptors,
    hasActiveFilters,
    clearAllFilters,
  };
};
