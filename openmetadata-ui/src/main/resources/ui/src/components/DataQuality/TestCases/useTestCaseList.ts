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
import { FormInstance } from 'antd';
import { AxiosError } from 'axios';
import { castArray, isEmpty, uniq } from 'lodash';
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { INITIAL_PAGING_VALUE } from '../../../constants/constants';
import { DEFAULT_SORT_ORDER } from '../../../constants/profiler.constant';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { TabSpecificField } from '../../../enums/entity.enum';
import { Operation } from '../../../generated/entity/policies/policy';
import { TestCase } from '../../../generated/tests/testCase';
import { Include } from '../../../generated/type/include';
import { UsePagingInterface } from '../../../hooks/paging/usePaging';
import { DataQualityPageTabs } from '../../../pages/DataQuality/DataQualityPage.interface';
import {
  getListTestCaseBySearch,
  ListTestCaseParamsBySearch,
} from '../../../rest/testAPI';
import { getTestCaseFiltersValue } from '../../../utils/DataQuality/DataQualityPureUtils';
import { getPrioritizedViewPermission } from '../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import { TestCaseSearchParams } from '../DataQuality.interface';

export interface UseTestCaseListProps {
  params: TestCaseSearchParams;
  selectedFilter: string[];
  setSelectedFilter: Dispatch<SetStateAction<string[]>>;
  searchValue: string;
  form: FormInstance;
  getInitialOptions: (key: string, isLengthCheck?: boolean) => void;
  tab: DataQualityPageTabs;
  testCasePermission: OperationPermission;
  currentPage: number;
  pageSize: number;
  paging: UsePagingInterface['paging'];
  handlePageChange: UsePagingInterface['handlePageChange'];
  handlePageSizeChange: UsePagingInterface['handlePageSizeChange'];
  handlePagingChange: UsePagingInterface['handlePagingChange'];
  showPagination: boolean;
}

/**
 * Owns the DATA concern: the test-case rows, their loading flag, the sort
 * options and the fetch pipeline. The driving fetch effect stays co-located
 * with {@link fetchTestCases} and the paging handler so the fetch is issued
 * from a single place (no double-fetch). Filter state, the form and the paging
 * bag are injected.
 */
export const useTestCaseList = ({
  params,
  selectedFilter,
  setSelectedFilter,
  searchValue,
  form,
  getInitialOptions,
  tab,
  testCasePermission,
  currentPage,
  pageSize,
  paging,
  handlePageChange,
  handlePageSizeChange,
  handlePagingChange,
  showPagination,
}: UseTestCaseListProps) => {
  const [testCase, setTestCase] = useState<TestCase[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showDeleted, setShowDeleted] = useState(false);
  const [sortOptions, setSortOptions] =
    useState<ListTestCaseParamsBySearch>(DEFAULT_SORT_ORDER);
  const latestRequestId = useRef(0);

  const fetchTestCases = useCallback(
    async (
      page = INITIAL_PAGING_VALUE,
      activeFilters?: string[],
      apiParams?: ListTestCaseParamsBySearch
    ) => {
      // Visibility, filters, and sorting can overlap requests; only the newest
      // response may update the rows or clear the shared loading state.
      const requestId = ++latestRequestId.current;
      const updatedParams = getTestCaseFiltersValue(
        params,
        activeFilters ?? selectedFilter
      );

      setIsLoading(true);
      try {
        const { data, paging: pagingResponse } = await getListTestCaseBySearch({
          ...updatedParams,
          ...sortOptions,
          testCaseStatus: isEmpty(params?.testCaseStatus)
            ? undefined
            : params?.testCaseStatus,
          limit: pageSize,
          includeAllTests: true,
          fields: [
            TabSpecificField.TEST_CASE_RESULT,
            TabSpecificField.TESTSUITE,
            TabSpecificField.INCIDENT_ID,
            TabSpecificField.INCIDENT_STATUS,
          ],
          q: searchValue || undefined,
          offset: (page - 1) * pageSize,
          include: showDeleted ? Include.Deleted : Include.NonDeleted,
          ...apiParams,
        });
        if (requestId === latestRequestId.current) {
          setTestCase(data);
          handlePagingChange(pagingResponse);
        }
      } catch (error) {
        if (requestId === latestRequestId.current) {
          showErrorToast(error as AxiosError);
        }
      } finally {
        if (requestId === latestRequestId.current) {
          setIsLoading(false);
        }
      }
    },
    [
      params,
      selectedFilter,
      sortOptions,
      pageSize,
      searchValue,
      showDeleted,
      handlePagingChange,
    ]
  );

  const handleShowDeletedChange = useCallback(
    (value: boolean) => {
      setShowDeleted(value);
      if (currentPage === INITIAL_PAGING_VALUE) {
        fetchTestCases(INITIAL_PAGING_VALUE, undefined, {
          include: value ? Include.Deleted : Include.NonDeleted,
        });
      } else {
        handlePageChange(INITIAL_PAGING_VALUE);
      }
    },
    [currentPage, fetchTestCases, handlePageChange]
  );

  const sortTestCase = async (apiParams?: TestCaseSearchParams) => {
    const updatedValue = uniq([...selectedFilter, ...Object.keys(params)]);
    await fetchTestCases(
      INITIAL_PAGING_VALUE,
      updatedValue,
      apiParams ?? DEFAULT_SORT_ORDER
    );
    setSortOptions(apiParams ?? DEFAULT_SORT_ORDER);
  };

  const handlePagingClick = useCallback(
    ({ currentPage: page }: PagingHandlerParams) => {
      handlePageChange(page);
      fetchTestCases(page);
    },
    [handlePageChange, fetchTestCases]
  );

  const getTestCases = () => {
    if (!isEmpty(params) || !isEmpty(selectedFilter)) {
      const updatedValue = uniq([...selectedFilter, ...Object.keys(params)]);
      for (const key of updatedValue) {
        getInitialOptions(key, true);
      }
      setSelectedFilter(updatedValue);
      fetchTestCases(currentPage, updatedValue);
      // AntD multi-select requires an array even when the URL contains the
      // legacy single-value status format.
      form.setFieldsValue({
        ...params,
        testCaseStatus: params.testCaseStatus
          ? castArray(params.testCaseStatus)
          : undefined,
      });
    } else {
      fetchTestCases(currentPage);
    }
  };

  useEffect(() => {
    if (
      getPrioritizedViewPermission(testCasePermission, Operation.ViewBasic) &&
      tab === DataQualityPageTabs.TEST_CASES
    ) {
      getTestCases();
    } else {
      setIsLoading(false);
    }
  }, [tab, testCasePermission, pageSize, params, currentPage]);

  const pagingData = useMemo(
    () => ({
      paging,
      currentPage,
      pagingHandler: handlePagingClick,
      pageSize,
      onShowSizeChange: handlePageSizeChange,
      isNumberBased: true,
    }),
    [paging, currentPage, handlePagingClick, pageSize, handlePageSizeChange]
  );

  return {
    testCase,
    setTestCase,
    isLoading,
    fetchTestCases,
    sortTestCase,
    pagingData,
    showPagination,
    showDeleted,
    handleShowDeletedChange,
  };
};
