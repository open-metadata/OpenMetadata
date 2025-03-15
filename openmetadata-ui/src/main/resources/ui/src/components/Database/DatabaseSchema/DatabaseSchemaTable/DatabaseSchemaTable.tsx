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
import { Col, Row, Switch, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { t } from 'i18next';
import { isEmpty } from 'lodash';
import QueryString from 'qs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  INITIAL_PAGING_VALUE,
  NO_DATA_PLACEHOLDER,
  PAGE_SIZE,
} from '../../../../constants/constants';
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
import { EntityReference } from '../../../../generated/entity/type';
import { UsageDetails } from '../../../../generated/type/entityUsage';
import { Include } from '../../../../generated/type/include';
import { Paging } from '../../../../generated/type/paging';
import { usePaging } from '../../../../hooks/paging/usePaging';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import { useFqn } from '../../../../hooks/useFqn';
import {
  getDatabaseSchemas,
  patchDatabaseSchemaDetails,
} from '../../../../rest/databaseAPI';
import { searchQuery } from '../../../../rest/searchAPI';
import { getBulkEditButton } from '../../../../utils/EntityBulkEdit/EntityBulkEditUtils';
import {
  getEntityBulkEditPath,
  highlightSearchText,
} from '../../../../utils/EntityUtils';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import { stringToHTML } from '../../../../utils/StringsUtils';
import { getUsagePercentile } from '../../../../utils/TableUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import DisplayName from '../../../common/DisplayName/DisplayName';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import NextPrevious from '../../../common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../../common/NextPrevious/NextPrevious.interface';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';
import RichTextEditorPreviewerV1 from '../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import Searchbar from '../../../common/SearchBarComponent/SearchBar.component';
import Table from '../../../common/Table/Table';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericProvider';
import { EntityName } from '../../../Modals/EntityNameModal/EntityNameModal.interface';
import { DatabaseSchemaTableProps } from './DatabaseSchemaTable.interface';

