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
import { RightOutlined } from '@ant-design/icons';
import {
  Button,
  Col,
  Dropdown,
  Form,
  FormProps,
  Row,
  Select,
  Space,
} from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { DefaultOptionType } from 'antd/lib/select';
import { AxiosError } from 'axios';
import {
  debounce,
  entries,
  isEmpty,
  isEqual,
  isUndefined,
  omit,
  omitBy,
  startCase,
} from 'lodash';
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
import { TestCase } from '../../../generated/tests/testCase';
import { usePaging } from '../../../hooks/paging/usePaging';
import { DataQualityPageTabs } from '../../../pages/DataQuality/DataQualityPage.interface';
import { searchQuery } from '../../../rest/searchAPI';
import {
  getListTestCaseBySearch,
  ListTestCaseParamsBySearch,
} from '../../../rest/testAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { getDataQualityPagePath } from '../../../utils/RouterUtils';
import { generateEntityLink } from '../../../utils/TableUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import DatePickerMenu from '../../common/DatePickerMenu/DatePickerMenu.component';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import Searchbar from '../../common/SearchBarComponent/SearchBar.component';
import DataQualityTab from '../../Database/Profiler/DataQualityTab/DataQualityTab';
import { DataQualitySearchParams } from '../DataQuality.interface';

const testCaseFilters = {
  table: 'tableFqn',
  platform: 'testPlatforms',
  type: 'testCaseType',
  status: 'testCaseStatus',
  lastRun: 'lastRunRange',
};

// const testCaseFilters = {
//   table: { formKey: 'tableFqn', name: 'table' },
//   platform: { formKey: 'testPlatforms', name: 'platform' },
//   type: { formKey: 'testCaseType', name: 'type' },
//   status: { formKey: 'testCaseStatus', name: 'status' },
//   lastRun: { formKey: 'lastRunRange', name: 'lastRun' },
// };

export const TestCases = ({ summaryPanel }: { summaryPanel: ReactNode }) => {
  const [form] = useForm();
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
  const [filters, setFilters] = useState<ListTestCaseParamsBySearch>({});
  const [selectedFilter, setSelectedFilter] = useState<string[]>([
    testCaseFilters.status,
    testCaseFilters.type,
  ]);

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

  const buildParams = (
    params: ListTestCaseParamsBySearch | undefined,
    filters: string[]
  ): ListTestCaseParamsBySearch => {
    const hasFilter = (filter: string) => filters.includes(filter);

    return {
      ...params,
      endTimestamp: hasFilter(testCaseFilters.lastRun)
        ? params?.endTimestamp
        : undefined,
      startTimestamp: hasFilter(testCaseFilters.lastRun)
        ? params?.startTimestamp
        : undefined,
      entityLink: hasFilter(testCaseFilters.table)
        ? params?.entityLink
        : undefined,
      testPlatforms: hasFilter(testCaseFilters.platform)
        ? params?.testPlatforms
        : undefined,
      testCaseType:
        isEmpty(params?.testCaseType) || !hasFilter(testCaseFilters.type)
          ? undefined
          : params?.testCaseType,
      testCaseStatus:
        isEmpty(params?.testCaseStatus) || !hasFilter(testCaseFilters.status)
          ? undefined
          : params?.testCaseStatus,
    };
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
    const startTimestamp = lastRunRange?.startTs;
    const endTimestamp = lastRunRange?.endTs;
    const entityLink = tableFqn ? generateEntityLink(tableFqn) : undefined;
    const params = {
      ...omit(values, ['lastRunRange', 'tableFqn']),
      startTimestamp,
      endTimestamp,
      entityLink,
    };
    const updatedParams = omitBy(
      buildParams(params, selectedFilter),
      isUndefined
    );
    if (!isEqual(filters, updatedParams)) {
      fetchTestCases(INITIAL_PAGING_VALUE, updatedParams);
    }

    setFilters((prev) => ({ ...prev, ...updatedParams }));
  };

  const handleMenuClick = ({ key }: { key: string }) => {
    setSelectedFilter((prevSelected) => {
      if (prevSelected.includes(key)) {
        const updatedValue = prevSelected.filter(
          (selected) => selected !== key
        );
        const updatedFilters = omitBy(
          buildParams(filters, updatedValue),
          isUndefined
        );
        form.setFieldsValue({ [key]: undefined });
        if (!isEqual(filters, updatedFilters)) {
          fetchTestCases(INITIAL_PAGING_VALUE, updatedFilters);
        }
        setFilters(updatedFilters);

        return updatedValue;
      }

      return [...prevSelected, key];
    });
  };

  const filterMenu: ItemType[] = useMemo(() => {
    return entries(testCaseFilters).map(([name, filter]) => ({
      key: filter,
      label: startCase(name),
      value: filter,
      onClick: handleMenuClick,
    }));
  }, [filters]);

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
          form={form}
          initialValues={filters}
          layout="horizontal"
          onValuesChange={handleFilterChange}>
          <Space wrap align="center" className="w-full" size={16}>
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
            <Form.Item noStyle name="selectedFilters">
              <Dropdown
                menu={{
                  items: filterMenu,
                  selectedKeys: selectedFilter,
                }}
                trigger={['click']}>
                <Button
                  ghost
                  className="expand-btn"
                  data-testid="advanced-filter"
                  type="primary">
                  {t('label.advanced')}
                  <RightOutlined />
                </Button>
              </Dropdown>
            </Form.Item>
            {selectedFilter.includes(testCaseFilters.table) && (
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
            )}
            {selectedFilter.includes(testCaseFilters.platform) && (
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
            )}
            {selectedFilter.includes(testCaseFilters.type) && (
              <Form.Item
                className="m-0 w-40"
                label={t('label.type')}
                name="testCaseType">
                <Select
                  allowClear
                  data-testid="test-case-type-select-filter"
                  options={TEST_CASE_TYPE_OPTION}
                  placeholder={t('label.type')}
                />
              </Form.Item>
            )}
            {selectedFilter.includes(testCaseFilters.status) && (
              <Form.Item
                className="m-0 w-40"
                label={t('label.status')}
                name="testCaseStatus">
                <Select
                  allowClear
                  data-testid="status-select-filter"
                  options={TEST_CASE_STATUS_OPTION}
                  placeholder={t('label.status')}
                />
              </Form.Item>
            )}
            {selectedFilter.includes(testCaseFilters.lastRun) && (
              <Form.Item
                className="m-0"
                label={t('label.last-run')}
                name="lastRunRange"
                trigger="handleDateRangeChange"
                valuePropName="defaultDateRange">
                <DatePickerMenu showSelectedCustomRange />
              </Form.Item>
            )}
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
