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
import { Col, Row, Select, Space, Typography } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import { AxiosError } from 'axios';
import Searchbar from 'components/common/searchbar/Searchbar';
import DataQualityTab from 'components/ProfilerDashboard/component/DataQualityTab';
import { INITIAL_PAGING_VALUE } from 'constants/constants';
import { TestCase, TestCaseStatus } from 'generated/tests/testCase';
import { EntityType } from 'generated/tests/testDefinition';
import { Paging } from 'generated/type/paging';
import { t } from 'i18next';
import { isString, map } from 'lodash';
import { PagingResponse } from 'Models';
import { DataQualityPageTabs } from 'pages/DataQuality/DataQualityPage.interface';
import QueryString from 'qs';
import React, { useEffect, useMemo, useState } from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { getListTestCase, ListTestCaseParams } from 'rest/testAPI';
import { showErrorToast } from 'utils/ToastUtils';
import { DataQualitySearchParams } from '../DataQuality.interface';
import { SummaryPanel } from '../SummaryPannel/SummaryPanel.component';
import './test-cases.style.less';

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
  const { searchValue = '', status = '', type = '' } = params;

  const [testCase, setTestCase] = useState<PagingResponse<TestCase[]>>({
    data: [],
    paging: { total: 0 },
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState(INITIAL_PAGING_VALUE);

  const statusOption = useMemo(() => {
    const testCaseStatus: DefaultOptionType[] = Object.values(
      TestCaseStatus
    ).map((value) => ({
      label: value,
      value: value,
    }));
    testCaseStatus.unshift({
      label: t('label.all'),
      value: '',
    });

    return testCaseStatus;
  }, []);

  const typeOption = useMemo(() => {
    const testCaseStatus: DefaultOptionType[] = map(
      EntityType,
      (value, key) => ({
        label: key,
        value: value,
      })
    );
    testCaseStatus.unshift({
      label: t('label.all'),
      value: '',
    });

    return testCaseStatus;
  }, []);

  const handleSearchParam = (
    value: string | boolean,
    key: keyof DataQualitySearchParams
  ) => {
    history.push({
      search: QueryString.stringify({ ...params, [key]: value }),
    });
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

  const handlePagingClick = (
    cursorValue: string | number,
    activePage?: number
  ) => {
    const { paging } = testCase;
    if (isString(cursorValue)) {
      fetchTestCases({ [cursorValue]: paging?.[cursorValue as keyof Paging] });
    }
    activePage && setCurrentPage(activePage);
  };

  useEffect(() => {
    if (tab === DataQualityPageTabs.TEST_CASES) {
      fetchTestCases();
    }
  }, [tab]);

  return (
    <Row className="p-x-lg p-t-md" gutter={[16, 16]}>
      <Col span={24}>
        <Row justify="space-between">
          <Col span={8}>
            <Searchbar
              removeMargin
              searchValue={searchValue}
              onSearch={(value) => handleSearchParam(value, 'searchValue')}
            />
          </Col>
          <Col>
            <Space size={12}>
              <Space>
                <Typography.Text>{t('label.status')}</Typography.Text>
                <Select
                  className="w-32"
                  options={statusOption}
                  placeholder={t('label.status')}
                  value={status}
                  onChange={(value) => handleSearchParam(value, 'status')}
                />
              </Space>
              <Space>
                <Typography.Text>{t('label.type')}</Typography.Text>
                <Select
                  className="w-32"
                  options={typeOption}
                  placeholder={t('label.type')}
                  value={type}
                  onChange={(value) => handleSearchParam(value, 'type')}
                />
              </Space>
            </Space>
          </Col>
        </Row>
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
          }}
          testCases={testCase.data}
          onTestCaseResultUpdate={handleStatusSubmit}
        />
      </Col>
    </Row>
  );
};
