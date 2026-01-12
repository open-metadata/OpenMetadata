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
import { compare } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import QueryString from 'qs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import DisplayName from '../../components/common/DisplayName/DisplayName';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import RichTextEditorPreviewerNew from '../../components/common/RichTextEditor/RichTextEditorPreviewNew';
import TableAntd from '../../components/common/Table/Table';
import { useGenericContext } from '../../components/Customization/GenericProvider/GenericProvider';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import {
  INITIAL_PAGING_VALUE,
  INITIAL_TABLE_FILTERS,
} from '../../constants/constants';
import { DUMMY_DATABASE_SCHEMA_TABLES_DETAILS } from '../../constants/Database.constants';
import { TABLE_SCROLL_VALUE } from '../../constants/Table.constants';
import {
  COMMON_STATIC_TABLE_VISIBLE_COLUMNS,
  DEFAULT_DATABASE_SCHEMA_TABLE_VISIBLE_COLUMNS,
} from '../../constants/TableKeys.constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { DatabaseSchema } from '../../generated/entity/data/databaseSchema';
import { Table } from '../../generated/entity/data/table';
import { Operation } from '../../generated/entity/policies/accessControl/resourcePermission';
import { Include } from '../../generated/type/include';
import { usePaging } from '../../hooks/paging/usePaging';
import { useFqn } from '../../hooks/useFqn';
import { useTableFilters } from '../../hooks/useTableFilters';
import { searchQuery } from '../../rest/searchAPI';
import {
  getTableList,
  patchTableDetails,
  TableListParams,
} from '../../rest/tableAPI';
import { buildSchemaQueryFilter } from '../../utils/DatabaseSchemaDetailsUtils';
import { commonTableFields } from '../../utils/DatasetDetailsUtils';
import { getBulkEditButton } from '../../utils/EntityBulkEdit/EntityBulkEditUtils';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import {
  getColumnSorter,
  getEntityBulkEditPath,
  highlightSearchText,
} from '../../utils/EntityUtils';
import {
  getPrioritizedEditPermission,
  getPrioritizedViewPermission,
} from '../../utils/PermissionsUtils';
import { stringToHTML } from '../../utils/StringsUtils';
import {
  dataProductTableObject,
  domainTableObject,
  ownerTableObject,
  tagTableObject,
} from '../../utils/TableColumn.util';
import { showErrorToast } from '../../utils/ToastUtils';

interface SchemaTablesTabProps {
  isVersionView?: boolean;
  isCustomizationPage?: boolean;
}

