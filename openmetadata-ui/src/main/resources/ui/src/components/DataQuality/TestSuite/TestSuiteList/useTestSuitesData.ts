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
import { AxiosError } from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { INITIAL_PAGING_VALUE } from '../../../../constants/constants';
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { SORT_ORDER } from '../../../../enums/common.enum';
import { TabSpecificField } from '../../../../enums/entity.enum';
import { TestSuiteType } from '../../../../enums/TestSuite.enum';
import { Operation } from '../../../../generated/entity/policies/policy';
import { TestSuite } from '../../../../generated/tests/testCase';
import { UsePagingInterface } from '../../../../hooks/paging/usePaging';
import { DataQualitySubTabs } from '../../../../pages/DataQuality/DataQualityPage.interface';
import {
  getListTestSuitesBySearch,
  ListTestSuitePramsBySearch,
} from '../../../../rest/testAPI';
import { getPrioritizedViewPermission } from '../../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { PagingHandlerParams } from '../../../common/NextPrevious/NextPrevious.interface';

export interface UseTestSuitesDataProps {
  searchValue: string;
  owner: string;
  ownerFilterValue?: {
    key?: string;
    label?: string;
  };
  subTab: DataQualitySubTabs;
  testSuitePermission: OperationPermission;
  currentPage: number;
  pageSize: number;
  handlePageChange: UsePagingInterface['handlePageChange'];
  handlePageSizeChange: UsePagingInterface['handlePageSizeChange'];
  handlePagingChange: UsePagingInterface['handlePagingChange'];
}

/**
 * Owns the DATA concern for the Test Suites tab: the fetched rows, the loading
 * flag, the latest-request race guard, the suites fetch, the driving effect and
 * the page handlers. The effect stays co-located with {@link fetchTestSuites}
 * and the latest-request guard so the fetch is issued from a single place (no
 * double-fetch / out-of-order writes). Filter values and the paging bag are
 * injected.
 */
export const useTestSuitesData = ({
  searchValue,
  owner,
  ownerFilterValue,
  subTab,
  testSuitePermission,
  currentPage,
  pageSize,
  handlePageChange,
  handlePageSizeChange,
  handlePagingChange,
}: UseTestSuitesDataProps) => {
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Guards against out-of-order responses when the tab/filters change mid-fetch
  // (main #29561): only the latest request is allowed to update state.
  const latestRequestId = useRef(0);

  const fetchTestSuites = async (
    page = INITIAL_PAGING_VALUE,
    fetchParams?: ListTestSuitePramsBySearch
  ) => {
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;

    setIsLoading(true);
    try {
      const result = await getListTestSuitesBySearch({
        ...fetchParams,
        fields: [TabSpecificField.OWNERS, TabSpecificField.SUMMARY],
        q: searchValue ? `*${searchValue}*` : undefined,
        owner: ownerFilterValue?.key,
        offset: (page - 1) * pageSize,
        includeEmptyTestSuites: subTab !== DataQualitySubTabs.TABLE_SUITES,
        testSuiteType:
          subTab === DataQualitySubTabs.TABLE_SUITES
            ? TestSuiteType.basic
            : TestSuiteType.logical,
        sortField: 'lastResultTimestamp',
        sortType: SORT_ORDER.DESC,
      });
      if (requestId !== latestRequestId.current) {
        return;
      }
      setTestSuites(result.data);
      handlePagingChange(result.paging);
    } catch (error) {
      if (requestId === latestRequestId.current) {
        showErrorToast(error as AxiosError);
      }
    } finally {
      if (requestId === latestRequestId.current) {
        setIsLoading(false);
      }
    }
  };

  const handleTestSuitesPageChange = useCallback(
    ({ currentPage: page }: PagingHandlerParams) => {
      // setCurrentPage triggers the fetch effect (currentPage is a dependency);
      // fetching here too would duplicate the request.
      handlePageChange(page);
    },
    [handlePageChange]
  );

  useEffect(() => {
    if (
      getPrioritizedViewPermission(testSuitePermission, Operation.ViewBasic)
    ) {
      fetchTestSuites(currentPage, {
        limit: pageSize,
      });
    } else {
      setIsLoading(false);
    }
  }, [testSuitePermission, pageSize, searchValue, owner, subTab, currentPage]);

  return {
    testSuites,
    isLoading,
    handleTestSuitesPageChange,
    handlePageSizeChange,
  };
};
