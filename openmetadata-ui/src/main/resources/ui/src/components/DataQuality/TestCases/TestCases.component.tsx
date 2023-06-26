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
import Searchbar from 'components/common/searchbar/Searchbar';
import DataQualityTab from 'components/ProfilerDashboard/component/DataQualityTab';
import { INITIAL_PAGING_VALUE, PAGE_SIZE } from 'constants/constants';
import { SearchIndex } from 'enums/search.enum';
import { TestCase } from 'generated/tests/testCase';
import { Paging } from 'generated/type/paging';
import {
  SearchHitBody,
  TestCaseSearchSource,
} from 'interface/search.interface';
import { isString } from 'lodash';
import { PagingResponse } from 'Models';
import { DataQualityPageTabs } from 'pages/DataQuality/DataQualityPage.interface';
import QueryString from 'qs';
import React, { useEffect, useMemo, useState } from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { searchQuery } from 'rest/searchAPI';
import { getListTestCase, ListTestCaseParams } from 'rest/testAPI';
import { showErrorToast } from 'utils/ToastUtils';
import { DataQualitySearchParams } from '../DataQuality.interface';
import { SummaryPanel } from '../SummaryPannel/SummaryPanel.component';

export const TestCases = () => {
  const history = useHistory();
  const location = useLocation();
  const { tab } = useParams<{ tab: DataQualityPageTabs }>();

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
      });
      const hits = (
        response.hits.hits as SearchHitBody<
          SearchIndex.TEST_CASE,
          TestCaseSearchSource
        >[]
      ).map((value) => value._source);

      setTestCase({
        data: hits,
        paging: { total: response.hits.total.value ?? 0 },
      });
    } catch (error) {
      setTestCase({ data: [], paging: { total: 0 } });
    } finally {
      setIsLoading(false);
    }
  };
  const handlePagingClick = (
    cursorValue: string | number,
    activePage?: number
  ) => {
    if (searchValue) {
      searchTestCases(cursorValue as number);
    } else {
      const { paging } = testCase;
      if (isString(cursorValue)) {
        fetchTestCases({
          [cursorValue]: paging?.[cursorValue as keyof Paging],
        });
      }
    }
    activePage && setCurrentPage(activePage);
  };

  useEffect(() => {
    if (tab === DataQualityPageTabs.TEST_CASES) {
      if (searchValue) {
        searchTestCases();
      } else {
        fetchTestCases();
      }
    }
  }, [tab, searchValue]);

  return (
    <Row className="p-x-lg p-t-md" gutter={[16, 16]}>
      <Col span={8}>
        <Searchbar
          removeMargin
          searchValue={searchValue}
          onSearch={(value) => handleSearchParam(value, 'searchValue')}
        />
      </Col>
      <Col span={24}>
        <SummaryPanel />
      </Col>
      <Col span={24}>
        <DataQualityTab
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
