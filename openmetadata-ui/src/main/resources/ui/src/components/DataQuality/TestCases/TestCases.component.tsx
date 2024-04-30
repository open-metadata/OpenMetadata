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
import { Col, DatePicker, Form, FormProps, Row, Select, Space } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import { AxiosError } from 'axios';
import { debounce, isEmpty, omit } from 'lodash';
import QueryString from 'qs';
import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { WILD_CARD_CHAR } from '../../../constants/char.constants';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE,
  PAGE_SIZE_BASE,
} from '../../../constants/constants';
import {
  TEST_CASE_PLATFORM_OPTION,
  TEST_CASE_STATUS_OPTION,
  TEST_CASE_TYPE_OPTION,
} from '../../../constants/profiler.constant';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ERROR_PLACEHOLDER_TYPE, SORT_ORDER } from '../../../enums/common.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { TestCase, TestCaseStatus } from '../../../generated/tests/testCase';
import { usePaging } from '../../../hooks/paging/usePaging';
import { DataQualityPageTabs } from '../../../pages/DataQuality/DataQualityPage.interface';
import { searchQuery } from '../../../rest/searchAPI';
import {
  getListTestCaseBySearch,
  ListTestCaseParamsBySearch,
  TestCaseType,
} from '../../../rest/testAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { getDataQualityPagePath } from '../../../utils/RouterUtils';
import { generateEntityLink } from '../../../utils/TableUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import Searchbar from '../../common/SearchBarComponent/SearchBar.component';
import DataQualityTab from '../../Database/Profiler/DataQualityTab/DataQualityTab';
import { DataQualitySearchParams } from '../DataQuality.interface';

