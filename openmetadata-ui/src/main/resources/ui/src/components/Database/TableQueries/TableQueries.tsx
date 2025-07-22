/*
 *  Copyright 2022 Collate.
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
  CloseCircleOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
} from '@ant-design/icons';
import { Button, Col, DatePicker, Row, Space, Tooltip, Typography } from 'antd';
import { RangePickerProps } from 'antd/lib/date-picker';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isEmpty, isUndefined, uniqBy } from 'lodash';
import Qs from 'qs';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { WILD_CARD_CHAR } from '../../../constants/char.constants';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_BASE,
} from '../../../constants/constants';
import { USAGE_DOCS } from '../../../constants/docs.constants';
import { NO_PERMISSION_FOR_ACTION } from '../../../constants/HelperTextUtil';
import {
  QUERY_PAGE_DEFAULT_FILTER,
  QUERY_PAGE_ERROR_STATE,
  QUERY_PAGE_LOADING_STATE,
  QUERY_SORT_OPTIONS,
} from '../../../constants/Query.constant';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE, SORT_ORDER } from '../../../enums/common.enum';
import { TabSpecificField } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { Query } from '../../../generated/entity/data/query';
import { usePaging } from '../../../hooks/paging/usePaging';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { useFqn } from '../../../hooks/useFqn';
import {
  getQueryById,
  patchQueries,
  updateQueryVote,
} from '../../../rest/queryAPI';
import { searchQuery } from '../../../rest/searchAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import {
  createQueryFilter,
  fetchFilterOptions,
  parseSearchParams,
  stringifySearchParams,
} from '../../../utils/Query/QueryUtils';
import { getAddQueryPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import ResizablePanels from '../../common/ResizablePanels/ResizablePanels';
import SortingDropDown from '../../Explore/SortingDropDown';
import PaginationComponent from '../../PaginationComponent/PaginationComponent';
import SearchDropdown from '../../SearchDropdown/SearchDropdown';
import { SearchDropdownOption } from '../../SearchDropdown/SearchDropdown.interface';
import QueryCard from './QueryCard';
import {
  FetchFilteredQueriesType,
  QueryFilterType,
  QueryVote,
  TableQueriesProp,
} from './TableQueries.interface';
import TableQueryRightPanel from './TableQueryRightPanel/TableQueryRightPanel.component';

const TableQueries: FC<TableQueriesProp> = ({
  isTableDeleted,
  tableId,
}: TableQueriesProp) => {
  const { t } = useTranslation();
  const location = useCustomLocation();
  const { fqn: datasetFQN } = useFqn();
  const history = useHistory();

  const searchParams = useMemo(() => {
    const searchData = parseSearchParams(location.search);

    return searchData;
  }, [location]);
  const [tableQueries, setTableQueries] = useState<Query[]>([]);
  const [isLoading, setIsLoading] = useState(QUERY_PAGE_LOADING_STATE);
  const [isError, setIsError] = useState(QUERY_PAGE_ERROR_STATE);
  const [selectedQuery, setSelectedQuery] = useState<Query>();
  const [queryPermissions, setQueryPermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );
  const [tagsFilter, setTagsFilter] = useState<QueryFilterType>(
    QUERY_PAGE_DEFAULT_FILTER
  );
  const [ownerFilter, setOwnerFilter] = useState<QueryFilterType>(
    QUERY_PAGE_DEFAULT_FILTER
  );
  const [isTagsLoading, setIsTagsLoading] = useState(false);
  const [isOwnerLoading, setIsOwnerLoading] = useState(false);
  const [isClickedCalendar, setIsClickedCalendar] = useState(false);
  const [queryDateFilter, setQueryDateFilter] =
    useState<{ startTs: number; endTs: number }>();
  const [sortQuery, setSortQuery] = useState<{
    field: string;
    order: SORT_ORDER;
  }>({ field: 'queryDate', order: SORT_ORDER.DESC });

  const isAscSortOrder = useMemo(
    () => sortQuery.order === SORT_ORDER.ASC,
    [sortQuery.order]
  );

  const {
    currentPage,
    handlePageChange,
    pageSize,
    handlePageSizeChange,
    paging,
    handlePagingChange,
    showPagination,
  } = usePaging(PAGE_SIZE_BASE);

  const { getEntityPermission, permissions } = usePermissionProvider();

  const fetchResourcePermission = async () => {
    if (isUndefined(selectedQuery)) {
      return;
    }
    setIsLoading((pre) => ({ ...pre, rightPanel: true }));

    try {
      const permission = await getEntityPermission(
        ResourceEntity.QUERY,
        selectedQuery.id ?? ''
      );
      setQueryPermissions(permission);
    } catch {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.resource-permission-lowercase'),
        })
      );
    } finally {
      setIsLoading((pre) => ({ ...pre, rightPanel: false }));
    }
  };

  useEffect(() => {
    if (selectedQuery?.id) {
      fetchResourcePermission();
    }
  }, [selectedQuery]);

  const handleQueryUpdate = async (updatedQuery: Query) => {
    if (isUndefined(selectedQuery)) {
      return;
    }

    const jsonPatch = compare(selectedQuery, updatedQuery);

    try {
      const res = await patchQueries(selectedQuery.id ?? '', jsonPatch);
      setSelectedQuery((pre) => (pre ? { ...pre, ...res } : res));
      setTableQueries((pre) => {
        return pre.map((query) =>
          query.id === updatedQuery.id ? { ...query, ...res } : query
        );
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const updateVote = async (data: QueryVote, id?: string) => {
    try {
      await updateQueryVote(id ?? '', data);
      const response = await getQueryById(id ?? '', {
        fields: [
          TabSpecificField.OWNERS,
          TabSpecificField.VOTES,
          TabSpecificField.TAGS,
          TabSpecificField.QUERY_USED_IN,
          TabSpecificField.USERS,
        ],
      });
      setSelectedQuery(response);
      setTableQueries((pre) => {
        return pre.map((query) =>
          query.id === response.id ? response : query
        );
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleSelectedQuery = (query: Query) => {
    if (query.id !== selectedQuery?.id) {
      setIsLoading((pre) => ({ ...pre, rightPanel: true }));
      setSelectedQuery(query);
      history.push({
        search: Qs.stringify({
          ...searchParams,
          query: query.id,
        }),
      });
    }
  };

  const fetchFilteredQueries = async (data?: FetchFilteredQueriesType) => {
    const {
      tags,
      owners,
      pageNumber = INITIAL_PAGING_VALUE,
      timeRange,
      sortField = sortQuery.field,
      sortOrder = sortQuery.order,
    } = data ?? {};
    const isFilterSelected =
      !isEmpty(tags) || !isEmpty(owners) || !isUndefined(timeRange);

    setIsLoading((pre) => ({ ...pre, query: true }));
    try {
      const response = await searchQuery({
        query: WILD_CARD_CHAR,
        queryFilter: createQueryFilter({ tableId, tags, timeRange, owners }),
        pageNumber: pageNumber,
        pageSize: pageSize,
        searchIndex: SearchIndex.QUERY,
        sortField,
        sortOrder,
      });

      const queries = response.hits.hits.map((hit) => hit._source);
      if (isEmpty(queries)) {
        handlePagingChange({ total: 0 });
        setSelectedQuery(undefined);
        setIsError((pre) => ({
          ...pre,
          ...(isFilterSelected ? { search: true } : { page: true }),
        }));
      } else {
        handlePagingChange({ total: response.hits.total.value });
        handlePageChange(pageNumber);
        setIsError(QUERY_PAGE_ERROR_STATE);
        setTableQueries(queries);
        const selectedQueryData = searchParams.query
          ? queries.find((query) => query.id === searchParams.query) ||
            queries[0]
          : queries[0];
        setSelectedQuery(selectedQueryData);
        history.replace({
          search: stringifySearchParams({
            tableId,
            query: selectedQueryData.id,
            queryFrom: pageNumber,
          }),
        });
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
      setSelectedQuery(undefined);
      handlePagingChange({ total: 0 });
      setIsError((pre) => ({
        ...pre,
        ...(isFilterSelected ? { search: true } : { page: true }),
      }));
    } finally {
      setIsLoading((pre) => ({ ...pre, query: false }));
    }
  };

  const fetchTags = async (searchText = WILD_CARD_CHAR) => {
    const data = await fetchFilterOptions(
      searchText,
      'disabled:false AND !classification.name:Tier',
      SearchIndex.TAG
    );

    return data.hits.hits.map((hit) => ({
      key: hit._source.fullyQualifiedName ?? hit._source.name,
      label: getEntityName(hit._source),
    }));
  };

  const setTagsDefaultOption = () => {
    setTagsFilter((pre) => ({
      ...pre,
      options: uniqBy([...pre.selected, ...pre.initialOptions], 'key'),
    }));
  };

  const handleTagsSearch = async (searchText: string) => {
    if (isEmpty(searchText)) {
      setTagsDefaultOption();

      return;
    }

    setIsTagsLoading(true);
    try {
      const options = await fetchTags(searchText);
      setTagsFilter((pre) => ({ ...pre, options }));
    } catch {
      setTagsFilter((pre) => ({ ...pre, options: [] }));
    } finally {
      setIsTagsLoading(false);
    }
  };

  const getInitialTagsOptions = async () => {
    if (!isEmpty(tagsFilter.initialOptions)) {
      setTagsDefaultOption();

      return;
    }
    setIsTagsLoading(true);
    try {
      const options = await fetchTags();
      setTagsFilter((pre) => ({ ...pre, options, initialOptions: options }));
    } catch {
      setTagsFilter((pre) => ({ ...pre, options: [], initialOptions: [] }));
    } finally {
      setIsTagsLoading(false);
    }
  };

  const handleTagsFilterChange = (selected: SearchDropdownOption[]) => {
    setTagsFilter((pre) => ({ ...pre, selected }));
    fetchFilteredQueries({ tags: selected, timeRange: queryDateFilter });
  };

  const fetchOwner = async (searchText = WILD_CARD_CHAR) => {
    const data = await fetchFilterOptions(searchText, 'isBot:false', [
      SearchIndex.USER,
      SearchIndex.TEAM,
    ]);

    return data.hits.hits.map((hit) => ({
      key: hit._source.name,
      label: getEntityName(hit._source),
    }));
  };

  const setOwnerDefaultOption = () => {
    setOwnerFilter((pre) => ({
      ...pre,
      options: uniqBy([...pre.selected, ...pre.initialOptions], 'key'),
    }));
  };

  const getInitialOwnerOptions = async () => {
    if (!isEmpty(ownerFilter.initialOptions)) {
      setOwnerDefaultOption();

      return;
    }
    setIsOwnerLoading(true);
    try {
      const options = await fetchOwner();
      setOwnerFilter((pre) => ({ ...pre, options, initialOptions: options }));
    } catch {
      setOwnerFilter((pre) => ({ ...pre, options: [], initialOptions: [] }));
    } finally {
      setIsOwnerLoading(false);
    }
  };

  const handleOwnerFilterChange = (selected: SearchDropdownOption[]) => {
    setOwnerFilter((pre) => ({ ...pre, selected }));
    fetchFilteredQueries({
      tags: tagsFilter.selected,
      timeRange: queryDateFilter,
      owners: selected,
    });
  };

  const handleOwnerSearch = async (searchText: string) => {
    if (isEmpty(searchText)) {
      setOwnerDefaultOption();

      return;
    }

    setIsOwnerLoading(true);
    try {
      const options = await fetchOwner(searchText);
      setOwnerFilter((pre) => ({ ...pre, options }));
    } catch {
      setOwnerFilter((pre) => ({ ...pre, options: [] }));
    } finally {
      setIsOwnerLoading(false);
    }
  };

  const onDateChange: RangePickerProps['onChange'] = (values) => {
    if (values) {
      const startTs = values[0]?.startOf('day').valueOf();
      const endTs = values[1]?.endOf('day').valueOf();

      if (!isUndefined(startTs) && !isUndefined(endTs)) {
        setQueryDateFilter({ startTs, endTs });
        fetchFilteredQueries({
          tags: tagsFilter.selected,
          timeRange: { startTs, endTs },
        });
        setIsClickedCalendar(false);
      }
    } else {
      setQueryDateFilter(undefined);
      fetchFilteredQueries({ tags: tagsFilter.selected });
    }
  };

  const pagingHandler = (currentPage: number, pageSize: number) => {
    fetchFilteredQueries({
      pageNumber: currentPage,
    });
    handlePageSizeChange(pageSize);
  };

  const handleSortFieldChange = (value: string) => {
    setSortQuery((pre) => ({ ...pre, field: value }));
    fetchFilteredQueries({
      tags: tagsFilter.selected,
      timeRange: queryDateFilter,
      sortField: value,
    });
  };

  const handleSortOderChange = (order: SORT_ORDER) => {
    setSortQuery((pre) => ({ ...pre, order }));
    fetchFilteredQueries({
      tags: tagsFilter.selected,
      timeRange: queryDateFilter,
      sortOrder: order,
    });
  };

  useEffect(() => {
    setIsLoading((pre) => ({ ...pre, page: true }));
    if (tableId && !isTableDeleted) {
      fetchFilteredQueries({
        pageNumber: searchParams.queryFrom
          ? Number(searchParams.queryFrom)
          : INITIAL_PAGING_VALUE,
      }).finally(() => {
        setIsLoading((pre) => ({ ...pre, page: false }));
      });
    } else {
      setIsLoading((pre) => ({ ...pre, page: false, query: false }));
      setIsError(QUERY_PAGE_ERROR_STATE);
    }
  }, [tableId, pageSize]);

  const handleAddQueryClick = () => {
    history.push(getAddQueryPath(datasetFQN));
  };

  const addButton = (
    <Tooltip
      placement="top"
      title={!permissions?.query.Create && NO_PERMISSION_FOR_ACTION}>
      <Button
        data-testid="add-query-btn"
        disabled={!permissions?.query.Create}
        type="primary"
        onClick={handleAddQueryClick}>
        {t('label.add')}
      </Button>
    </Tooltip>
  );

  if (isLoading.page) {
    return <Loader />;
  }
  if (isError.page) {
    return (
      <ErrorPlaceHolder
        buttonId="add-query-btn"
        doc={USAGE_DOCS}
        heading={t('label.query-lowercase-plural')}
        permission={permissions?.query.Create}
        permissionValue={t('label.create-entity', {
          entity: t('label.query'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.CREATE}
        onClick={handleAddQueryClick}
      />
    );
  }

  if (isTableDeleted) {
    return (
      <div data-testid="no-queries">
        <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
          {t('message.field-data-is-not-available-for-deleted-entities', {
            field: t('label.query-plural'),
          })}
        </ErrorPlaceHolder>
      </div>
    );
  }

  const queryTabBody = isError.search ? (
    <Col
      className="flex-center font-medium mt-24 p-b-md"
      data-testid="no-queries"
      span={24}>
      <ErrorPlaceHolder>
        <Typography.Paragraph>
          {t('message.adding-new-entity-is-easy-just-give-it-a-spin', {
            entity: t('label.query-lowercase-plural'),
          })}
        </Typography.Paragraph>
      </ErrorPlaceHolder>
    </Col>
  ) : (
    tableQueries.map((query) => (
      <Col data-testid="query-card" key={query.id} span={24}>
        <QueryCard
          afterDeleteAction={fetchFilteredQueries}
          isExpanded={false}
          permission={queryPermissions}
          query={query}
          selectedId={selectedQuery?.id}
          onQuerySelection={handleSelectedQuery}
          onQueryUpdate={handleQueryUpdate}
          onUpdateVote={updateVote}
        />
      </Col>
    ))
  );

  return (
    <Row className="m-b-md" gutter={8} id="tablequeries" wrap={false}>
      <Col className="tab-content-height-with-resizable-panel" span={24}>
        <ResizablePanels
          firstPanel={{
            className: 'entity-resizable-panel-container',
            allowScroll: true,
            cardClassName: 'm-x-auto',
            children: (
              <Row data-testid="queries-container" gutter={[8, 16]}>
                <Col span={24}>
                  <Space className="justify-between w-full">
                    <Space size={16}>
                      <SearchDropdown
                        hideCounts
                        isSuggestionsLoading={isOwnerLoading}
                        label={t('label.owner')}
                        options={ownerFilter.options}
                        searchKey="owner"
                        selectedKeys={ownerFilter.selected}
                        onChange={handleOwnerFilterChange}
                        onGetInitialOptions={getInitialOwnerOptions}
                        onSearch={handleOwnerSearch}
                      />

                      <SearchDropdown
                        hideCounts
                        isSuggestionsLoading={isTagsLoading}
                        label={t('label.tag')}
                        options={tagsFilter.options}
                        searchKey="tag"
                        selectedKeys={tagsFilter.selected}
                        onChange={handleTagsFilterChange}
                        onGetInitialOptions={getInitialTagsOptions}
                        onSearch={handleTagsSearch}
                      />
                      <Button
                        className="p-x-0"
                        type="text"
                        onClick={() => {
                          setIsClickedCalendar(true);
                        }}>
                        <span>
                          <label>{t('label.created-date')}</label>
                          <DatePicker.RangePicker
                            allowClear
                            showNow
                            bordered={false}
                            className="p-t-0"
                            clearIcon={<CloseCircleOutlined />}
                            data-testid="data-range-picker"
                            open={isClickedCalendar}
                            suffixIcon={null}
                            onChange={onDateChange}
                            onOpenChange={(isOpen) => {
                              setIsClickedCalendar(isOpen);
                            }}
                          />
                        </span>
                      </Button>
                    </Space>
                    <Space size={16}>
                      <SortingDropDown
                        fieldList={QUERY_SORT_OPTIONS}
                        handleFieldDropDown={handleSortFieldChange}
                        sortField={sortQuery.field}
                      />
                      <Button
                        className="p-0"
                        data-testid="sort-order-button"
                        type="text"
                        onClick={() =>
                          handleSortOderChange(
                            isAscSortOrder ? SORT_ORDER.DESC : SORT_ORDER.ASC
                          )
                        }>
                        {isAscSortOrder ? (
                          <SortAscendingOutlined
                            className="text-base text-grey-muted"
                            style={{ fontSize: '14px' }}
                          />
                        ) : (
                          <SortDescendingOutlined className="text-sm text-grey-muted" />
                        )}
                      </Button>
                      {addButton}
                    </Space>
                  </Space>
                </Col>

                {isLoading.query ? (
                  <Loader />
                ) : (
                  <>
                    {queryTabBody}
                    {showPagination && (
                      <Col span={24}>
                        <PaginationComponent
                          hideOnSinglePage
                          showSizeChanger
                          className="text-center m-b-sm"
                          current={currentPage}
                          data-testid="query-pagination"
                          pageSize={pageSize}
                          total={paging.total}
                          onChange={pagingHandler}
                        />
                      </Col>
                    )}
                  </>
                )}
              </Row>
            ),
            minWidth: 800,
            flex: 0.87,
          }}
          hideSecondPanel={!selectedQuery}
          secondPanel={{
            children: selectedQuery && (
              <TableQueryRightPanel
                isLoading={isLoading.rightPanel}
                permission={queryPermissions}
                query={selectedQuery}
                onQueryUpdate={handleQueryUpdate}
              />
            ),
            minWidth: 400,
            flex: 0.13,
            className:
              'entity-summary-resizable-right-panel-container entity-resizable-panel-container',
          }}
        />
      </Col>
    </Row>
  );
};

export default TableQueries;
