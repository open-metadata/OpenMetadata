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

import { Button, Col, Row, Space, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isUndefined } from 'lodash';
import Qs from 'qs';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../components/PermissionProvider/PermissionProvider.interface';
import { USAGE_DOCS } from '../../constants/docs.constants';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import {
  QUERY_PAGE_ERROR_STATE,
  QUERY_PAGE_LOADING_STATE,
} from '../../constants/Query.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { Query } from '../../generated/entity/data/query';
import { usePaging } from '../../hooks/paging/usePaging';
import {
  getQueriesList,
  getQueryById,
  ListQueriesParams,
  patchQueries,
  updateQueryVote,
} from '../../rest/queryAPI';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import {
  parseSearchParams,
  stringifySearchParams,
} from '../../utils/Query/QueryUtils';
import { getAddQueryPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import ErrorPlaceHolder from '../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import NextPrevious from '../common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../common/NextPrevious/NextPrevious.interface';
import Loader from '../Loader/Loader';
import QueryCard from './QueryCard';
import { QueryVote, TableQueriesProp } from './TableQueries.interface';
import TableQueryRightPanel from './TableQueryRightPanel/TableQueryRightPanel.component';

const TableQueries: FC<TableQueriesProp> = ({
  isTableDeleted,
  tableId,
}: TableQueriesProp) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { fqn: datasetFQN } = useParams<{ fqn: string }>();
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

  const {
    currentPage,
    handlePageChange,
    pageSize,
    handlePageSizeChange,
    paging,
    handlePagingChange,
    showPagination,
  } = usePaging();

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
    } catch (error) {
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
        return {
          ...pre,
          data: pre.map((query) =>
            query.id === updatedQuery.id ? { ...query, ...res } : query
          ),
        };
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const updateVote = async (data: QueryVote, id?: string) => {
    try {
      await updateQueryVote(id ?? '', data);
      const response = await getQueryById(id ?? '', {
        fields: 'owner,votes,tags,queryUsedIn,users',
      });
      setSelectedQuery(response);
      setTableQueries((pre) => {
        return {
          ...pre,
          data: pre.map((query) =>
            query.id === response.id ? response : query
          ),
        };
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };
  const fetchTableQuery = async (
    params?: ListQueriesParams,
    activePage?: number
  ) => {
    setIsLoading((pre) => ({ ...pre, query: true }));
    try {
      const { data: queries, paging } = await getQueriesList({
        ...params,
        limit: pageSize,
        entityId: tableId,
        fields: 'owner,votes,tags,queryUsedIn,users',
      });
      if (queries.length === 0) {
        setIsError((pre) => ({ ...pre, page: true }));
      } else {
        setTableQueries(queries);
        const selectedQueryData = searchParams.query
          ? queries.find((query) => query.id === searchParams.query) ||
            queries[0]
          : queries[0];
        setSelectedQuery(selectedQueryData);
        handlePagingChange(paging);
        history.push({
          search: stringifySearchParams({
            tableId,
            after: params?.after,
            query: selectedQueryData.id,
            queryFrom: activePage,
          }),
        });
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
      setIsError((pre) => ({ ...pre, page: true }));
    } finally {
      setIsLoading((pre) => ({ ...pre, query: false }));
    }
  };

  const pagingHandler = ({ cursorType, currentPage }: PagingHandlerParams) => {
    if (cursorType) {
      fetchTableQuery({ [cursorType]: paging[cursorType] }, currentPage);
      handlePageChange(currentPage);
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

  useEffect(() => {
    setIsLoading((pre) => ({ ...pre, page: true }));
    if (tableId && !isTableDeleted) {
      fetchTableQuery({ after: searchParams?.after }).finally(() => {
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
      <div className="flex-center font-medium mt-24" data-testid="no-queries">
        <ErrorPlaceHolder
          buttonId="add-query-btn"
          doc={USAGE_DOCS}
          heading={t('label.query-lowercase-plural')}
          permission={permissions?.query.Create}
          type={ERROR_PLACEHOLDER_TYPE.CREATE}
          onClick={handleAddQueryClick}
        />
      </div>
    );
  }

  if (isTableDeleted) {
    return (
      <div className="flex-center font-medium mt-24" data-testid="no-queries">
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
      className="flex-center font-medium mt-24"
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
          afterDeleteAction={fetchTableQuery}
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
    <Row gutter={8} id="tablequeries" wrap={false}>
      <Col flex="auto">
        <Row
          className="p-x-md m-t-md"
          data-testid="queries-container"
          gutter={[8, 16]}>
          <Col span={24}>
            <Space className="justify-end w-full">{addButton}</Space>
          </Col>

          {isLoading.query ? <Loader /> : queryTabBody}

          <Col span={24}>
            {showPagination && (
              <NextPrevious
                currentPage={currentPage}
                pageSize={pageSize}
                paging={paging}
                pagingHandler={pagingHandler}
                onShowSizeChange={handlePageSizeChange}
              />
            )}
          </Col>
        </Row>
      </Col>
      <Col flex="400px">
        {selectedQuery && (
          <TableQueryRightPanel
            isLoading={isLoading.rightPanel}
            permission={queryPermissions}
            query={selectedQuery}
            onQueryUpdate={handleQueryUpdate}
          />
        )}
      </Col>
    </Row>
  );
};

export default TableQueries;
