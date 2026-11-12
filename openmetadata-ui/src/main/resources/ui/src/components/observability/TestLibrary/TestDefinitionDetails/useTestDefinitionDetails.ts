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
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo } from 'react';
import { INITIAL_PAGING_VALUE } from '../../../../constants/constants';
import { usePaging } from '../../../../hooks/paging/usePaging';
import { TEST_SUITE_TEST_CASE_FIELDS } from '../../../../rest/queries/testSuiteQuery';
import {
    getListTestCaseBySearch,
    getTestDefinitionByName
} from '../../../../rest/testAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import {
    NextPreviousProps,
    PagingHandlerParams
} from '../../../common/NextPrevious/NextPrevious.interface';

export const testDefinitionDetailsQueryKey = (fqn: string) => [
  'testDefinitionDetails',
  fqn,
];

/**
 * Loads one test definition and the test cases that use it. Both are keyed by
 * the definition FQN (and the page for test cases), so a slow response for a
 * previous definition or page can never overwrite the current one.
 */
export const useTestDefinitionDetails = (fqn: string, enabled: boolean) => {
  const {
    currentPage,
    handlePageChange,
    pageSize,
    handlePageSizeChange,
    paging,
    handlePagingChange,
    showPagination,
  } = usePaging();

  const definitionQuery = useQuery({
    queryKey: testDefinitionDetailsQueryKey(fqn),
    queryFn: () => getTestDefinitionByName(fqn),
    enabled: enabled && Boolean(fqn),
  });

  const testCaseQuery = useQuery({
    queryKey: ['testDefinitionTestCases', fqn, currentPage, pageSize],
    queryFn: () =>
      getListTestCaseBySearch({
        testDefinition: fqn,
        fields: TEST_SUITE_TEST_CASE_FIELDS,
        offset: (currentPage - 1) * pageSize,
        limit: pageSize,
        includePermissions: true,
      }),
    enabled: enabled && Boolean(fqn),
    placeholderData: keepPreviousData,
  });

  // A new definition starts on its first page; the route param can change
  // while this hook stays mounted (back/forward between two definitions).
  useEffect(() => {
    handlePageChange(INITIAL_PAGING_VALUE);
  }, [fqn, handlePageChange]);

  useEffect(() => {
    if (testCaseQuery.error) {
      showErrorToast(testCaseQuery.error as AxiosError);
    }
  }, [testCaseQuery.error]);

  useEffect(() => {
    if (testCaseQuery.data) {
      handlePagingChange(testCaseQuery.data.paging);
    }
  }, [testCaseQuery.data, handlePagingChange]);

  const handleTestCasePaging = useCallback(
    ({ currentPage: page }: PagingHandlerParams) => {
      if (page) {
        handlePageChange(page);
      }
    },
    [handlePageChange]
  );

  const pagingData: NextPreviousProps = useMemo(
    () => ({
      isNumberBased: true,
      currentPage,
      pageSize,
      paging,
      onShowSizeChange: handlePageSizeChange,
      pagingHandler: handleTestCasePaging,
    }),
    [currentPage, pageSize, paging, handlePageSizeChange, handleTestCasePaging]
  );

  const { refetch: refetchTestCaseQuery } = testCaseQuery;
  const refetchTestCases = useCallback(() => {
    void refetchTestCaseQuery();
  }, [refetchTestCaseQuery]);

  return {
    testDefinition: definitionQuery.data,
    isDefinitionLoading: definitionQuery.isLoading,
    definitionError: definitionQuery.error,
    refetchDefinition: definitionQuery.refetch,
    testCases: testCaseQuery.data?.data ?? [],
    entityPermissions: testCaseQuery.data?.entityPermissions,
    isTestCaseLoading: testCaseQuery.isFetching,
    refetchTestCases,
    pagingData,
    showPagination,
  };
};