export const TestCases = ({ summaryPanel }: { summaryPanel: ReactNode }) => {
  const history = useHistory();
  const location = useLocation();
  const { t } = useTranslation();
  const { tab } = useParams<{ tab: DataQualityPageTabs }>();
  const { permissions } = usePermissionProvider();
  const { testCase: testCasePermission } = permissions;
  const [tableOptions, setTableOptions] = useState<DefaultOptionType[]>([]);
  const [isTableLoading, setIsTableLoading] = useState(false);

  const params = useMemo(() => {
    const search = location.search;

    const params = QueryString.parse(
      search.startsWith('?') ? search.substring(1) : search
    );

    return params as DataQualitySearchParams;
  }, [location]);
  const { searchValue = '' } = params;

  const [testCase, setTestCase] = useState<TestCase[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filters, setFilters] = useState<ListTestCaseParamsBySearch>({
    testCaseType: TestCaseType.all,
    testCaseStatus: '' as TestCaseStatus,
  });

  const {
    currentPage,
    handlePageChange,
    pageSize,
    handlePageSizeChange,
    paging,
    handlePagingChange,
    showPagination,
  } = usePaging(PAGE_SIZE);

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
        const updatedTestCase = prev.map((test) =>
          test.id === data.id ? { ...test, ...data } : test
        );

        return updatedTestCase;
      });
    }
  };

  const fetchTestCases = async (
    currentPage = INITIAL_PAGING_VALUE,
    params?: ListTestCaseParamsBySearch
  ) => {
    setIsLoading(true);
    try {
      const { data, paging } = await getListTestCaseBySearch({
        ...params,
        testCaseStatus: isEmpty(params?.testCaseStatus)
          ? undefined
          : params?.testCaseStatus,
        limit: pageSize,
        includeAllTests: true,
        fields: 'testCaseResult,testSuite,incidentId',
        q: searchValue ? `*${searchValue}*` : undefined,
        offset: (currentPage - 1) * pageSize,
        sortType: SORT_ORDER.DESC,
        sortField: 'testCaseResult.timestamp',
      });
      setTestCase(data);
      handlePagingChange(paging);
      handlePageChange(currentPage);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusSubmit = (testCase: TestCase) => {
    setTestCase((prev) => {
      const data = prev.map((test) => {
        if (test.fullyQualifiedName === testCase.fullyQualifiedName) {
          return testCase;
        }

        return test;
      });

      return data;
    });
  };

  const handlePagingClick = ({ currentPage }: PagingHandlerParams) => {
    fetchTestCases(currentPage, filters);
  };

  const handleFilterChange: FormProps['onValuesChange'] = (_, values) => {
    const { lastRunRange, tableFqn } = values;
    const startTimestamp = lastRunRange?.[0]
      ? lastRunRange[0].set({ h: 0, m: 0 }).unix() * 1000
      : undefined;
    const endTimestamp = lastRunRange?.[1]
      ? lastRunRange[1].set({ h: 23, m: 59 }).unix() * 1000
      : undefined;
    const entityLink = tableFqn ? generateEntityLink(tableFqn) : undefined;
    const params = {
      ...omit(values, ['lastRunRange', 'tableFqn']),
      startTimestamp,
      endTimestamp,
      entityLink,
    };
    fetchTestCases(INITIAL_PAGING_VALUE, params);
    setFilters((prev) => ({ ...prev, ...params }));
  };

  const fetchTableData = async (search = WILD_CARD_CHAR) => {
    setIsTableLoading(true);
    try {
      const response = await searchQuery({
        query: `*${search}*`,
        pageNumber: 1,
        pageSize: PAGE_SIZE_BASE,
        searchIndex: SearchIndex.TABLE,
        fetchSource: true,
        includeFields: ['name', 'fullyQualifiedName', 'displayName'],
      });

      const options = response.hits.hits.map((hit) => ({
        label: getEntityName(hit._source),
        value: hit._source.fullyQualifiedName,
      }));
      setTableOptions(options);
    } catch (error) {
      setTableOptions([]);
    } finally {
      setIsTableLoading(false);
    }
  };

  const debounceFetchTableData = useCallback(debounce(fetchTableData, 1000), [
    fetchTableData,
  ]);

  useEffect(() => {
    if (testCasePermission?.ViewAll || testCasePermission?.ViewBasic) {
      if (tab === DataQualityPageTabs.TEST_CASES) {
        fetchTestCases(INITIAL_PAGING_VALUE, filters);
      }
    } else {
      setIsLoading(false);
    }
  }, [tab, searchValue, testCasePermission, pageSize]);

  useEffect(() => {
    fetchTableData();
  }, []);

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

  if (!testCasePermission?.ViewAll && !testCasePermission?.ViewBasic) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  return (
    <Row
      className="p-x-lg p-t-md"
      data-testid="test-case-container"
      gutter={[16, 16]}>
      <Col span={24}>
        <Form
          initialValues={filters}
          layout="horizontal"
          onValuesChange={handleFilterChange}>
          <Space wrap align="center" className="w-full justify-between">
            <Form.Item className="m-0 w-80">
              <Searchbar
                removeMargin
                placeholder={t('label.search-entity', {
                  entity: t('label.test-case-lowercase'),
                })}
                searchValue={searchValue}
                onSearch={(value) => handleSearchParam(value, 'searchValue')}
              />
            </Form.Item>
            <Form.Item
              className="m-0 w-52"
              label={t('label.table')}
              name="tableFqn">
              <Select
                allowClear
                showSearch
                data-testid="table-select-filter"
                loading={isTableLoading}
                options={tableOptions}
                placeholder={t('label.table')}
                onSearch={debounceFetchTableData}
              />
            </Form.Item>
            <Form.Item
              className="m-0 w-min-20"
              label={t('label.platform')}
              name="testPlatforms">
              <Select
                allowClear
                data-testid="platform-select-filter"
                mode="multiple"
                options={TEST_CASE_PLATFORM_OPTION}
                placeholder={t('label.platform')}
              />
            </Form.Item>
            <Form.Item
              className="m-0 w-40"
              label={t('label.type')}
              name="testCaseType">
              <Select
                data-testid="test-case-type-select-filter"
                options={TEST_CASE_TYPE_OPTION}
              />
            </Form.Item>
            <Form.Item
              className="m-0 w-40"
              label={t('label.status')}
              name="testCaseStatus">
              <Select
                data-testid="status-select-filter"
                options={TEST_CASE_STATUS_OPTION}
              />
            </Form.Item>
            <Form.Item
              className="m-0"
              label={t('label.last-run')}
              name="lastRunRange">
              <DatePicker.RangePicker
                allowClear
                showNow
                data-testid="last-run-range-picker"
              />
            </Form.Item>
          </Space>
        </Form>
      </Col>
      <Col span={24}>{summaryPanel}</Col>
      <Col span={24}>
        <DataQualityTab
          afterDeleteAction={fetchTestCases}
          breadcrumbData={[
            {
              name: t('label.data-quality'),
              url: getDataQualityPagePath(DataQualityPageTabs.TEST_CASES),
            },
          ]}
          isLoading={isLoading}
          pagingData={pagingData}
          showPagination={showPagination}
          testCases={testCase}
          onTestCaseResultUpdate={handleStatusSubmit}
          onTestUpdate={handleTestCaseUpdate}
        />
      </Col>
    </Row>
  );
};