function SchemaTablesTab({
  isVersionView = false,
  isCustomizationPage = false,
}: Readonly<SchemaTablesTabProps>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tableData, setTableData] = useState<Array<Table>>([]);
  const [tableDataLoading, setTableDataLoading] = useState<boolean>(true);
  const { permissions } = usePermissionProvider();
  const { fqn: decodedDatabaseSchemaFQN } = useFqn();
  const { data: databaseSchemaDetails, permissions: databaseSchemaPermission } =
    useGenericContext<DatabaseSchema>();
  const { filters: tableFilters, setFilters } = useTableFilters(
    INITIAL_TABLE_FILTERS
  );
  const { showDeletedTables: showDeletedSchemas } = tableFilters;

  const {
    paging,
    pageSize,
    showPagination,
    handlePagingChange,
    currentPage,
    handlePageSizeChange,
    handlePageChange,
    pagingCursor,
  } = usePaging();

  const allowEditDisplayNamePermission = useMemo(() => {
    return (
      !isVersionView &&
      getPrioritizedEditPermission(permissions.table, Operation.EditDisplayName)
    );
  }, [permissions, isVersionView]);

  const searchValue = useMemo(() => {
    const param = location.search;
    const searchData = QueryString.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return searchData.schema as string | undefined;
  }, [location.search]);

  const { viewDatabaseSchemaPermission } = useMemo(
    () => ({
      viewDatabaseSchemaPermission: getPrioritizedViewPermission(
        databaseSchemaPermission,
        Operation.ViewBasic
      ),
    }),
    [databaseSchemaPermission]
  );

  const searchSchema = useCallback(
    async (searchValue: string, pageNumber = INITIAL_PAGING_VALUE) => {
      setTableDataLoading(true);
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
          searchIndex: SearchIndex.TABLE,
          includeDeleted: showDeletedSchemas,
          trackTotalHits: true,
        });
        const data = response.hits.hits.map((schema) => schema._source);
        const total = response.hits.total.value;
        setTableData(data);
        handlePagingChange({ total });
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setTableDataLoading(false);
      }
    },
    [decodedDatabaseSchemaFQN, showDeletedSchemas, handlePagingChange]
  );

  const handleDisplayNameUpdate = useCallback(
    async (data: EntityName, id?: string) => {
      try {
        const tableDetails = tableData.find((table) => table.id === id);
        if (!tableDetails) {
          return;
        }
        const updatedData = {
          ...tableDetails,
          displayName: data.displayName,
        };
        const jsonPatch = compare(tableDetails, updatedData);
        const response = await patchTableDetails(tableDetails.id, jsonPatch);

        setTableData((prevData) =>
          prevData.map((table) => (table.id === id ? response : table))
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [tableData]
  );

  const handleShowDeletedTables = (value: boolean) => {
    setFilters({ showDeletedTables: value });
    handlePageChange(INITIAL_PAGING_VALUE, {
      cursorType: null,
      cursorValue: undefined,
    });
  };

  const getSchemaTables = useCallback(
    async (params?: TableListParams) => {
      setTableDataLoading(true);
      try {
        const res = await getTableList({
          ...params,
          fields: commonTableFields,
          databaseSchema: decodedDatabaseSchemaFQN,
          limit: pageSize,
          include: showDeletedSchemas ? Include.Deleted : Include.NonDeleted,
        });
        setTableData(res.data);
        handlePagingChange(res.paging);
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setTableDataLoading(false);
      }
    },
    [decodedDatabaseSchemaFQN, showDeletedSchemas, pageSize]
  );

  const onSchemaSearch = useCallback(
    (value: string) => {
      setFilters({ schema: isEmpty(value) ? undefined : value });
      handlePageChange(INITIAL_PAGING_VALUE, {
        cursorType: null,
        cursorValue: undefined,
      });
    },
    [setFilters, handlePageChange]
  );

  const tablePaginationHandler = useCallback(
    ({ cursorType, currentPage }: PagingHandlerParams) => {
      if (searchValue) {
        handlePageChange(currentPage);
      } else if (cursorType) {
        handlePageChange(
          currentPage,
          {
            cursorType: cursorType,
            cursorValue: paging[cursorType],
          },
          pageSize
        );
      }
    },
    [paging, handlePageChange, searchValue]
  );

  const tableColumn: ColumnsType<Table> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: 300,
        sorter: getColumnSorter<Table, 'name'>('name'),
        render: (_, record: Table) => {
          return (
            <DisplayName
              displayName={stringToHTML(
                highlightSearchText(record.displayName, searchValue)
              )}
              hasEditPermission={allowEditDisplayNamePermission}
              id={record.id}
              key={record.id}
              link={entityUtilClassBase.getEntityLink(
                EntityType.TABLE,
                record.fullyQualifiedName as string
              )}
              name={stringToHTML(highlightSearchText(record.name, searchValue))}
              onEditDisplayName={handleDisplayNameUpdate}
            />
          );
        },
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        width: 400,
        render: (text: string) =>
          text?.trim() ? (
            <RichTextEditorPreviewerNew markdown={text} />
          ) : (
            <span className="text-grey-muted">{t('label.no-description')}</span>
          ),
      },
      ...ownerTableObject<Table>(),
      ...domainTableObject<Table>(),
      ...dataProductTableObject<Table>(),
      ...tagTableObject<Table>(),
    ],
    [handleDisplayNameUpdate, allowEditDisplayNamePermission]
  );

  const handleEditTable = () => {
    navigate({
      pathname: getEntityBulkEditPath(
        EntityType.DATABASE_SCHEMA,
        decodedDatabaseSchemaFQN
      ),
    });
  };

  useEffect(() => {
    if (searchValue) {
      searchSchema(searchValue, currentPage);
    }
  }, [searchValue, currentPage, showDeletedSchemas]);

  useEffect(() => {
    if (searchValue) {
      return;
    }
    if (isCustomizationPage) {
      setTableData(DUMMY_DATABASE_SCHEMA_TABLES_DETAILS);
      setTableDataLoading(false);

      return;
    }
    if (viewDatabaseSchemaPermission && decodedDatabaseSchemaFQN) {
      if (pagingCursor?.cursorType && pagingCursor?.cursorValue) {
        getSchemaTables({
          [pagingCursor.cursorType]: pagingCursor.cursorValue,
        });
      } else {
        getSchemaTables({ limit: pageSize });
      }
    }
  }, [
    showDeletedSchemas,
    decodedDatabaseSchemaFQN,
    viewDatabaseSchemaPermission,
    pageSize,
    isCustomizationPage,
    pagingCursor,
    searchValue,
  ]);

  useEffect(() => {
    setFilters({
      showDeletedTables: showDeletedSchemas ?? databaseSchemaDetails.deleted,
    });
  }, [databaseSchemaDetails.deleted, showDeletedSchemas]);

  const searchProps = useMemo(
    () => ({
      placeholder: t('label.search-for-type', {
        type: t('label.table'),
      }),
      searchValue: searchValue,
      typingInterval: 500,
      onSearch: onSchemaSearch,
    }),
    [t, onSchemaSearch]
  );

  return (
    <TableAntd
      columns={tableColumn}
      customPaginationProps={{
        showPagination,
        currentPage,
        isLoading: tableDataLoading,
        pageSize,
        paging,
        isNumberBased: Boolean(searchValue),
        pagingHandler: tablePaginationHandler,
        onShowSizeChange: handlePageSizeChange,
      }}
      data-testid="databaseSchema-tables"
      dataSource={tableData}
      defaultVisibleColumns={DEFAULT_DATABASE_SCHEMA_TABLE_VISIBLE_COLUMNS}
      extraTableFilters={
        !isVersionView && (
          <>
            <span>
              <Switch
                checked={showDeletedSchemas}
                data-testid="show-deleted"
                onClick={handleShowDeletedTables}
              />
              <Typography.Text className="m-l-xs">
                {t('label.deleted')}
              </Typography.Text>
            </span>

            {getBulkEditButton(
              permissions.table.EditAll && !databaseSchemaDetails.deleted,
              handleEditTable
            )}
          </>
        )
      }
      loading={tableDataLoading}
      locale={{
        emptyText: (
          <ErrorPlaceHolder
            className="mt-0-important border-none"
            type={ERROR_PLACEHOLDER_TYPE.NO_DATA}
          />
        ),
      }}
      pagination={false}
      rowKey="id"
      scroll={TABLE_SCROLL_VALUE}
      searchProps={searchProps}
      size="small"
      staticVisibleColumns={COMMON_STATIC_TABLE_VISIBLE_COLUMNS}
    />
  );
}

export default SchemaTablesTab;
