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
import { Button, Col, Dropdown, Form, FormProps, Row, Space, Typography,  } from 'antd';
import { Select } from '../../common/AntdCompat';;
import { useForm } from 'antd/lib/form/Form';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { DefaultOptionType } from 'antd/lib/select';
import { AxiosError } from 'axios';
import {
  debounce,
  entries,
  isEmpty,
  isUndefined,
  startCase,
  uniq,
} from 'lodash';
import QueryString from 'qs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { WILD_CARD_CHAR } from '../../../constants/char.constants';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  TIER_CATEGORY,
} from '../../../constants/constants';
import {
  DEFAULT_SORT_ORDER,
  TEST_CASE_DIMENSIONS_OPTION,
  TEST_CASE_FILTERS,
  TEST_CASE_PLATFORM_OPTION,
  TEST_CASE_STATUS_OPTION,
  TEST_CASE_TYPE_OPTION,
} from '../../../constants/profiler.constant';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { TabSpecificField } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { Operation } from '../../../generated/entity/policies/policy';
import { TestCase } from '../../../generated/tests/testCase';
import { usePaging } from '../../../hooks/paging/usePaging';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import DataQualityClassBase from '../../../pages/DataQuality/DataQualityClassBase';
import { DataQualityPageTabs } from '../../../pages/DataQuality/DataQualityPage.interface';
import { useDataQualityProvider } from '../../../pages/DataQuality/DataQualityProvider';
import { searchQuery } from '../../../rest/searchAPI';
import { getTags } from '../../../rest/tagAPI';
import {
  getListTestCaseBySearch,
  ListTestCaseParamsBySearch,
} from '../../../rest/testAPI';
import { getTestCaseFiltersValue } from '../../../utils/DataQuality/DataQualityUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { getPopupContainer } from '../../../utils/formUtils';
import { getPrioritizedViewPermission } from '../../../utils/PermissionsUtils';
import { getDataQualityPagePath } from '../../../utils/RouterUtils';
import tagClassBase from '../../../utils/TagClassBase';
import { showErrorToast } from '../../../utils/ToastUtils';
import DatePickerMenu from '../../common/DatePickerMenu/DatePickerMenu.component';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import Searchbar from '../../common/SearchBarComponent/SearchBar.component';
import DataQualityTab from '../../Database/Profiler/DataQualityTab/DataQualityTab';
import PageHeader from '../../PageHeader/PageHeader.component';
import { TestCaseSearchParams } from '../DataQuality.interface';
import PieChartSummaryPanel from '../SummaryPannel/PieChartSummaryPanel.component';

