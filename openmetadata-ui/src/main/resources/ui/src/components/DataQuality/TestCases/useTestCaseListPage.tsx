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
import { FormProps, Space, Typography } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { DefaultOptionType } from 'antd/lib/select';
import { AxiosError } from 'axios';
import { debounce, entries, isEmpty, isUndefined, uniq, values } from 'lodash';
import QueryString from 'qs';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  TEST_CASE_FILTERS_LABELS,
  TEST_CASE_PLATFORM_OPTION,
  TEST_CASE_STATUS_OPTION,
  TEST_CASE_TYPE_OPTION,
} from '../../../constants/profiler.constant';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
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
import { getTestCaseFiltersValue } from '../../../utils/DataQuality/DataQualityPureUtils';
import { useEntityExportModalProvider } from '../../Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import { getEntityName } from '../../../utils/EntityNameUtils';
import {
  checkPermission,
  getPrioritizedViewPermission,
} from '../../../utils/PermissionsUtils';
import tagClassBase from '../../../utils/TagClassBase';
import { ExtraTestCaseDropdownOptions } from '../../../utils/TestCaseUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import { TestCaseSearchParams } from '../DataQuality.interface';

/** Render-agnostic control kinds a single filter can use. */
export type TestCaseFilterControl = 'select' | 'multiselect' | 'date';

/** Union of every Test Cases filter value (string, string[], date range, …). */
export type TestCaseFilterValue =
  TestCaseSearchParams[keyof TestCaseSearchParams];

export interface TestCaseFilterOptionData {
  label: string;
  value: string;
  subLabel?: string;
}

/**
 * Normalized description of a single active Test Cases filter. Renderers map
 * over these: OSS keeps its antd form, the AI bar renders untitled-ui chips.
 * Adding a filter here surfaces it in both renderers.
 */
export interface TestCaseFilterDescriptor {
  key: string;
  paramKey: keyof TestCaseSearchParams;
  label: string;
  controlType: TestCaseFilterControl;
  searchable: boolean;
  value?: TestCaseFilterValue;
  options: TestCaseFilterOptionData[];
  isLoading: boolean;
  onGetInitialOptions: () => void;
  onSearch?: (query: string) => void;
  onChange: (value?: TestCaseFilterValue) => void;
}

interface FetchedOption extends DefaultOptionType {
  /** Plain name kept alongside the rich antd JSX label for renderer reuse. */
  name?: string;
  subLabel?: string;
}

const DEFAULT_SELECTED_FILTERS = [
  TEST_CASE_FILTERS.status,
  TEST_CASE_FILTERS.type,
  TEST_CASE_FILTERS.table,
  TEST_CASE_FILTERS.tags,
];

const STATIC_OPTIONS: Record<string, DefaultOptionType[]> = {
  [TEST_CASE_FILTERS.platform]: TEST_CASE_PLATFORM_OPTION,
  [TEST_CASE_FILTERS.type]: TEST_CASE_TYPE_OPTION,
  [TEST_CASE_FILTERS.status]: TEST_CASE_STATUS_OPTION,
  [TEST_CASE_FILTERS.dimension]: TEST_CASE_DIMENSIONS_OPTION,
};

const MULTI_SELECT_FILTERS = new Set<string>([
  TEST_CASE_FILTERS.platform,
  TEST_CASE_FILTERS.tags,
]);

const SEARCHABLE_FILTERS = new Set<string>([
  TEST_CASE_FILTERS.table,
  TEST_CASE_FILTERS.tags,
  TEST_CASE_FILTERS.service,
  TEST_CASE_FILTERS.dataProduct,
]);

// TEST_CASE_FILTERS_LABELS is keyed by filter name (e.g. "table"); descriptors
// key by the param value (e.g. "tableFqn"), so map value -> label once here.
const FILTER_LABEL_BY_KEY: Record<string, string> = Object.fromEntries(
  entries(TEST_CASE_FILTERS).map(([name, value]) => [
    value,
    TEST_CASE_FILTERS_LABELS[name],
  ])
);

