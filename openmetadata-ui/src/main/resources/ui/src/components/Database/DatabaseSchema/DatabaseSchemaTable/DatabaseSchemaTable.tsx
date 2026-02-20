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
import { useNavigate } from 'react-router-dom';
import {
  INITIAL_PAGING_VALUE,
  INITIAL_TABLE_FILTERS,
} from '../../../../constants/constants';
import { DATABASE_SCHEMAS_DUMMY_DATA } from '../../../../constants/Database.constants';
import { TABLE_SCROLL_VALUE } from '../../../../constants/Table.constants';
import {
  COMMON_STATIC_TABLE_VISIBLE_COLUMNS,
  DEFAULT_DATABASE_SCHEMA_VISIBLE_COLUMNS,
  TABLE_COLUMNS_KEYS,
} from '../../../../constants/TableKeys.constants';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { EntityType, TabSpecificField } from '../../../../enums/entity.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { Database } from '../../../../generated/entity/data/database';
import { DatabaseSchema } from '../../../../generated/entity/data/databaseSchema';
import { Operation } from '../../../../generated/entity/policies/accessControl/resourcePermission';
import { UsageDetails } from '../../../../generated/type/entityUsage';
import { Include } from '../../../../generated/type/include';
import { Paging } from '../../../../generated/type/paging';
import { usePaging } from '../../../../hooks/paging/usePaging';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import { useFqn } from '../../../../hooks/useFqn';
import { useTableFilters } from '../../../../hooks/useTableFilters';
import {
  getDatabaseSchemas,
  patchDatabaseSchemaDetails,
} from '../../../../rest/databaseAPI';
import { searchQuery } from '../../../../rest/searchAPI';
import { buildSchemaQueryFilter } from '../../../../utils/DatabaseSchemaDetailsUtils';
import { commonTableFields } from '../../../../utils/DatasetDetailsUtils';
import { getBulkEditButton } from '../../../../utils/EntityBulkEdit/EntityBulkEditUtils';
import {
  getColumnSorter,
  getEntityBulkEditPath,
  highlightSearchText,
} from '../../../../utils/EntityUtils';
import { t } from '../../../../utils/i18next/LocalUtil';
import { getPrioritizedViewPermission } from '../../../../utils/PermissionsUtils';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import { stringToHTML } from '../../../../utils/StringsUtils';
import {
  dataProductTableObject,
  descriptionTableObject,
  domainTableObject,
  ownerTableObject,
  tagTableObject,
} from '../../../../utils/TableColumn.util';
import { getUsagePercentile } from '../../../../utils/TableUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import DisplayName from '../../../common/DisplayName/DisplayName';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PagingHandlerParams } from '../../../common/NextPrevious/NextPrevious.interface';
import Table from '../../../common/Table/Table';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericProvider';
import { EntityName } from '../../../Modals/EntityNameModal/EntityNameModal.interface';
import { DatabaseSchemaTableProps } from './DatabaseSchemaTable.interface';

