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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import RichTextEditorPreviewerNew from '../../components/common/RichTextEditor/RichTextEditorPreviewNew';
import Table from '../../components/common/Table/Table';
<<<<<<< HEAD
import { INITIAL_PAGING_VALUE } from '../../constants/constants';
=======
import {
  INITIAL_PAGING_VALUE,
  INITIAL_TABLE_FILTERS,
  PAGE_SIZE,
} from '../../constants/constants';
>>>>>>> 8a8420cb4b (Feat: Added search functionality for schema tables and stored procedures)
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
import { getEntityName } from '../../utils/EntityUtils';
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

  const { filters: tableFilters, setFilters } = useTableFilters(
    INITIAL_TABLE_FILTERS
  );
  const { showDeletedTables: showDeletedStoredProcedures } = tableFilters;

  const searchStoredProcedure = useCallback(
    async (searchValue: string, pageNumber = INITIAL_PAGING_VALUE) => {
      setIsLoading(true);
      try {
        const response = await searchQuery({
          query: '',
          pageNumber,
          pageSize: PAGE_SIZE,
          queryFilter: buildSchemaQueryFilter(
            'databaseSchema.fullyQualifiedName',
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
      if (cursorType) {
        const pagingString = {
          [cursorType]: paging[cursorType],
        };

        await fetchStoreProcedureDetails(pagingString);
        handlePageChange(
          currentPage,
          { cursorType, cursorValue: paging[cursorType] },
          pageSize
        );
      }
    },
    [paging, handlePageChange, fetchStoreProcedureDetails]
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
        render: (_, record) => (
          <div className="d-inline-flex w-max-90">
            <Link
              className="break-word"
              to={entityUtilClassBase.getEntityLink(
                EntityType.STORED_PROCEDURE,
                record.fullyQualifiedName ?? ''
              )}>
              {getEntityName(record)}
            </Link>
          </div>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (text: string) =>
          isEmpty(text) ? (
            <Typography.Text className="text-grey-muted">
              {t('label.no-description')}
            </Typography.Text>
          ) : (
            <RichTextEditorPreviewerNew markdown={text} />
          ),
      },
    ],
    []
  );

  const onStoredProcedureSearch = useCallback(
    (value: string) => {
      setFilters({ schema: isEmpty(value) ? undefined : value });
      if (value) {
        searchStoredProcedure(value);
      } else {
        fetchStoreProcedureDetails();
      }
    },
    [setFilters, searchStoredProcedure, fetchStoreProcedureDetails]
  );

  useEffect(() => {
    const { cursorType, cursorValue } = pagingCursor ?? {};

    if (cursorType && cursorValue) {
      fetchStoreProcedureDetails({ [cursorType]: cursorValue });
    } else {
      fetchStoreProcedureDetails();
    }
  }, [showDeletedStoredProcedures, pageSize, pagingCursor]);

  const paginationProps = useMemo(
    () => ({
      currentPage,
      isLoading,
      showPagination,
      pageSize,
      paging,
      pagingHandler: storedProcedurePagingHandler,
      onShowSizeChange: handlePageSizeChange,
    }),
    [
      currentPage,
      isLoading,
      showPagination,
      pageSize,
      paging,
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
