/*
 *  Copyright 2023 Collate.
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
import { Col, Row } from 'antd';
import { AxiosError } from 'axios';
import { PagingResponse } from 'Models';
import QueryString from 'qs';
import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { INITIAL_PAGING_VALUE, PAGE_SIZE } from '../../../constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { TestCase } from '../../../generated/tests/testCase';
import {
  SearchHitBody,
  TestCaseSearchSource,
} from '../../../interface/search.interface';
import { DataQualityPageTabs } from '../../../pages/DataQuality/DataQualityPage.interface';
import { searchQuery } from '../../../rest/searchAPI';
import {
  getListTestCase,
  getTestCaseById,
  ListTestCaseParams,
} from '../../../rest/testAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import Searchbar from '../../common/SearchBarComponent/SearchBar.component';
import { usePermissionProvider } from '../../PermissionProvider/PermissionProvider';
import DataQualityTab from '../../ProfilerDashboard/component/DataQualityTab';
import { DataQualitySearchParams } from '../DataQuality.interface';

export const TestCases = ({ summaryPanel }: { summaryPanel: ReactNode }) => {
  const history = useHistory();
  const location = useLocation();
  const { tab } = useParams<{ tab: DataQualityPageTabs }>();
  const { permissions } = usePermissionProvider();
  const { testCase: testCasePermission } = permissions;

  const params = useMemo(() => {
    const search = location.search;

    const params = QueryString.parse(
      search.startsWith('?') ? search.substring(1) : search
    );

    return params as DataQualitySearchParams;
  }, [location]);
  const { searchValue = '' } = params;

  const [testCase, setTestCase] = useState<PagingResponse<TestCase[]>>({
    data: [],
    paging: { total: 0 },
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState(INITIAL_PAGING_VALUE);

  const handleSearchParam = (
    value: string | boolean,
    key: keyof DataQualitySearchParams
  ) => {
    history.push({
      search: QueryString.stringify({ ...params, [key]: value }),
    });
  };

  const handleTestCaseUpdate = (data?: TestCase) => {
    if (data) {
      setTestCase((prev) => {
        const updatedTestCase = prev.data.map((test) =>
          test.id === data.id ? { ...test, ...data } : test
        );

        return { ...prev, data: updatedTestCase };
      });
    }
  };

  const fetchTestCases = async (params?: ListTestCaseParams) => {
    setIsLoading(true);
    try {
      const response = await getListTestCase({
        ...params,
        fields: 'testDefinition,testCaseResult,testSuite',
        orderByLastExecutionDate: true,
      });
      setTestCase(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusSubmit = (testCase: TestCase) => {
    setTestCase((prev) => {
      const data = prev.data.map((test) => {
        if (test.fullyQualifiedName === testCase.fullyQualifiedName) {
          return testCase;
        }

        return test;
      });

      return { ...prev, data };
    });
  };
  const searchTestCases = async (page = 1) => {
    setIsLoading(true);
    try {
      const response = await searchQuery({
        pageNumber: page,
        pageSize: PAGE_SIZE,
        searchIndex: SearchIndex.TEST_CASE,
        query: searchValue,
        fetchSource: false,
      });
      const promise = (
        response.hits.hits as SearchHitBody<
          SearchIndex.TEST_CASE,
          TestCaseSearchSource
        >[]
      ).map((value) =>
        getTestCaseById(value._id ?? '', {
          fields: 'testDefinition,testCaseResult,testSuite',
        })
      );

      const value = await Promise.allSettled(promise);

      const testSuites = value.reduce((prev, curr) => {
        if (curr.status === 'fulfilled') {
          return [...prev, curr.value.data];
        }

        return prev;
      }, [] as TestCase[]);

      setTestCase({
        data: testSuites,
        paging: { total: response.hits.total.value ?? 0 },
      });
    } catch (error) {
      setTestCase({ data: [], paging: { total: 0 } });
    } finally {
      setIsLoading(false);
    }
  };
  const handlePagingClick = ({
    cursorType,
    currentPage,
  }: PagingHandlerParams) => {
    if (searchValue) {
      searchTestCases(currentPage);
    } else {
      const { paging } = testCase;
      if (cursorType) {
        fetchTestCases({
          [cursorType]: paging?.[cursorType],
        });
      }
    }
    setCurrentPage(currentPage);
  };

  useEffect(() => {
    if (testCasePermission?.ViewAll || testCasePermission?.ViewBasic) {
      if (tab === DataQualityPageTabs.TEST_CASES) {
        if (searchValue) {
          searchTestCases();
        } else {
          fetchTestCases();
        }
      }
    } else {
      setIsLoading(false);
    }
  }, [tab, searchValue, testCasePermission]);

  if (!testCasePermission?.ViewAll && !testCasePermission?.ViewBasic) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  return (
    <Row
      className="p-x-lg p-t-md"
      data-testid="test-case-container"
      gutter={[16, 16]}>
      <Col span={8}>
        <Searchbar
          removeMargin
          searchValue={searchValue}
          onSearch={(value) => handleSearchParam(value, 'searchValue')}
        />
      </Col>
      <Col span={24}>{summaryPanel}</Col>
      <Col span={24}>
        <DataQualityTab
          afterDeleteAction={fetchTestCases}
          isLoading={isLoading}
          pagingData={{
            paging: testCase.paging,
            currentPage,
            onPagingClick: handlePagingClick,
            isNumberBased: Boolean(searchValue),
          }}
          testCases={testCase.data}
          onTestCaseResultUpdate={handleStatusSubmit}
          onTestUpdate={handleTestCaseUpdate}
        />
      </Col>
    </Row>
  );
};
