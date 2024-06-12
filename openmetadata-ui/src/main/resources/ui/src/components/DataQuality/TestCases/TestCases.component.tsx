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
  Typography,
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
  TIER_CATEGORY,
} from '../../../constants/constants';
import {
  TEST_CASE_FILTERS,
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
import { getTags } from '../../../rest/tagAPI';
import {
  getListTestCaseBySearch,
  ListTestCaseParamsBySearch,
} from '../../../rest/testAPI';
import { buildTestCaseParams } from '../../../utils/DataQuality/DataQualityUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { getDataQualityPagePath } from '../../../utils/RouterUtils';
import { generateEntityLink } from '../../../utils/TableUtils';
import tagClassBase from '../../../utils/TagClassBase';
import { showErrorToast } from '../../../utils/ToastUtils';
import DatePickerMenu from '../../common/DatePickerMenu/DatePickerMenu.component';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import Searchbar from '../../common/SearchBarComponent/SearchBar.component';
import DataQualityTab from '../../Database/Profiler/DataQualityTab/DataQualityTab';
import { DataQualitySearchParams } from '../DataQuality.interface';

export const TestCases = ({ summaryPanel }: { summaryPanel: ReactNode }) => {
  const [form] = useForm();
  const history = useHistory();
  const location = useLocation();
  const { t } = useTranslation();
  const { tab } = useParams<{ tab: DataQualityPageTabs }>();
  const { permissions } = usePermissionProvider();
  const { testCase: testCasePermission } = permissions;
  const [tableOptions, setTableOptions] = useState<DefaultOptionType[]>([]);
  const [isOptionsLoading, setIsOptionsLoading] = useState(false);
  const [tagOptions, setTagOptions] = useState<DefaultOptionType[]>([]);
  const [tierOptions, setTierOptions] = useState<DefaultOptionType[]>([]);
  const [serviceOptions, setServiceOptions] = useState<DefaultOptionType[]>([]);

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
    TEST_CASE_FILTERS.status,
    TEST_CASE_FILTERS.type,
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
      buildTestCaseParams(params, selectedFilter),
      isUndefined
    );

    if (!isEqual(filters, updatedParams)) {
      fetchTestCases(INITIAL_PAGING_VALUE, updatedParams);
    }

    setFilters(updatedParams);
  };

  const fetchTierOptions = async () => {
    try {
      setIsOptionsLoading(true);
      const { data } = await getTags({
        parent: 'Tier',
      });

      const options = data.map((hit) => {
        return {
          label: (
            <Space
              data-testid={hit.fullyQualifiedName}
              direction="vertical"
              size={0}>
              <Typography.Text className="text-xs text-grey-muted">
                {hit.fullyQualifiedName}
              </Typography.Text>
              <Typography.Text className="text-sm">
                {getEntityName(hit)}
              </Typography.Text>
            </Space>
          ),
          value: hit.fullyQualifiedName,
        };
      });

      setTierOptions(options);
    } catch (error) {
      setTierOptions([]);
    } finally {
      setIsOptionsLoading(false);
    }
  };

  const fetchTagOptions = async (search?: string) => {
    setIsOptionsLoading(true);
    try {
      const { data } = await tagClassBase.getTags(search ?? '', 1);

      const options = data
        .filter(
          ({ data: { classification } }) =>
            classification?.name !== TIER_CATEGORY
        )
        .map(({ label, value }) => {
          return {
            label: (
              <Space data-testid={value} direction="vertical" size={0}>
                <Typography.Text className="text-xs text-grey-muted">
                  {value}
                </Typography.Text>
                <Typography.Text className="text-sm">{label}</Typography.Text>
              </Space>
            ),
            value: value,
          };
        });

      setTagOptions(options);
    } catch (error) {
      setTagOptions([]);
    } finally {
      setIsOptionsLoading(false);
    }
  };

  const fetchTableData = async (search = WILD_CARD_CHAR) => {
    setIsOptionsLoading(true);
    try {
      const response = await searchQuery({
        query: `*${search}*`,
        pageNumber: 1,
        pageSize: PAGE_SIZE_BASE,
        searchIndex: SearchIndex.TABLE,
        fetchSource: true,
        includeFields: ['name', 'fullyQualifiedName', 'displayName'],
      });

      const options = response.hits.hits.map((hit) => {
        return {
          label: (
            <Space
              data-testid={hit._source.fullyQualifiedName}
              direction="vertical"
              size={0}>
              <Typography.Text className="text-xs text-grey-muted">
                {hit._source.fullyQualifiedName}
              </Typography.Text>
              <Typography.Text className="text-sm">
                {getEntityName(hit._source)}
              </Typography.Text>
            </Space>
          ),
          value: hit._source.fullyQualifiedName,
        };
      });
      setTableOptions(options);
    } catch (error) {
      setTableOptions([]);
    } finally {
      setIsOptionsLoading(false);
    }
  };

  const fetchServiceOptions = async (search = WILD_CARD_CHAR) => {
    setIsOptionsLoading(true);
    try {
      const response = await searchQuery({
        query: `*${search}*`,
        pageNumber: 1,
        pageSize: PAGE_SIZE_BASE,
        searchIndex: SearchIndex.DATABASE_SERVICE,
        fetchSource: true,
        includeFields: ['name', 'fullyQualifiedName', 'displayName'],
      });

      const options = response.hits.hits.map((hit) => {
        return {
          label: (
            <Space
              data-testid={hit._source.fullyQualifiedName}
              direction="vertical"
              size={0}>
              <Typography.Text className="text-xs text-grey-muted">
                {hit._source.fullyQualifiedName}
              </Typography.Text>
              <Typography.Text className="text-sm">
                {getEntityName(hit._source)}
              </Typography.Text>
            </Space>
          ),
          value: hit._source.fullyQualifiedName,
        };
      });
      setServiceOptions(options);
    } catch (error) {
      setServiceOptions([]);
    } finally {
      setIsOptionsLoading(false);
    }
  };

  const handleMenuClick = ({ key }: { key: string }) => {
    setSelectedFilter((prevSelected) => {
      if (prevSelected.includes(key)) {
        const updatedValue = prevSelected.filter(
          (selected) => selected !== key
        );
        const updatedFilters = omitBy(
          buildTestCaseParams(filters, updatedValue),
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

    // Fetch options based on the selected filter
    key === TEST_CASE_FILTERS.tier && fetchTierOptions();
    key === TEST_CASE_FILTERS.tags && fetchTagOptions();
    key === TEST_CASE_FILTERS.table && fetchTableData();
    key === TEST_CASE_FILTERS.service && fetchServiceOptions();
  };

  const filterMenu: ItemType[] = useMemo(() => {
    return entries(TEST_CASE_FILTERS).map(([name, filter]) => ({
      key: filter,
      label: startCase(name),
      value: filter,
      onClick: handleMenuClick,
    }));
  }, [filters]);

  const debounceFetchTableData = useCallback(debounce(fetchTableData, 1000), [
    fetchTableData,
  ]);

  const debounceFetchTagOptions = useCallback(debounce(fetchTagOptions, 1000), [
    fetchTagOptions,
  ]);

  const debounceFetchServiceOptions = useCallback(
    debounce(fetchServiceOptions, 1000),
    [fetchServiceOptions]
  );

  useEffect(() => {
    if (testCasePermission?.ViewAll || testCasePermission?.ViewBasic) {
      if (tab === DataQualityPageTabs.TEST_CASES) {
        fetchTestCases(INITIAL_PAGING_VALUE, filters);
      }
    } else {
      setIsLoading(false);
    }
  }, [tab, searchValue, testCasePermission, pageSize]);

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
            {selectedFilter.includes(TEST_CASE_FILTERS.table) && (
              <Form.Item
                className="m-0 w-80"
                label={t('label.table')}
                name="tableFqn">
                <Select
                  allowClear
                  showSearch
                  data-testid="table-select-filter"
                  loading={isOptionsLoading}
                  options={tableOptions}
                  placeholder={t('label.table')}
                  onSearch={debounceFetchTableData}
                />
              </Form.Item>
            )}
            {selectedFilter.includes(TEST_CASE_FILTERS.platform) && (
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
            {selectedFilter.includes(TEST_CASE_FILTERS.type) && (
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
            {selectedFilter.includes(TEST_CASE_FILTERS.status) && (
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
            {selectedFilter.includes(TEST_CASE_FILTERS.lastRun) && (
              <Form.Item
                className="m-0"
                label={t('label.last-run')}
                name="lastRunRange"
                trigger="handleDateRangeChange"
                valuePropName="defaultDateRange">
                <DatePickerMenu showSelectedCustomRange />
              </Form.Item>
            )}
            {selectedFilter.includes(TEST_CASE_FILTERS.tags) && (
              <Form.Item
                className="m-0 w-80"
                label={t('label.tag-plural')}
                name="tags">
                <Select
                  allowClear
                  showSearch
                  data-testid="tags-select-filter"
                  loading={isOptionsLoading}
                  mode="multiple"
                  options={tagOptions}
                  placeholder={t('label.tag-plural')}
                  onSearch={debounceFetchTagOptions}
                />
              </Form.Item>
            )}
            {selectedFilter.includes(TEST_CASE_FILTERS.tier) && (
              <Form.Item
                className="m-0 w-40"
                label={t('label.tier')}
                name="tier">
                <Select
                  allowClear
                  data-testid="tier-select-filter"
                  options={tierOptions}
                  placeholder={t('label.tier')}
                />
              </Form.Item>
            )}
            {selectedFilter.includes(TEST_CASE_FILTERS.service) && (
              <Form.Item
                className="m-0 w-80"
                label={t('label.service')}
                name="serviceName">
                <Select
                  allowClear
                  showSearch
                  data-testid="service-select-filter"
                  loading={isOptionsLoading}
                  options={serviceOptions}
                  placeholder={t('label.service')}
                  onSearch={debounceFetchServiceOptions}
                />
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