export const TestCases = () => {
  const [form] = useForm();
  const { tab = DataQualityClassBase.getDefaultActiveTab() } =
    useParams<{ tab: DataQualityPageTabs }>();
  const navigate = useNavigate();
  const location = useCustomLocation();
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const { isTestCaseSummaryLoading, testCaseSummary } =
    useDataQualityProvider();
  const { testCase: testCasePermission } = permissions;
  const [tableOptions, setTableOptions] = useState<DefaultOptionType[]>([]);
  const [isOptionsLoading, setIsOptionsLoading] = useState(false);
  const [tagOptions, setTagOptions] = useState<DefaultOptionType[]>([]);
  const [tierOptions, setTierOptions] = useState<DefaultOptionType[]>([]);
  const [serviceOptions, setServiceOptions] = useState<DefaultOptionType[]>([]);
  const [sortOptions, setSortOptions] =
    useState<ListTestCaseParamsBySearch>(DEFAULT_SORT_ORDER);

  const params = useMemo(() => {
    const search = location.search;

    const params = QueryString.parse(
      search.startsWith('?') ? search.substring(1) : search
    );

    return params as TestCaseSearchParams;
  }, [location.search]);

  const { searchValue = '' } = params;
  const [testCase, setTestCase] = useState<TestCase[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedFilter, setSelectedFilter] = useState<string[]>([
    TEST_CASE_FILTERS.status,
    TEST_CASE_FILTERS.type,
    TEST_CASE_FILTERS.table,
    TEST_CASE_FILTERS.tags,
  ]);

  const {
    currentPage,
    handlePageChange,
    pageSize,
    handlePageSizeChange,
    paging,
    handlePagingChange,
    showPagination,
  } = usePaging();

  const handleSearchParam = <K extends keyof TestCaseSearchParams>(
    key: K,
    value?: TestCaseSearchParams[K]
  ) => {
    navigate({
      search: QueryString.stringify(
        { ...params, [key]: value || undefined },
        {
          arrayFormat: 'brackets',
        }
      ),
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

  const fetchTestCases = useCallback(
    async (
      currentPage = INITIAL_PAGING_VALUE,
      filters?: string[],
      apiParams?: ListTestCaseParamsBySearch
    ) => {
      const updatedParams = getTestCaseFiltersValue(
        params,
        filters ?? selectedFilter
      );

      setIsLoading(true);
      try {
        const { data, paging } = await getListTestCaseBySearch({
          ...updatedParams,
          ...sortOptions,
          ...apiParams,
          testCaseStatus: isEmpty(params?.testCaseStatus)
            ? undefined
            : params?.testCaseStatus,
          limit: pageSize,
          includeAllTests: true,
          fields: [
            TabSpecificField.TEST_CASE_RESULT,
            TabSpecificField.TESTSUITE,
            TabSpecificField.INCIDENT_ID,
          ],
          q: searchValue ? `*${searchValue}*` : undefined,
          offset: (currentPage - 1) * pageSize,
        });
        setTestCase(data);
        handlePagingChange(paging);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [
      params,
      selectedFilter,
      sortOptions,
      pageSize,
      searchValue,
      handlePagingChange,
    ]
  );

  const sortTestCase = async (apiParams?: TestCaseSearchParams) => {
    const updatedValue = uniq([...selectedFilter, ...Object.keys(params)]);
    await fetchTestCases(
      INITIAL_PAGING_VALUE,
      updatedValue,
      apiParams ?? DEFAULT_SORT_ORDER
    );
    setSortOptions(apiParams ?? DEFAULT_SORT_ORDER);
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

  const handlePagingClick = useCallback(
    ({ currentPage }: PagingHandlerParams) => {
      handlePageChange(currentPage);
      fetchTestCases(currentPage);
    },
    [handlePageChange, fetchTestCases]
  );

  const handleFilterChange: FormProps<TestCaseSearchParams>['onValuesChange'] =
    (value?: TestCaseSearchParams) => {
      if (!isUndefined(value)) {
        const [data] = Object.entries(value);
        handleSearchParam(data[0] as keyof TestCaseSearchParams, data[1]);
      }
    };

  const fetchTierOptions = async () => {
    try {
      setIsOptionsLoading(true);
      const { data } = await getTags({
        parent: 'Tier',
        limit: PAGE_SIZE_LARGE,
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
    } catch {
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
    } catch {
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
    } catch {
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
    } catch {
      setServiceOptions([]);
    } finally {
      setIsOptionsLoading(false);
    }
  };

  const getInitialOptions = (key: string, isLengthCheck = false) => {
    switch (key) {
      case TEST_CASE_FILTERS.tier:
        (isEmpty(tierOptions) || !isLengthCheck) && fetchTierOptions();

        break;
      case TEST_CASE_FILTERS.table:
        (isEmpty(tableOptions) || !isLengthCheck) && fetchTableData();

        break;
      case TEST_CASE_FILTERS.tags:
        (isEmpty(tagOptions) || !isLengthCheck) && fetchTagOptions();

        break;
      case TEST_CASE_FILTERS.service:
        (isEmpty(serviceOptions) || !isLengthCheck) && fetchServiceOptions();

        break;

      default:
        break;
    }
  };

  const dqTableHeader = useMemo(() => {
    return (
      <Row gutter={[16, 16]}>
        <Col span={16}>
          <PageHeader
            data={{
              header: t('label.test-case-insight-plural'),
              subHeader: t('message.test-case-insight-description'),
            }}
          />
        </Col>
        <Col span={8}>
          <Searchbar
            removeMargin
            placeholder={t('label.search-entity', {
              entity: t('label.test-case-lowercase'),
            })}
            searchValue={searchValue}
            onSearch={(value) => handleSearchParam('searchValue', value)}
          />
        </Col>
      </Row>
    );
  }, [searchValue, handleSearchParam]);

  const handleMenuClick = ({ key }: { key: string }) => {
    setSelectedFilter((prevSelected) => {
      if (prevSelected.includes(key)) {
        const updatedValue = prevSelected.filter(
          (selected) => selected !== key
        );
        form.setFieldsValue({ [key]: undefined });

        return updatedValue;
      }

      return uniq([...prevSelected, key]);
    });
    // Fetch options based on the selected filter
    getInitialOptions(key);
    handleSearchParam(key as keyof TestCaseSearchParams, undefined);
  };

  const filterMenu: ItemType[] = useMemo(() => {
    return entries(TEST_CASE_FILTERS).map(([name, filter]) => ({
      key: filter,
      label: startCase(name),
      value: filter,
    }));
  }, []);

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

  const getTestCases = () => {
    if (!isEmpty(params) || !isEmpty(selectedFilter)) {
      const updatedValue = uniq([...selectedFilter, ...Object.keys(params)]);
      for (const key of updatedValue) {
        getInitialOptions(key, true);
      }
      setSelectedFilter(updatedValue);
      fetchTestCases(currentPage, updatedValue);
      form.setFieldsValue(params);
    } else {
      fetchTestCases(currentPage);
    }
  };

  useEffect(() => {
    if (
      getPrioritizedViewPermission(testCasePermission, Operation.ViewBasic) &&
      tab === DataQualityPageTabs.TEST_CASES
    ) {
      getTestCases();
    } else {
      setIsLoading(false);
    }
  }, [tab, testCasePermission, pageSize, params, currentPage]);

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
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.test-case'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <Row data-testid="test-case-container" gutter={[16, 16]}>
      <Col span={24}>
        <Form<TestCaseSearchParams>
          className="new-form-style"
          form={form}
          layout="horizontal"
          onValuesChange={handleFilterChange}>
          <Space wrap align="center" className="w-full" size={16}>
            <Form.Item noStyle name="selectedFilters">
              <Dropdown
                menu={{
                  items: filterMenu,
                  selectedKeys: selectedFilter,
                  onClick: handleMenuClick,
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
                  getPopupContainer={getPopupContainer}
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
                  getPopupContainer={getPopupContainer}
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
                  getPopupContainer={getPopupContainer}
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
                  getPopupContainer={getPopupContainer}
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
                <DatePickerMenu showSelectedCustomRange size="small" />
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
                  getPopupContainer={getPopupContainer}
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
                  showSearch
                  data-testid="tier-select-filter"
                  getPopupContainer={getPopupContainer}
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
                  getPopupContainer={getPopupContainer}
                  loading={isOptionsLoading}
                  options={serviceOptions}
                  placeholder={t('label.service')}
                  onSearch={debounceFetchServiceOptions}
                />
              </Form.Item>
            )}
            {selectedFilter.includes(TEST_CASE_FILTERS.dimension) && (
              <Form.Item
                className="m-0 w-80"
                label={t('label.dimension')}
                name="dataQualityDimension">
                <Select
                  allowClear
                  showSearch
                  data-testid="dimension-select-filter"
                  getPopupContainer={getPopupContainer}
                  options={TEST_CASE_DIMENSIONS_OPTION}
                  placeholder={t('label.dimension')}
                />
              </Form.Item>
            )}
          </Space>
        </Form>
      </Col>
      <Col span={24}>
        <PieChartSummaryPanel
          isLoading={isTestCaseSummaryLoading}
          testSummary={testCaseSummary}
        />
      </Col>
      <Col span={24}>
        <DataQualityTab
          afterDeleteAction={fetchTestCases}
          breadcrumbData={[
            {
              name: t('label.data-quality'),
              url: getDataQualityPagePath(DataQualityPageTabs.TEST_CASES),
            },
          ]}
          fetchTestCases={sortTestCase}
          isLoading={isLoading}
          pagingData={pagingData}
          showPagination={showPagination}
          tableHeader={dqTableHeader}
          testCases={testCase}
          onTestCaseResultUpdate={handleStatusSubmit}
          onTestUpdate={handleTestCaseUpdate}
        />
      </Col>
    </Row>
  );
};