const getControlType = (key: string): TestCaseFilterControl => {
  let controlType: TestCaseFilterControl = 'select';
  if (key === TEST_CASE_FILTERS.lastRun) {
    controlType = 'date';
  } else if (MULTI_SELECT_FILTERS.has(key)) {
    controlType = 'multiselect';
  }

  return controlType;
};

const optionLabel = (name: string, fqn?: string, testId?: string) => (
  <Space data-testid={testId ?? fqn} direction="vertical" size={0}>
    {fqn && (
      <Typography.Text className="text-xs text-grey-muted">
        {fqn}
      </Typography.Text>
    )}
    <Typography.Text className="text-sm">{name}</Typography.Text>
  </Space>
);

export const useTestCaseListPage = () => {
  const { tab = DataQualityClassBase.getDefaultActiveTab() } = useParams<{
    tab: DataQualityPageTabs;
  }>();
  const navigate = useNavigate();
  const location = useCustomLocation();
  const { permissions } = usePermissionProvider();
  const { isTestCaseSummaryLoading, testCaseSummary } =
    useDataQualityProvider();
  const { testCase: testCasePermission, testSuite: testSuitePermission } =
    permissions;
  const { showModal } = useEntityExportModalProvider();
  const [form] = useForm();

  const params = useMemo(() => {
    const search = location.search;
    const parsed = QueryString.parse(
      search.startsWith('?') ? search.substring(1) : search
    );

    return parsed as TestCaseSearchParams;
  }, [location.search]);

  const { searchValue = '' } = params;

  const [tableOptions, setTableOptions] = useState<FetchedOption[]>([]);
  const [tagOptions, setTagOptions] = useState<FetchedOption[]>([]);
  const [tierOptions, setTierOptions] = useState<FetchedOption[]>([]);
  const [serviceOptions, setServiceOptions] = useState<FetchedOption[]>([]);
  const [dataProductOptions, setDataProductOptions] = useState<FetchedOption[]>(
    []
  );
  const [isOptionsLoading, setIsOptionsLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string[]>(
    DEFAULT_SELECTED_FILTERS
  );

  const [testCase, setTestCase] = useState<TestCase[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sortOptions, setSortOptions] =
    useState<ListTestCaseParamsBySearch>(DEFAULT_SORT_ORDER);

  const {
    currentPage,
    handlePageChange,
    pageSize,
    handlePageSizeChange,
    paging,
    handlePagingChange,
    showPagination,
  } = usePaging();

  const handleSearchParam = useCallback(
    <K extends keyof TestCaseSearchParams>(
      key: K,
      value?: TestCaseSearchParams[K]
    ) => {
      navigate({
        search: QueryString.stringify(
          { ...params, [key]: value || undefined },
          { arrayFormat: 'brackets' }
        ),
      });
    },
    [navigate, params]
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
      setTierOptions(
        data.map((hit) => ({
          label: optionLabel(getEntityName(hit), hit.fullyQualifiedName),
          name: getEntityName(hit),
          subLabel: hit.fullyQualifiedName,
          value: hit.fullyQualifiedName,
        }))
      );
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
      setTagOptions(
        data
          .filter(
            ({ data: { classification } }) =>
              classification?.name !== TIER_CATEGORY
          )
          .map(({ label, value }) => ({
            label: optionLabel(label, value, value),
            name: label,
            subLabel: value,
            value,
          }))
      );
    } catch {
      setTagOptions([]);
    } finally {
      setIsOptionsLoading(false);
    }
  };

  const fetchSearchOptions = async (
    searchIndex: SearchIndex,
    setter: (options: FetchedOption[]) => void,
    valueKey: 'name' | 'fullyQualifiedName',
    query: string
  ) => {
    setIsOptionsLoading(true);
    try {
      const response = await searchQuery({
        query,
        pageNumber: 1,
        pageSize: PAGE_SIZE_BASE,
        searchIndex,
        fetchSource: true,
        includeFields: ['name', 'fullyQualifiedName', 'displayName'],
      });
      setter(
        response.hits.hits.map((hit) => ({
          label: optionLabel(
            getEntityName(hit._source),
            hit._source.fullyQualifiedName,
            valueKey === 'name'
              ? hit._source.name
              : hit._source.fullyQualifiedName
          ),
          name: getEntityName(hit._source),
          subLabel: hit._source.fullyQualifiedName,
          value: hit._source[valueKey] ?? hit._source.name,
        }))
      );
    } catch {
      setter([]);
    } finally {
      setIsOptionsLoading(false);
    }
  };

  const fetchTableData = (search = WILD_CARD_CHAR) =>
    fetchSearchOptions(
      SearchIndex.TABLE,
      setTableOptions,
      'fullyQualifiedName',
      `*${search}*`
    );

  const fetchServiceOptions = (search = WILD_CARD_CHAR) =>
    fetchSearchOptions(
      SearchIndex.DATABASE_SERVICE,
      setServiceOptions,
      'name',
      `*${search}*`
    );

  const fetchDataProductOptions = (search = WILD_CARD_CHAR) =>
    fetchSearchOptions(
      SearchIndex.DATA_PRODUCT,
      setDataProductOptions,
      'fullyQualifiedName',
      search === WILD_CARD_CHAR ? search : `*${search}*`
    );

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
      case TEST_CASE_FILTERS.dataProduct:
        (isEmpty(dataProductOptions) || !isLengthCheck) &&
          fetchDataProductOptions();

        break;
      default:
        break;
    }
  };

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
    getInitialOptions(key);
    handleSearchParam(key as keyof TestCaseSearchParams);
  };

  const filterMenu: ItemType[] = useMemo(
    () =>
      entries(TEST_CASE_FILTERS).map(([name, filter]) => ({
        key: filter,
        label: TEST_CASE_FILTERS_LABELS[name],
        value: filter,
      })),
    []
  );

  const debounceFetchTableData = useCallback(
    debounce(fetchTableData, 1000),
    []
  );
  const debounceFetchTagOptions = useCallback(debounce(fetchTagOptions, 1000), [
    selectedFilter,
  ]);
  const debounceFetchServiceOptions = useCallback(
    debounce(fetchServiceOptions, 1000),
    []
  );
  const debounceFetchDataProductOptions = useCallback(
    debounce(fetchDataProductOptions, 1000),
    []
  );

  const asyncOptionsByKey: Record<string, FetchedOption[]> = {
    [TEST_CASE_FILTERS.table]: tableOptions,
    [TEST_CASE_FILTERS.tags]: tagOptions,
    [TEST_CASE_FILTERS.tier]: tierOptions,
    [TEST_CASE_FILTERS.service]: serviceOptions,
    [TEST_CASE_FILTERS.dataProduct]: dataProductOptions,
  };

  const onSearchByKey: Record<string, (search: string) => void> = {
    [TEST_CASE_FILTERS.table]: debounceFetchTableData,
    [TEST_CASE_FILTERS.tags]: debounceFetchTagOptions,
    [TEST_CASE_FILTERS.service]: debounceFetchServiceOptions,
    [TEST_CASE_FILTERS.dataProduct]: debounceFetchDataProductOptions,
  };

  const toPlainOptions = (
    options: DefaultOptionType[]
  ): TestCaseFilterOptionData[] =>
    options.map((option) => ({
      value: String(option.value),
      label:
        (option as FetchedOption).name ??
        (typeof option.label === 'string'
          ? option.label
          : String(option.value)),
      subLabel: (option as FetchedOption).subLabel,
    }));

  const filters = useMemo<TestCaseFilterDescriptor[]>(() => {
    const keys = entries(TEST_CASE_FILTERS)
      .map(([, filter]) => filter)
      .filter((filter) => selectedFilter.includes(filter));

    return keys.map((key) => {
      const paramKey = key;
      const options = STATIC_OPTIONS[key] ?? asyncOptionsByKey[key] ?? [];

      return {
        key,
        paramKey,
        label: FILTER_LABEL_BY_KEY[key],
        controlType: getControlType(key),
        searchable: SEARCHABLE_FILTERS.has(key),
        value: params[paramKey],
        options: toPlainOptions(options),
        isLoading: isOptionsLoading,
        onGetInitialOptions: () => getInitialOptions(key),
        onSearch: onSearchByKey[key],
        onChange: (value) => handleSearchParam(paramKey, value),
      };
    });
  }, [selectedFilter, params, isOptionsLoading, asyncOptionsByKey]);

  // True when any filter (table/type/status/tags/…) currently has a value; the
  // table-header search is intentionally excluded so it survives a clear-all.
  const hasActiveFilters = useMemo(
    () =>
      values(TEST_CASE_FILTERS).some((paramKey) => !isEmpty(params[paramKey])),
    [params]
  );

  const clearAll = useCallback(() => {
    setSelectedFilter(DEFAULT_SELECTED_FILTERS);
    form.resetFields();
    navigate({
      search: QueryString.stringify(searchValue ? { searchValue } : {}, {
        arrayFormat: 'brackets',
      }),
    });
  }, [form, navigate, searchValue]);

  const fetchTestCases = useCallback(
    async (
      page = INITIAL_PAGING_VALUE,
      activeFilters?: string[],
      apiParams?: ListTestCaseParamsBySearch
    ) => {
      const updatedParams = getTestCaseFiltersValue(
        params,
        activeFilters ?? selectedFilter
      );

      setIsLoading(true);
      try {
        const { data, paging: pagingResponse } = await getListTestCaseBySearch({
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
          offset: (page - 1) * pageSize,
        });
        setTestCase(data);
        handlePagingChange(pagingResponse);
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

  const handleTestCaseUpdate = (data?: TestCase) => {
    if (data) {
      setTestCase((prev) =>
        prev.map((test) => (test.id === data.id ? { ...test, ...data } : test))
      );
    }
  };

  const handleStatusSubmit = (updated: TestCase) => {
    setTestCase((prev) =>
      prev.map((test) =>
        test.fullyQualifiedName === updated.fullyQualifiedName ? updated : test
      )
    );
  };

  const handlePagingClick = useCallback(
    ({ currentPage: page }: PagingHandlerParams) => {
      handlePageChange(page);
      fetchTestCases(page);
    },
    [handlePageChange, fetchTestCases]
  );

  const extraDropdownContent = useMemo(
    () =>
      ExtraTestCaseDropdownOptions(
        WILD_CARD_CHAR,
        {
          ViewAll:
            checkPermission(
              Operation.ViewAll,
              ResourceEntity.TEST_CASE,
              permissions
            ) ?? false,
          EditAll:
            checkPermission(
              Operation.EditAll,
              ResourceEntity.TEST_CASE,
              permissions
            ) ?? false,
        },
        false,
        navigate,
        showModal
      ),
    [permissions, navigate, showModal]
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

  return {
    // permissions + summary
    testCasePermission,
    testSuitePermission,
    testCaseSummary,
    isTestCaseSummaryLoading,
    // filter bar (OSS antd form + AI descriptors)
    form,
    params,
    searchValue,
    selectedFilter,
    handleMenuClick,
    handleSearchParam,
    handleFilterChange,
    filterMenu,
    filters,
    hasActiveFilters,
    clearAll,
    isOptionsLoading,
    tableOptions,
    tagOptions,
    tierOptions,
    serviceOptions,
    dataProductOptions,
    debounceFetchTableData,
    debounceFetchTagOptions,
    debounceFetchServiceOptions,
    debounceFetchDataProductOptions,
    // table + paging
    testCase,
    isLoading,
    pagingData,
    showPagination,
    fetchTestCases,
    sortTestCase,
    handleTestCaseUpdate,
    handleStatusSubmit,
    extraDropdownContent,
  };
};
