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
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_BASE,
} from '../../../constants/constants';
import { TEST_SUITE_TEST_CASE_FIELDS } from '../../../rest/queries/testSuiteQuery';
import { getListTestCaseBySearch } from '../../../rest/testAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  NextPreviousProps,
  PagingHandlerParams,
} from '../../common/NextPrevious/NextPrevious.interface';

/**
 * Pages through the test cases that use one test definition. Paging is local
 * state, not the URL: the panel sits on the Test Library list, whose own
 * paging already owns `?currentPage`. The query is keyed by FQN and page, so a
 * slow response for a previous definition or page cannot overwrite the current
 * one.
 */
export const useTestDefinitionTestCases = (fqn?: string) => {
  const [currentPage, setCurrentPage] = useState(INITIAL_PAGING_VALUE);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_BASE);

  useEffect(() => {
    setCurrentPage(INITIAL_PAGING_VALUE);
  }, [fqn]);

  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ['testDefinitionTestCases', fqn, currentPage, pageSize],
    queryFn: () =>
      getListTestCaseBySearch({
        testDefinition: fqn,
        fields: TEST_SUITE_TEST_CASE_FIELDS,
        offset: (currentPage - 1) * pageSize,
        limit: pageSize,
        includePermissions: true,
      }),
    enabled: Boolean(fqn),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (error) {
      showErrorToast(error as AxiosError);
    }
  }, [error]);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(INITIAL_PAGING_VALUE);
  }, []);

  const pagingData: NextPreviousProps = useMemo(
    () => ({
      isNumberBased: true,
      currentPage,
      pageSize,
      paging: data?.paging ?? { total: 0 },
      onShowSizeChange: handlePageSizeChange,
      pagingHandler: ({ currentPage: page }: PagingHandlerParams) =>
        page && setCurrentPage(page),
    }),
    [currentPage, pageSize, data?.paging, handlePageSizeChange]
  );

  const refetchTestCases = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    testCases: data?.data ?? [],
    entityPermissions: data?.entityPermissions,
    isLoading: isFetching,
    showPagination: (data?.paging.total ?? 0) > 0,
    pagingData,
    refetchTestCases,
  };
};
