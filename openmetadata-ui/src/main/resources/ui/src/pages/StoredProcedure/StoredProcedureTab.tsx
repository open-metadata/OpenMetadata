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
import { Switch, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import QueryString from 'qs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DisplayName from '../../components/common/DisplayName/DisplayName';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import Table from '../../components/common/Table/Table';
import {
  INITIAL_PAGING_VALUE,
  INITIAL_TABLE_FILTERS,
} from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { Include } from '../../generated/type/include';
import { Paging } from '../../generated/type/paging';
import { usePaging } from '../../hooks/paging/usePaging';
import { useFqn } from '../../hooks/useFqn';
import { useTableFilters } from '../../hooks/useTableFilters';
import { ServicePageData } from '../../pages/ServiceDetailsPage/ServiceDetailsPage.interface';
import { searchQuery } from '../../rest/searchAPI';
import { getStoredProceduresList } from '../../rest/storedProceduresAPI';
import { buildSchemaQueryFilter } from '../../utils/DatabaseSchemaDetailsUtils';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import { getColumnSorter, highlightSearchText } from '../../utils/EntityUtils';
import { stringToHTML } from '../../utils/StringsUtils';
import { descriptionTableObject } from '../../utils/TableColumn.util';
import { showErrorToast } from '../../utils/ToastUtils';

const StoredProcedureTab = () => {
  const { t } = useTranslation();
  const {
    currentPage,
    handlePageChange,
    pageSize,
    handlePageSizeChange,
    paging,
    handlePagingChange,
    showPagination,
    pagingCursor,
  } = usePaging();

  const [storedProcedure, setStoredProcedure] = useState<ServicePageData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { fqn: decodedDatabaseSchemaFQN } = useFqn();

  useEffect(() => {
    const urlPage = Number(pagingCursor.currentPage) || INITIAL_PAGING_VALUE;
    if (currentPage !== urlPage) {
      handlePageChange(urlPage);
    }
  }, [pagingCursor.currentPage]);

  const { filters: tableFilters, setFilters } = useTableFilters(
    INITIAL_TABLE_FILTERS
  );
  const { showDeletedTables: showDeletedStoredProcedures } = tableFilters;

  const searchValue = useMemo(() => {
    const param = location.search;
    const searchData = QueryString.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return searchData.schema as string | undefined;
  }, [location.search]);

  const searchStoredProcedure = useCallback(
    async (searchValue: string, pageNumber = INITIAL_PAGING_VALUE) => {
      setIsLoading(true);
      try {
        const response = await searchQuery({
          query: '',
          pageNumber,
          pageSize: pageSize,
          queryFilter: buildSchemaQueryFilter(
            'databaseSchema.fullyQualifiedName.keyword',
            decodedDatabaseSchemaFQN,
            searchValue
          ),
          searchIndex: SearchIndex.STORED_PROCEDURE,
          includeDeleted: showDeletedStoredProcedures,
          trackTotalHits: true,
        });
        const data = response.hits.hits.map((schema) => schema._source);
        const total = response.hits.total.value;
        setStoredProcedure(data);
        handlePagingChange({ total });
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [decodedDatabaseSchemaFQN, showDeletedStoredProcedures, handlePagingChange]
  );

  const fetchStoreProcedureDetails = useCallback(
    async (params?: Partial<Paging>) => {
      try {
        setIsLoading(true);
        const { data, paging } = await getStoredProceduresList({
          databaseSchema: decodedDatabaseSchemaFQN,
          include: showDeletedStoredProcedures
            ? Include.Deleted
            : Include.NonDeleted,
          ...params,
          limit: pageSize,
        });
        setStoredProcedure(data);
        handlePagingChange(paging);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [
      decodedDatabaseSchemaFQN,
      pageSize,
      showDeletedStoredProcedures,
      handlePagingChange,
    ]
  );

  const storedProcedurePagingHandler = useCallback(
    async ({ cursorType, currentPage }: PagingHandlerParams) => {
      if (searchValue) {
        handlePageChange(currentPage);
      } else if (cursorType) {
        handlePageChange(
          currentPage,
          { cursorType, cursorValue: paging[cursorType] },
          pageSize
        );
      }
    },
    [paging, handlePageChange, searchValue]
  );

  const handleShowDeletedStoredProcedures = (value: boolean) => {
    setFilters({ showDeletedTables: value });
    handlePageChange(INITIAL_PAGING_VALUE, {
      cursorType: null,
      cursorValue: undefined,
    });
  };

  const tableColumn: ColumnsType<ServicePageData> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: 350,
        sorter: getColumnSorter<ServicePageData, 'name'>('name'),
        render: (_, record) => (
          <DisplayName
            displayName={stringToHTML(
              highlightSearchText(record.displayName, searchValue)
            )}
            id={record.id ?? ''}
            key={record.id}
            link={entityUtilClassBase.getEntityLink(
              EntityType.STORED_PROCEDURE,
              record.fullyQualifiedName ?? ''
            )}
            name={stringToHTML(highlightSearchText(record.name, searchValue))}
          />
        ),
      },
      ...descriptionTableObject(),
    ],
    [searchValue]
  );

  const onStoredProcedureSearch = useCallback(
    (value: string) => {
      setFilters({ schema: isEmpty(value) ? undefined : value });
      handlePageChange(INITIAL_PAGING_VALUE, {
        cursorType: null,
        cursorValue: undefined,
      });
    },
    [setFilters, handlePageChange]
  );

  useEffect(() => {
    if (searchValue) {
      searchStoredProcedure(searchValue, currentPage);
    }
  }, [searchValue, currentPage, showDeletedStoredProcedures]);

  useEffect(() => {
    if (searchValue) {
      return;
    }
    const { cursorType, cursorValue } = pagingCursor ?? {};

    if (cursorType && cursorValue) {
      fetchStoreProcedureDetails({ [cursorType]: cursorValue });
    } else {
      fetchStoreProcedureDetails();
    }
  }, [showDeletedStoredProcedures, pageSize, pagingCursor, searchValue]);

  const paginationProps = useMemo(
    () => ({
      currentPage,
      isLoading,
      showPagination,
      pageSize,
      paging,
      isNumberBased: Boolean(searchValue),
      pagingHandler: storedProcedurePagingHandler,
      onShowSizeChange: handlePageSizeChange,
    }),
    [
      currentPage,
      isLoading,
      showPagination,
      pageSize,
      paging,
      searchValue,
      storedProcedurePagingHandler,
      handlePageSizeChange,
    ]
  );

  const searchProps = useMemo(
    () => ({
      placeholder: t('label.search-for-type', {
        type: t('label.stored-procedure'),
      }),
      typingInterval: 500,
      searchValue: searchValue,
      onSearch: onStoredProcedureSearch,
    }),
    [onStoredProcedureSearch]
  );

  return (
    <Table
      columns={tableColumn}
      containerClassName="m-md"
      customPaginationProps={paginationProps}
      data-testid="stored-procedure-table"
      dataSource={storedProcedure}
      extraTableFilters={
        <span>
          <Switch
            checked={showDeletedStoredProcedures}
            data-testid="show-deleted-stored-procedure"
            onClick={handleShowDeletedStoredProcedures}
          />
          <Typography.Text className="m-l-xs">
            {t('label.deleted')}
          </Typography.Text>
        </span>
      }
      loading={isLoading}
      locale={{
        emptyText: <ErrorPlaceHolder className="m-y-md" />,
      }}
      pagination={false}
      rowKey="id"
      searchProps={searchProps}
      size="small"
    />
  );
};

export default StoredProcedureTab;
