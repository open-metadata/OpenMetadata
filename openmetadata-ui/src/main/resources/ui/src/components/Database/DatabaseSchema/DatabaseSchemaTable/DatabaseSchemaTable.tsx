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
import { AxiosError } from 'axios';
import { t } from 'i18next';
import { isEmpty } from 'lodash';
import QueryString from 'qs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE,
} from '../../../../constants/constants';
import { SearchIndex } from '../../../../enums/search.enum';
import { DatabaseSchema } from '../../../../generated/entity/data/databaseSchema';
import { Include } from '../../../../generated/type/include';
import { Paging } from '../../../../generated/type/paging';
import { usePaging } from '../../../../hooks/paging/usePaging';
import { getDatabaseSchemas } from '../../../../rest/databaseAPI';
import { searchQuery } from '../../../../rest/searchAPI';
import { schemaTableColumns } from '../../../../utils/DatabaseDetails.utils';
import { getDecodedFqn } from '../../../../utils/StringsUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import NextPrevious from '../../../common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../../common/NextPrevious/NextPrevious.interface';
import Searchbar from '../../../common/SearchBarComponent/SearchBar.component';
import Table from '../../../common/Table/Table';

export const DatabaseSchemaTable = () => {
  const { fqn } = useParams<{ fqn: string }>();
  const history = useHistory();
  const location = useLocation();
  const [schemas, setSchemas] = useState<DatabaseSchema[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeletedSchemas, setShowDeletedSchemas] = useState<boolean>(false);

  const decodedDatabaseFQN = useMemo(() => getDecodedFqn(fqn), [fqn]);
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
          fields: ['owner', 'usageSummary'],
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
              must: [{ term: { 'database.fullyQualifiedName': fqn } }],
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
      if (cursorType) {
        fetchDatabaseSchema({ [cursorType]: paging[cursorType] });
      }
      handlePageChange(currentPage);
    },
    [paging, fetchDatabaseSchema]
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

  useEffect(() => {
    fetchDatabaseSchema();
  }, [fqn, pageSize, showDeletedSchemas]);

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
          loading={isLoading}
          locale={{
            emptyText: <ErrorPlaceHolder className="m-y-md" />,
          }}
          pagination={false}
          rowKey="id"
          size="small"
        />
      </Col>
      <Col span={24}>
        {showPagination && (
          <NextPrevious
            currentPage={currentPage}
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
