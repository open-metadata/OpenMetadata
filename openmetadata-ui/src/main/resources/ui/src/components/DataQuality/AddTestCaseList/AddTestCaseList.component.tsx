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
import {
  Button,
  Checkbox,
  Col,
  Divider,
  List,
  Row,
  Space,
  Typography,
} from 'antd';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import { debounce } from 'lodash';
import isEmpty from 'lodash/isEmpty';
import VirtualList from 'rc-virtual-list';
import {
  UIEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { WILD_CARD_CHAR } from '../../../constants/char.constants';
import { PAGE_SIZE_BASE, PAGE_SIZE_MEDIUM } from '../../../constants/constants';
import {
  TEST_CASE_STATUS_FILTER_OPTIONS,
  TEST_CASE_STATUS_LABELS,
  TEST_CASE_TYPE_OPTION,
} from '../../../constants/profiler.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { TestCaseType } from '../../../enums/TestSuite.enum';
import { TestCase, TestCaseStatus } from '../../../generated/tests/testCase';
import { getAggregateFieldOptions } from '../../../rest/miscAPI';
import { searchQuery } from '../../../rest/searchAPI';
import { getListTestCaseBySearch } from '../../../rest/testAPI';
import { getNameFromFQN } from '../../../utils/CommonUtils';
import {
  COLUMN_AGGREGATE_FIELD,
  getColumnNameFromColumnFilterKey,
  getSelectedOptionsFromKeys,
  parseColumnAggregateBuckets,
} from '../../../utils/DataQuality/DataQualityUtils';
import {
  getColumnNameFromEntityLink,
  getEntityName,
} from '../../../utils/EntityUtils';
import { getEntityFQN } from '../../../utils/FeedUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { replacePlus } from '../../../utils/StringsUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import Searchbar from '../../common/SearchBarComponent/SearchBar.component';
import { SearchDropdownOption } from '../../SearchDropdown/SearchDropdown.interface';
import { AddTestCaseModalProps } from './AddTestCaseList.interface';
import AddTestCaseListFilters from './AddTestCaseListFilters.component';
import { AddTestCaseListFilterKey } from './AddTestCaseListFilters.constants';
import { normalizeSelectedTestProp } from './AddTestCaseListForm.utils';

export const AddTestCaseList = ({
  onCancel,
  onSubmit,
  cancelText,
  submitText,
  testCaseFilters,
  columnFilters,
  selectedTest,
  onChange,
  showButton = true,
  testCaseParams,
  hideTableFilter = false,
  getPopupContainer,
}: AddTestCaseModalProps) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState<string>();
  const [items, setItems] = useState<TestCase[]>([]);
  const [selectedItems, setSelectedItems] = useState<Map<string, TestCase>>(
    () => new Map()
  );
  const [selectAll, setSelectAll] = useState(false);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(() => new Set());
  const [pageNumber, setPageNumber] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<
    TestCaseStatus | undefined
  >();
  const [filterTestType, setFilterTestType] = useState<TestCaseType>(
    TestCaseType.all
  );
  const [filterTables, setFilterTables] = useState<string[]>([]);
  const [filterColumns, setFilterColumns] = useState<string[]>([]);
  const [tableOptionsFromApi, setTableOptionsFromApi] = useState<
    SearchDropdownOption[]
  >([]);
  const [isTableOptionsLoading, setIsTableOptionsLoading] = useState(false);
  const [columnOptionsFromApi, setColumnOptionsFromApi] = useState<
    SearchDropdownOption[]
  >([]);
  const [isColumnOptionsLoading, setIsColumnOptionsLoading] = useState(false);
  const isInitialSearchFilterLoad = useRef(true);

  const statusOptions = useMemo<SearchDropdownOption[]>(
    () =>
      TEST_CASE_STATUS_FILTER_OPTIONS.map((o) => ({
        key: o.value,
        label: o.label,
      })),
    []
  );

  const testTypeOptions = useMemo<SearchDropdownOption[]>(
    () =>
      TEST_CASE_TYPE_OPTION.map((o) => ({
        key: o.value,
        label: o.label,
      })),
    []
  );

  const statusSelectedKeys = useMemo<SearchDropdownOption[]>(
    () =>
      filterStatus == null
        ? []
        : [{ key: filterStatus, label: TEST_CASE_STATUS_LABELS[filterStatus] }],
    [filterStatus]
  );

  const testTypeSelectedKeys = useMemo<SearchDropdownOption[]>(
    () =>
      filterTestType === TestCaseType.all
        ? []
        : [
            {
              key: filterTestType,
              label:
                TEST_CASE_TYPE_OPTION.find((o) => o.value === filterTestType)
                  ?.label ?? '',
            },
          ],
    [filterTestType]
  );

  const tableSelectedKeys = useMemo(
    () =>
      getSelectedOptionsFromKeys(
        filterTables,
        tableOptionsFromApi,
        getNameFromFQN
      ),
    [filterTables, tableOptionsFromApi]
  );

  const columnSelectedKeys = useMemo(
    () =>
      getSelectedOptionsFromKeys(
        filterColumns,
        columnOptionsFromApi,
        (key) => key.split('::').pop() ?? '--'
      ),
    [filterColumns, columnOptionsFromApi]
  );

  const selectedTestNames = useMemo(
    () => normalizeSelectedTestProp(selectedTest),
    [selectedTest]
  );

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const fetchTableData = useCallback(async (search = WILD_CARD_CHAR) => {
    setIsTableOptionsLoading(true);
    try {
      const response = await searchQuery({
        query: `*${search}*`,
        pageNumber: 1,
        pageSize: PAGE_SIZE_BASE,
        searchIndex: SearchIndex.TABLE,
        fetchSource: true,
        includeFields: ['name', 'fullyQualifiedName', 'displayName'],
      });

      const options: SearchDropdownOption[] = response.hits.hits.map((hit) => ({
        key: hit._source.fullyQualifiedName ?? '',
        label: getEntityName(hit._source),
      }));
      setTableOptionsFromApi(options);
    } catch {
      setTableOptionsFromApi([]);
    } finally {
      setIsTableOptionsLoading(false);
    }
  }, []);

  const debounceFetchTableData = useCallback(
    debounce((search: string) => fetchTableData(search), 1000),
    [fetchTableData]
  );

  const fetchColumnOptions = useCallback(
    async (search?: string) => {
      setIsColumnOptionsLoading(true);
      try {
        const response = await getAggregateFieldOptions(
          SearchIndex.DATA_ASSET,
          COLUMN_AGGREGATE_FIELD,
          search ?? '',
          columnFilters ?? '',
          undefined,
          false
        );
        const buckets =
          response.data?.aggregations?.[`sterms#${COLUMN_AGGREGATE_FIELD}`]
            ?.buckets ?? [];
        const options = parseColumnAggregateBuckets(
          buckets as { key: string }[]
        );
        setColumnOptionsFromApi(options);
      } catch {
        setColumnOptionsFromApi([]);
      } finally {
        setIsColumnOptionsLoading(false);
      }
    },
    [columnFilters]
  );

  const debounceFetchColumnData = useCallback(
    debounce((search: string) => fetchColumnOptions(search), 500),
    [fetchColumnOptions]
  );

  useEffect(() => {
    return () => {
      debounceFetchTableData.cancel();
      debounceFetchColumnData.cancel();
    };
  }, [debounceFetchTableData, debounceFetchColumnData]);

  const fetchTestCases = useCallback(
    async ({
      searchText,
      page = 1,
      hydrateSelectedFromProp = true,
    }: {
      searchText?: string;
      page?: number;
      hydrateSelectedFromProp?: boolean;
    }) => {
      try {
        setIsLoading(true);
        const globalSearch = searchText ? `*${searchText}*` : WILD_CARD_CHAR;
        const q = testCaseFilters
          ? `${globalSearch} && ${testCaseFilters}`
          : globalSearch;

        const columnNamesFromKeys =
          filterColumns.length > 0
            ? (filterColumns
                .map((k) => getColumnNameFromColumnFilterKey(k))
                .filter(Boolean) as string[])
            : [];
        const columnName =
          columnNamesFromKeys.length > 0 ? columnNamesFromKeys[0] : undefined;
        const filterTable = filterTables[0];
        const entityLink = filterTable
          ? `<#E::table::${filterTable}>`
          : undefined;

        const requestParams = {
          q,
          limit: PAGE_SIZE_MEDIUM,
          offset: (page - 1) * PAGE_SIZE_MEDIUM,
          testCaseStatus: filterStatus,
          testCaseType:
            filterTestType === TestCaseType.all ? undefined : filterTestType,
          ...(entityLink && { entityLink }),
          ...(columnName && { columnName }),
        };
        const mergedParams = { ...testCaseParams, ...requestParams };

        const testCaseResponse = await getListTestCaseBySearch(mergedParams);

        setTotalCount(testCaseResponse.paging.total ?? 0);
        if (selectedTestNames.length > 0 && hydrateSelectedFromProp) {
          setSelectedItems((pre) => {
            const selectedItemsMap = new Map();
            pre?.forEach((item) => selectedItemsMap.set(item.id, item));
            testCaseResponse.data.forEach((hit) => {
              if (selectedTestNames.includes(hit.name)) {
                selectedItemsMap.set(hit.id ?? '', hit);
              }
            });

            return selectedItemsMap;
          });
        }
        setItems(
          page === 1
            ? testCaseResponse.data
            : (prevItems) => [...prevItems, ...testCaseResponse.data]
        );
        setPageNumber(page);
      } finally {
        setIsLoading(false);
      }
    },
    [
      testCaseFilters,
      selectedTestNames,
      testCaseParams,
      filterStatus,
      filterTestType,
      filterTables,
      filterColumns,
    ]
  );

  const buildSubmitPayload = useCallback((): {
    selectAll: boolean;
    includeIds: string[];
    excludeIds: string[];
    testCases: TestCase[];
  } => {
    if (selectAll) {
      return {
        selectAll: true,
        includeIds: [],
        excludeIds: [...excludedIds],
        testCases: [],
      };
    }
    const cases = [...(selectedItems?.values() ?? [])];

    return {
      selectAll: false,
      includeIds: cases.map((c) => c.id ?? '').filter(Boolean),
      excludeIds: [],
      testCases: cases,
    };
  }, [selectAll, excludedIds, selectedItems]);

  const handleSubmit = async () => {
    setIsLoading(true);
    const {
      selectAll: sa,
      includeIds,
      excludeIds: excl,
    } = buildSubmitPayload();
    await onSubmit?.({ selectAll: sa, includeIds, excludeIds: excl });
    setIsLoading(false);
  };

  const onScroll: UIEventHandler<HTMLElement> = useCallback(
    (e) => {
      if (
        e.currentTarget.scrollHeight - e.currentTarget.scrollTop === 500 &&
        items.length < totalCount
      ) {
        !isLoading &&
          fetchTestCases({
            searchText: searchTerm,
            page: pageNumber + 1,
          });
      }
    },
    [searchTerm, totalCount, items, isLoading, fetchTestCases, pageNumber]
  );

  const emitPartialSelection = useCallback(
    (map: Map<string, TestCase>) => {
      const testCases = [...map.values()];
      onChange?.({
        selectAll: false,
        includeIds: testCases.map((c) => c.id ?? '').filter(Boolean),
        excludeIds: [],
        testCases,
      });
    },
    [onChange]
  );

  const emitFullSelection = useCallback(
    (excluded: Set<string>) => {
      onChange?.({
        selectAll: true,
        includeIds: [],
        excludeIds: [...excluded],
        testCases: [],
      });
    },
    [onChange]
  );

  const loadedItemIds = useMemo(
    () => items.map((i) => i.id).filter(Boolean) as string[],
    [items]
  );

  const isLoadedRowSelected = useCallback(
    (id: string) => (selectAll ? !excludedIds.has(id) : selectedItems.has(id)),
    [selectAll, excludedIds, selectedItems]
  );

  const loadedSelectedCount = useMemo(
    () => items.filter((i) => i.id && isLoadedRowSelected(i.id)).length,
    [items, isLoadedRowSelected]
  );

  const allLoadedSelected =
    loadedItemIds.length > 0 &&
    loadedItemIds.every((id) => isLoadedRowSelected(id));

  const showSelectAllTotalLink =
    !selectAll &&
    totalCount > items.length &&
    allLoadedSelected &&
    items.length > 0;

  const handlePageSelectAllCheckbox = useCallback(
    (e: CheckboxChangeEvent) => {
      const checked = e.target.checked;
      if (items.length === 0) {
        return;
      }
      if (checked) {
        if (selectAll) {
          const next = new Set(excludedIds);
          loadedItemIds.forEach((id) => next.delete(id));
          setExcludedIds(next);
          emitFullSelection(next);
        } else {
          const next = new Map(selectedItems);
          items.forEach((t) => {
            if (t.id) {
              next.set(t.id, t);
            }
          });
          setSelectedItems(next);
          emitPartialSelection(next);
        }
      } else if (selectAll) {
        // Unchecking after global "select all N test cases" should reset
        // back to local mode with no selected rows.
        const empty = new Map<string, TestCase>();
        setSelectAll(false);
        setExcludedIds(new Set());
        setSelectedItems(empty);
        emitPartialSelection(empty);
      } else {
        const next = new Map(selectedItems);
        loadedItemIds.forEach((id) => next.delete(id));
        setSelectedItems(next);
        emitPartialSelection(next);
      }
    },
    [
      items,
      selectAll,
      excludedIds,
      selectedItems,
      loadedItemIds,
      emitPartialSelection,
      emitFullSelection,
    ]
  );

  const handleSelectAllMatchingTotal = useCallback(() => {
    setSelectAll(true);
    setExcludedIds(new Set());
    setSelectedItems(new Map());
    emitFullSelection(new Set());
  }, [emitFullSelection]);

  const handleCardClick = useCallback(
    (details: TestCase) => {
      const id = details.id;
      if (!id) {
        return;
      }
      if (selectAll) {
        const nextExcluded = new Set(excludedIds);
        if (nextExcluded.has(id)) {
          nextExcluded.delete(id);
        } else {
          nextExcluded.add(id);
        }
        setExcludedIds(nextExcluded);
        onChange?.({
          selectAll: true,
          includeIds: [],
          excludeIds: [...nextExcluded],
          testCases: [],
        });
      } else if (selectedItems.has(id)) {
        const selectedItemMap = new Map<string, TestCase>();
        selectedItems.forEach(
          (item) => item.id !== id && selectedItemMap.set(item.id ?? '', item)
        );
        setSelectedItems(selectedItemMap);
        const testCases = [...selectedItemMap.values()];
        onChange?.({
          selectAll: false,
          includeIds: testCases.map((c) => c.id ?? '').filter(Boolean),
          excludeIds: [],
          testCases,
        });
      } else {
        const test = items.find((t) => t.id === id);
        if (!test) {
          return;
        }
        const selectedItemMap = new Map(selectedItems);
        selectedItemMap.set(id, test);
        setSelectedItems(selectedItemMap);
        const testCases = [...selectedItemMap.values()];
        onChange?.({
          selectAll: false,
          includeIds: testCases.map((c) => c.id ?? '').filter(Boolean),
          excludeIds: [],
          testCases,
        });
      }
    },
    [selectAll, selectedItems, items, excludedIds, onChange]
  );

  // Search/filter changes: reset effect runs first, then fetch. Both depend only on
  // testCaseListFetchCriteriaKey so fetchTestCases/onChange identity changes do not retrigger.
  useEffect(() => {
    if (!isInitialSearchFilterLoad.current) {
      setSelectAll(false);
      setExcludedIds(new Set());
      setSelectedItems(new Map());
      onChange?.({
        selectAll: false,
        includeIds: [],
        excludeIds: [],
        testCases: [],
      });
    }
  }, [
    searchTerm,
    filterStatus,
    filterTestType,
    filterTables,
    filterColumns,
    testCaseFilters,
    testCaseParams,
  ]);

  useEffect(() => {
    fetchTestCases({
      searchText: searchTerm,
      hydrateSelectedFromProp: isInitialSearchFilterLoad.current,
    });
    isInitialSearchFilterLoad.current = false;
  }, [
    searchTerm,
    filterStatus,
    filterTestType,
    filterTables,
    filterColumns,
    testCaseFilters,
    testCaseParams,
  ]);

  useEffect(() => {
    fetchTableData();
  }, [fetchTableData]);

  useEffect(() => {
    fetchColumnOptions();
  }, [fetchColumnOptions]);

  const handleFilterSearch = useCallback(
    (searchText: string, searchKey: AddTestCaseListFilterKey) => {
      if (searchKey === AddTestCaseListFilterKey.Table) {
        debounceFetchTableData(searchText);
      } else if (searchKey === AddTestCaseListFilterKey.Column) {
        debounceFetchColumnData(searchText);
      }
    },
    [debounceFetchTableData, debounceFetchColumnData, fetchColumnOptions]
  );

  const listSource = items;

  const renderList = useMemo(() => {
    const source = listSource;
    if (!isLoading && isEmpty(source)) {
      return (
        <Col span={24}>
          <Space
            align="center"
            className="w-full"
            direction="vertical"
            prefixCls="w-full">
            <ErrorPlaceHolder
              className="mt-0-important p-b-sm"
              type={ERROR_PLACEHOLDER_TYPE.FILTER}
            />
          </Space>
        </Col>
      );
    } else {
      return (
        <Col span={24}>
          <List
            loading={{
              spinning: isLoading,
              indicator: <Loader />,
            }}>
            <VirtualList
              data={listSource}
              height={500}
              itemKey="id"
              onScroll={onScroll}>
              {(test) => {
                const tableFqn = getEntityFQN(test.entityLink);
                const tableName = getNameFromFQN(tableFqn);
                const isColumn = test.entityLink.includes('::columns::');

                return (
                  <Space
                    className="m-b-md border rounded-4 p-sm cursor-pointer bg-white"
                    direction="vertical"
                    onClick={() => handleCardClick(test)}>
                    <Space className="justify-between w-full">
                      <Typography.Paragraph
                        className="m-0 font-medium text-base w-max-500"
                        data-testid={test.name}
                        ellipsis={{ tooltip: true }}>
                        {getEntityName(test)}
                      </Typography.Paragraph>

                      <Checkbox
                        checked={
                          selectAll
                            ? !excludedIds.has(test.id ?? '')
                            : selectedItems?.has(test.id ?? '')
                        }
                        data-testid={`checkbox-${test.name}`}
                      />
                    </Space>
                    <Typography.Paragraph
                      className="m-0 w-max-500"
                      ellipsis={{ tooltip: true }}>
                      {getEntityName(test.testDefinition)}
                    </Typography.Paragraph>
                    <Typography.Paragraph className="m-0">
                      <Link
                        data-testid="table-link"
                        to={getEntityDetailsPath(
                          EntityType.TABLE,
                          tableFqn,
                          EntityTabs.PROFILER
                        )}
                        onClick={(e) => e.stopPropagation()}>
                        {tableName}
                      </Link>
                    </Typography.Paragraph>
                    {isColumn && (
                      <Space>
                        <Typography.Text className="font-medium text-xs">{`${t(
                          'label.column'
                        )}:`}</Typography.Text>
                        <Typography.Text className="text-grey-muted text-xs">
                          {replacePlus(
                            getColumnNameFromEntityLink(test.entityLink)
                          ) ?? '--'}
                        </Typography.Text>
                      </Space>
                    )}
                  </Space>
                );
              }}
            </VirtualList>
          </List>
        </Col>
      );
    }
  }, [
    items,
    listSource,
    selectedItems,
    selectAll,
    excludedIds,
    isLoading,
    onScroll,
    handleCardClick,
    t,
  ]);

  const handleFilterChange = useCallback(
    (values: SearchDropdownOption[], searchKey: AddTestCaseListFilterKey) => {
      switch (searchKey) {
        case AddTestCaseListFilterKey.Status: {
          setFilterStatus(values[0]?.key as TestCaseStatus | undefined);

          break;
        }
        case AddTestCaseListFilterKey.TestType: {
          setFilterTestType(
            (values[0]?.key ?? TestCaseType.all) as TestCaseType
          );

          break;
        }
        case AddTestCaseListFilterKey.Table: {
          setFilterTables(values.length > 0 ? [values[0].key] : []);

          break;
        }
        case AddTestCaseListFilterKey.Column: {
          setFilterColumns(values.length > 0 ? [values[0].key] : []);

          break;
        }
      }
    },
    []
  );

  const filterOptions = useMemo(
    () => ({
      status: statusOptions,
      testType: testTypeOptions,
      table: tableOptionsFromApi,
      column: columnOptionsFromApi,
    }),
    [statusOptions, testTypeOptions, tableOptionsFromApi, columnOptionsFromApi]
  );

  const filterLoading = useMemo(
    () => ({
      table: isTableOptionsLoading,
      column: isColumnOptionsLoading,
    }),
    [isTableOptionsLoading, isColumnOptionsLoading]
  );

  const filterSelectedKeys = useMemo(
    () => ({
      status: statusSelectedKeys,
      testType: testTypeSelectedKeys,
      table: tableSelectedKeys,
      column: columnSelectedKeys,
    }),
    [
      statusSelectedKeys,
      testTypeSelectedKeys,
      tableSelectedKeys,
      columnSelectedKeys,
    ]
  );

  return (
    <Row gutter={[0, 8]}>
      <Col span={24}>
        <Searchbar
          removeMargin
          showClearSearch
          showLoadingStatus
          placeholder={t('label.search-entity', {
            entity: t('label.test-case-plural'),
          })}
          searchValue={searchTerm}
          onSearch={handleSearch}
        />
      </Col>
      <Col span={24}>
        <AddTestCaseListFilters
          filterLoading={filterLoading}
          filterOptions={filterOptions}
          filterSelectedKeys={filterSelectedKeys}
          getPopupContainer={getPopupContainer}
          hideTableFilter={hideTableFilter}
          onChange={handleFilterChange}
          onSearch={handleFilterSearch}
        />
      </Col>
      {items.length > 0 && (
        <Col className="m-b-xs" span={24}>
          <Divider className="m-b-sm m-t-0" />
          <Space wrap align="center" className="w-full">
            <Checkbox
              checked={allLoadedSelected}
              data-testid="select-all-test-cases"
              onChange={handlePageSelectAllCheckbox}
            />
            <Typography.Text>
              {loadedSelectedCount > 0 || selectAll
                ? t('label.n-selected', {
                    count: selectAll
                      ? Math.max(totalCount - excludedIds.size, 0)
                      : loadedSelectedCount,
                  })
                : `${t('label.select-all')} (${items.length})`}
            </Typography.Text>
            {showSelectAllTotalLink && (
              <>
                <Typography.Text className="text-grey-muted" type="secondary">
                  |
                </Typography.Text>
                <Button
                  className="h-auto p-0 font-normal"
                  data-testid="select-all-total-test-cases"
                  type="link"
                  onClick={handleSelectAllMatchingTotal}>
                  {t('label.select-all-count-test-cases', {
                    count: totalCount,
                  })}
                </Button>
              </>
            )}
          </Space>
        </Col>
      )}
      {renderList}
      {showButton && (
        <Col className="d-flex justify-end items-center p-y-sm gap-4" span={24}>
          <Button data-testid="cancel" type="link" onClick={onCancel}>
            {cancelText ?? t('label.cancel')}
          </Button>
          <Button
            data-testid="submit"
            loading={isLoading}
            type="primary"
            onClick={handleSubmit}>
            {submitText ?? t('label.create')}
          </Button>
        </Col>
      )}
    </Row>
  );
};