export const DatabaseSchemaTable = ({
  isVersionPage = false,
  isCustomizationPage = false,
}: Readonly<DatabaseSchemaTableProps>) => {
  const { fqn: decodedDatabaseFQN } = useFqn();
  const navigate = useNavigate();
  const location = useCustomLocation();
  const { permissions } = usePermissionProvider();
  const [schemas, setSchemas] = useState<DatabaseSchema[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { data } = useGenericContext<Database>();
  const { filters: tableFilters, setFilters } = useTableFilters(
    INITIAL_TABLE_FILTERS
  );
  const { showDeletedTables: showDeletedSchemas } = tableFilters;

  const { deleted: isDatabaseDeleted } = data ?? {};

  const allowEditDisplayNamePermission = useMemo(() => {
    return (
      !isVersionPage &&
      (permissions.databaseSchema.EditAll ||
        permissions.databaseSchema.EditDisplayName)
    );
  }, [permissions, isVersionPage]);

  const viewUsagePermission = useMemo(
    () =>
      getPrioritizedViewPermission(
        permissions.databaseSchema,
        Operation.ViewUsage
      ),
    [permissions.databaseSchema]
  );

  const searchValue = useMemo(() => {
    const param = location.search;
    const searchData = QueryString.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return searchData.schema as string | undefined;
  }, [location.search]);
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

  const fetchDatabaseSchema = useCallback(
    async (params?: Partial<Paging>) => {
      if (isEmpty(decodedDatabaseFQN)) {
        return;
      }

      try {
        setIsLoading(true);
        const { data, paging } = await getDatabaseSchemas({
          databaseName: decodedDatabaseFQN,
          limit: pageSize,
          after: params?.after,
          before: params?.before,
          include: showDeletedSchemas ? Include.Deleted : Include.NonDeleted,
          fields: [
            ...(viewUsagePermission ? [TabSpecificField.USAGE_SUMMARY] : []),
            commonTableFields,
          ],
        });

        setSchemas(data);
        handlePagingChange(paging);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [pageSize, decodedDatabaseFQN, showDeletedSchemas, viewUsagePermission]
  );

  const searchSchema = useCallback(
    async (searchValue: string, pageNumber = INITIAL_PAGING_VALUE) => {
      setIsLoading(true);
      try {
        const response = await searchQuery({
          query: '',
          pageNumber,
          pageSize: pageSize,
          queryFilter: buildSchemaQueryFilter(
            'database.fullyQualifiedName',
            decodedDatabaseFQN,
            searchValue
          ),
          searchIndex: SearchIndex.DATABASE_SCHEMA,
          includeDeleted: showDeletedSchemas,
          trackTotalHits: true,
        });
        const data = response.hits.hits.map((schema) => schema._source);
        const total = response.hits.total.value;
        setSchemas(data);
        handlePagingChange({ total });
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [decodedDatabaseFQN, showDeletedSchemas, handlePagingChange]
  );

  const handleShowDeletedSchemas = useCallback((value: boolean) => {
    setFilters({ showDeletedTables: value });
    handlePageChange(INITIAL_PAGING_VALUE, {
      cursorType: null,
      cursorValue: undefined,
    });
  }, []);

  const handleSchemaPageChange = useCallback(
    ({ currentPage, cursorType }: PagingHandlerParams) => {
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
    [paging, handlePageChange, pageSize, searchValue]
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

  const handleDisplayNameUpdate = useCallback(
    async (data: EntityName, id?: string) => {
      try {
        const schemaDetails = schemas.find((schema) => schema.id === id);
        if (!schemaDetails) {
          return;
        }
        const updatedData = {
          ...schemaDetails,
          displayName: data.displayName || undefined,
        };
        const jsonPatch = compare(schemaDetails, updatedData);
        const response = await patchDatabaseSchemaDetails(
          schemaDetails.id ?? '',
          jsonPatch
        );
        setSchemas((prevData) =>
          prevData.map((schema) => (schema.id === id ? response : schema))
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [schemas]
  );

  const schemaTableColumns: ColumnsType<DatabaseSchema> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: TABLE_COLUMNS_KEYS.NAME,
        key: TABLE_COLUMNS_KEYS.NAME,
        width: 250,
        sorter: getColumnSorter<DatabaseSchema, 'name'>('name'),
        render: (_, record: DatabaseSchema) => (
          <DisplayName
            displayName={stringToHTML(
              highlightSearchText(record.displayName, searchValue)
            )}
            hasEditPermission={allowEditDisplayNamePermission}
            id={record.id ?? ''}
            key={record.id}
            link={
              record.fullyQualifiedName
                ? getEntityDetailsPath(
                    EntityType.DATABASE_SCHEMA,
                    record.fullyQualifiedName
                  )
                : ''
            }
            name={stringToHTML(highlightSearchText(record.name, searchValue))}
            onEditDisplayName={handleDisplayNameUpdate}
          />
        ),
      },
      ...descriptionTableObject<DatabaseSchema>({ width: 300 }),
      ...ownerTableObject<DatabaseSchema>(),
      ...domainTableObject<DatabaseSchema>(),
      ...dataProductTableObject<DatabaseSchema>(),
      ...tagTableObject<DatabaseSchema>(),
      ...(viewUsagePermission
        ? [
            {
              title: t('label.usage'),
              dataIndex: TABLE_COLUMNS_KEYS.USAGE_SUMMARY,
              key: TABLE_COLUMNS_KEYS.USAGE_SUMMARY,
              width: 120,
              render: (text: UsageDetails) =>
                getUsagePercentile(text?.weeklyStats?.percentileRank ?? 0),
            },
          ]
        : []),
    ],
    [
      handleDisplayNameUpdate,
      allowEditDisplayNamePermission,
      viewUsagePermission,
    ]
  );

  const handleEditTable = () => {
    navigate(getEntityBulkEditPath(EntityType.DATABASE, decodedDatabaseFQN));
  };

  useEffect(() => {
    if (searchValue) {
      searchSchema(searchValue, currentPage);
    }
  }, [searchValue, currentPage, searchSchema]);

  useEffect(() => {
    if (searchValue) {
      return;
    }
    if (isCustomizationPage) {
      setSchemas(DATABASE_SCHEMAS_DUMMY_DATA);
      setIsLoading(false);

      return;
    }
    const { cursorType, cursorValue } = pagingCursor ?? {};

    if (cursorType && cursorValue) {
      fetchDatabaseSchema({ [cursorType]: cursorValue });

      return;
    }

    fetchDatabaseSchema();
  }, [
    decodedDatabaseFQN,
    pageSize,
    showDeletedSchemas,
    isDatabaseDeleted,
    isCustomizationPage,
    pagingCursor,
    searchValue,
  ]);

  const searchProps = useMemo(
    () => ({
      placeholder: t('label.search-for-type', {
        type: t('label.schema'),
      }),
      typingInterval: 500,
      searchValue: searchValue,
      onSearch: onSchemaSearch,
    }),
    [onSchemaSearch, searchValue]
  );

  return (
    <Table
      columns={schemaTableColumns}
      customPaginationProps={{
        currentPage,
        showPagination,
        isLoading,
        isNumberBased: Boolean(searchValue),
        pageSize,
        paging,
        pagingHandler: handleSchemaPageChange,
        onShowSizeChange: handlePageSizeChange,
      }}
      data-testid="database-databaseSchemas"
      dataSource={schemas}
      defaultVisibleColumns={DEFAULT_DATABASE_SCHEMA_VISIBLE_COLUMNS}
      extraTableFilters={
        <>
          <span>
            <Switch
              checked={showDeletedSchemas}
              data-testid="show-deleted"
              onClick={handleShowDeletedSchemas}
            />
            <Typography.Text className="m-l-xs">
              {t('label.deleted')}
            </Typography.Text>{' '}
          </span>
          {getBulkEditButton(
            permissions.databaseSchema.EditAll && !isDatabaseDeleted,
            handleEditTable
          )}
        </>
      }
      loading={isLoading}
      locale={{
        emptyText: <ErrorPlaceHolder className="m-y-md border-none" />,
      }}
      pagination={false}
      rowKey="id"
      scroll={TABLE_SCROLL_VALUE}
      searchProps={searchProps}
      size="small"
      staticVisibleColumns={COMMON_STATIC_TABLE_VISIBLE_COLUMNS}
    />
  );
};