export const DatabaseSchemaTable = ({
  isVersionPage = false,
}: Readonly<DatabaseSchemaTableProps>) => {
  const { fqn: decodedDatabaseFQN } = useFqn();
  const history = useHistory();
  const location = useCustomLocation();
  const { permissions } = usePermissionProvider();
  const [schemas, setSchemas] = useState<DatabaseSchema[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeletedSchemas, setShowDeletedSchemas] = useState<boolean>(false);
  const { data } = useGenericContext<Database>();

  const { deleted: isDatabaseDeleted } = data ?? {};

  const allowEditDisplayNamePermission = useMemo(() => {
    return (
      !isVersionPage &&
      (permissions.databaseSchema.EditAll ||
        permissions.databaseSchema.EditDisplayName)
    );
  }, [permissions, isVersionPage]);

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
          fields: [TabSpecificField.OWNERS, TabSpecificField.USAGE_SUMMARY],
        });

        setSchemas(data);
        handlePagingChange(paging);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [pageSize, decodedDatabaseFQN, showDeletedSchemas]
  );

  const searchSchema = async (
    searchValue: string,
    pageNumber = INITIAL_PAGING_VALUE
  ) => {
    setIsLoading(true);
    try {
      const response = await searchQuery({
        query: `(name.keyword:*${searchValue}*) OR (description.keyword:*${searchValue}*)`,
        pageNumber,
        pageSize: PAGE_SIZE,
        queryFilter: {
          query: {
            bool: {
              must: [
                { term: { 'database.fullyQualifiedName': decodedDatabaseFQN } },
              ],
            },
          },
        },
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
  };

  const handleShowDeletedSchemas = useCallback((value: boolean) => {
    setShowDeletedSchemas(value);
    handlePageChange(INITIAL_PAGING_VALUE);
  }, []);

  const handleSchemaPageChange = useCallback(
    ({ currentPage, cursorType }: PagingHandlerParams) => {
      if (searchValue) {
        searchSchema(searchValue, currentPage);
      } else if (cursorType) {
        fetchDatabaseSchema({ [cursorType]: paging[cursorType] });
      }
      handlePageChange(currentPage);
    },
    [paging, fetchDatabaseSchema, searchSchema, searchValue]
  );

  const onSchemaSearch = (value: string) => {
    history.push({
      search: QueryString.stringify({
        schema: isEmpty(value) ? undefined : value,
      }),
    });
    if (value) {
      searchSchema(value);
    } else {
      fetchDatabaseSchema();
    }
  };

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
        title: t('label.schema-name'),
        dataIndex: TABLE_COLUMNS_KEYS.NAME,
        key: TABLE_COLUMNS_KEYS.NAME,
        width: 250,
        render: (_, record: DatabaseSchema) => (
          <DisplayName
            allowRename={allowEditDisplayNamePermission}
            displayName={stringToHTML(
              highlightSearchText(record.displayName, searchValue)
            )}
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
      {
        title: t('label.description'),
        dataIndex: TABLE_COLUMNS_KEYS.DESCRIPTION,
        key: TABLE_COLUMNS_KEYS.DESCRIPTION,
        render: (text: string) =>
          text?.trim() ? (
            <RichTextEditorPreviewerV1 markdown={text} />
          ) : (
            <span className="text-grey-muted">
              {t('label.no-entity', { entity: t('label.description') })}
            </span>
          ),
      },
      {
        title: t('label.owner-plural'),
        dataIndex: TABLE_COLUMNS_KEYS.OWNERS,
        key: TABLE_COLUMNS_KEYS.OWNERS,
        width: 120,
        render: (owners: EntityReference[]) =>
          !isEmpty(owners) && owners.length > 0 ? (
            <OwnerLabel owners={owners} />
          ) : (
            <Typography.Text data-testid="no-owner-text">
              {NO_DATA_PLACEHOLDER}
            </Typography.Text>
          ),
      },
      {
        title: t('label.usage'),
        dataIndex: TABLE_COLUMNS_KEYS.USAGE_SUMMARY,
        key: TABLE_COLUMNS_KEYS.USAGE_SUMMARY,
        width: 120,
        render: (text: UsageDetails) =>
          getUsagePercentile(text?.weeklyStats?.percentileRank ?? 0),
      },
    ],
    [handleDisplayNameUpdate, allowEditDisplayNamePermission]
  );

  const handleEditTable = () => {
    history.push({
      pathname: getEntityBulkEditPath(EntityType.DATABASE, decodedDatabaseFQN),
    });
  };

  useEffect(() => {
    fetchDatabaseSchema();
  }, [decodedDatabaseFQN, pageSize, showDeletedSchemas, isDatabaseDeleted]);

  return (
    <Row gutter={[16, 16]}>
      <Col span={12}>
        <Searchbar
          removeMargin
          placeholder={t('label.search-for-type', {
            type: t('label.schema'),
          })}
          searchValue={searchValue}
          typingInterval={500}
          onSearch={onSchemaSearch}
        />
      </Col>
      <Col className="flex items-center justify-end" span={12}>
        <Switch
          checked={showDeletedSchemas}
          data-testid="show-deleted"
          onClick={handleShowDeletedSchemas}
        />
        <Typography.Text className="m-l-xs">
          {t('label.deleted')}
        </Typography.Text>{' '}
      </Col>
      <Col span={24}>
        <Table
          bordered
          columns={schemaTableColumns}
          data-testid="database-databaseSchemas"
          dataSource={schemas}
          defaultVisibleColumns={DEFAULT_DATABASE_SCHEMA_VISIBLE_COLUMNS}
          extraTableFilters={getBulkEditButton(
            permissions.databaseSchema.EditAll,
            handleEditTable
          )}
          loading={isLoading}
          locale={{
            emptyText: <ErrorPlaceHolder className="m-y-md" />,
          }}
          pagination={false}
          rowKey="id"
          size="small"
          staticVisibleColumns={COMMON_STATIC_TABLE_VISIBLE_COLUMNS}
        />
      </Col>
      <Col span={24}>
        {showPagination && (
          <NextPrevious
            currentPage={currentPage}
            isLoading={isLoading}
            isNumberBased={Boolean(searchValue)}
            pageSize={pageSize}
            paging={paging}
            pagingHandler={handleSchemaPageChange}
            onShowSizeChange={handlePageSizeChange}
          />
        )}
      </Col>
    </Row>
  );
};
