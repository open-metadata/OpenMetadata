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
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_BASE,
} from '../../../constants/constants';
import { TEST_SUITE_TEST_CASE_FIELDS } from '../../../rest/queries/testSuiteQuery';
import {
  getListTestCaseBySearch,
  ListTestCaseParamsBySearch,
} from '../../../rest/testAPI';
import {
  NextPreviousProps,
  PagingHandlerParams,
} from '../../common/NextPrevious/NextPrevious.interface';

/**
 * Pages through the test cases that use one test definition. Paging is local
 * state, not the URL: the panel sits on the Test Library list, whose own
 * paging already owns `?currentPage`. The query is keyed by FQN, page and
 * sort, so a slow response for a previous definition, page or sort cannot
 * overwrite the current one.
 */
export const useTestDefinitionTestCases = (fqn?: string) => {
  const [currentPage, setCurrentPage] = useState(INITIAL_PAGING_VALUE);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_BASE);
  const [sort, setSort] =
    useState<Pick<ListTestCaseParamsBySearch, 'sortField' | 'sortType'>>();

  useEffect(() => {
    setCurrentPage(INITIAL_PAGING_VALUE);
  }, [fqn]);

  const { data, isError, isFetching, isPlaceholderData, refetch } = useQuery({
    queryKey: [
      'testDefinitionTestCases',
      fqn,
      currentPage,
      pageSize,
      sort?.sortField,
      sort?.sortType,
    ],
    queryFn: () =>
      getListTestCaseBySearch({
        ...sort,
        testDefinition: fqn,
        fields: TEST_SUITE_TEST_CASE_FIELDS,
        offset: (currentPage - 1) * pageSize,
        limit: pageSize,
        includePermissions: true,
      }),
    enabled: Boolean(fqn),
    placeholderData: keepPreviousData,
  });

  // A delete can empty the last page; step back to the new last page.
  useEffect(() => {
    if (
      data &&
      !isPlaceholderData &&
      data.data.length === 0 &&
      currentPage > INITIAL_PAGING_VALUE
    ) {
      setCurrentPage(
        Math.max(INITIAL_PAGING_VALUE, Math.ceil(data.paging.total / pageSize))
      );
    }
  }, [data, isPlaceholderData, currentPage, pageSize]);

  const sortTestCases = useCallback(
    async (params?: ListTestCaseParamsBySearch) => {
      setSort(
        params?.sortField
          ? { sortField: params.sortField, sortType: params.sortType }
          : undefined
      );
      setCurrentPage(INITIAL_PAGING_VALUE);
    },
    []
  );

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
    isError,
    isLoading: isFetching,
    showPagination: (data?.paging.total ?? 0) > 0,
    pagingData,
    refetchTestCases,
    sortTestCases,
  };
};
