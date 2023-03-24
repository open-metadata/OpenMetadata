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

import { Col, Row } from 'antd';
import { AxiosError } from 'axios';
import NextPrevious from 'components/common/next-previous/NextPrevious';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import { SearchDropdownOption } from 'components/SearchDropdown/SearchDropdown.interface';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE,
  pagingObject,
} from 'constants/constants';
import {
  QUERY_PAGE_ERROR_STATE,
  QUERY_PAGE_LOADING_STATE,
} from 'constants/Query.constant';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { SearchIndex } from 'enums/search.enum';
import { compare } from 'fast-json-patch';
import { Query } from 'generated/entity/data/query';
import { isString, isUndefined } from 'lodash';
import { PagingResponse } from 'Models';
import React, { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getQueriesList,
  getQueryById,
  ListQueriesParams,
  patchQueries,
  updateQueryVote,
} from 'rest/queryAPI';
import { searchQuery } from 'rest/searchAPI';
import { DEFAULT_ENTITY_PERMISSION } from 'utils/PermissionsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import Loader from '../Loader/Loader';
import QueryCard from './QueryCard';
import QueryFilters from './QueryFilters/QueryFilters.component';
import { QueryVote, TableQueriesProp } from './TableQueries.interface';
import TableQueryRightPanel from './TableQueryRightPanel/TableQueryRightPanel.component';

const TableQueries: FC<TableQueriesProp> = ({
  isTableDeleted,
  tableId,
}: TableQueriesProp) => {
  const { t } = useTranslation();

  const [tableQueries, setTableQueries] = useState<PagingResponse<Query[]>>({
    data: [],
    paging: pagingObject,
  });
  const [isLoading, setIsLoading] = useState(QUERY_PAGE_LOADING_STATE);
  const [isError, setIsError] = useState(QUERY_PAGE_ERROR_STATE);
  const [selectedQuery, setSelectedQuery] = useState<Query>();
  const [queryPermissions, setQueryPermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );
  const [currentPage, setCurrentPage] = useState(INITIAL_PAGING_VALUE);
  const [appliedFilter, setAppliedFilter] = useState<SearchDropdownOption[]>(
    []
  );

  const { getEntityPermission } = usePermissionProvider();

  const fetchResourcePermission = async () => {
    if (isUndefined(selectedQuery)) {
      return;
    }
    setIsLoading((pre) => ({ ...pre, rightPanel: true }));

    try {
      const permission = await getEntityPermission(
        ResourceEntity.QUERY,
        selectedQuery.id || ''
      );
      setQueryPermissions(permission);
    } catch (error) {
      showErrorToast(
        t('label.fetch-entity-permissions-error', {
          entity: t('label.resource-permission-lowercase'),
        })
      );
    } finally {
      setIsLoading((pre) => ({ ...pre, rightPanel: false }));
    }
  };

  useEffect(() => {
    if (selectedQuery && selectedQuery.id) {
      fetchResourcePermission();
    }
  }, [selectedQuery]);

  const fetchTableQuery = async (params?: ListQueriesParams) => {
    setIsLoading((pre) => ({ ...pre, query: true }));
    try {
      const queries = await getQueriesList({
        ...params,
        limit: PAGE_SIZE,
        entityId: tableId,
        fields: 'owner,votes,tags,queryUsedIn',
      });
      setTableQueries(queries);
      setSelectedQuery(queries.data[0]);
    } catch (error) {
      showErrorToast(error as AxiosError);
      setIsError((pre) => ({ ...pre, page: true }));
    } finally {
      setIsLoading((pre) => ({ ...pre, query: false }));
    }
  };

  const handleQueryUpdate = async (updatedQuery: Query, key: keyof Query) => {
    if (isUndefined(selectedQuery)) {
      return;
    }

    const jsonPatch = compare(selectedQuery, updatedQuery);

    try {
      const res = await patchQueries(selectedQuery.id || '', jsonPatch);
      setSelectedQuery((pre) => (pre ? { ...pre, [key]: res[key] } : res));
      setTableQueries((pre) => {
        return {
          ...pre,
          data: pre.data.map((query) =>
            query.id === updatedQuery.id ? { ...query, [key]: res[key] } : query
          ),
        };
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const updateVote = async (data: QueryVote, id?: string) => {
    try {
      await updateQueryVote(id || '', data);
      const response = await getQueryById(id || '', {
        fields: 'owner,votes,tags,queryUsedIn',
      });
      setSelectedQuery(response);
      setTableQueries((pre) => {
        return {
          ...pre,
          data: pre.data.map((query) =>
            query.id === response.id ? response : query
          ),
        };
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };
  const fetchFilterData = async (
    value: SearchDropdownOption[],
    page?: number
  ) => {
    setIsLoading((pre) => ({ ...pre, query: true }));
    try {
      const res = await searchQuery({
        searchIndex: SearchIndex.QUERY,
        queryFilter: {
          query: {
            bool: {
              must: [
                { term: { 'queryUsedIn.id': tableId } },
                {
                  bool: {
                    should: value.map((data) => ({
                      term: { 'owner.id': data.key },
                    })),
                  },
                },
              ],
            },
          },
        },
        pageNumber: page || currentPage,
        pageSize: PAGE_SIZE,
        includeDeleted: false,
      });

      const queries = res.hits.hits.map((value) => value._source) as Query[];
      setTableQueries({
        data: queries,
        paging: {
          total: res.hits.total.value,
        },
      });
      setSelectedQuery(queries[0]);
      if (queries.length === 0) {
        setIsError((pre) => ({ ...pre, search: true }));
      }
    } catch (error) {
      setIsError((pre) => ({ ...pre, search: true }));
    } finally {
      setIsLoading((pre) => ({ ...pre, query: false }));
    }
  };

  const pagingHandler = (cursorType: string | number, activePage?: number) => {
    if (isString(cursorType)) {
      const { paging } = tableQueries;
      fetchTableQuery({ [cursorType]: paging[cursorType] });
      activePage && setCurrentPage(activePage);
    } else {
      setCurrentPage(cursorType);
      fetchFilterData(appliedFilter, cursorType);
    }
  };

  const handleSelectedQuery = (query: Query) => {
    if (query.id !== selectedQuery?.id) {
      setIsLoading((pre) => ({ ...pre, rightPanel: true }));
      setSelectedQuery(query);
    }
  };

  useEffect(() => {
    setIsLoading((pre) => ({ ...pre, page: true }));
    if (tableId && !isTableDeleted) {
      fetchTableQuery().finally(() => {
        setIsLoading((pre) => ({ ...pre, page: false }));
      });
    } else {
      setIsLoading((pre) => ({ ...pre, page: false }));
    }
  }, [tableId]);

  const onOwnerFilterChange = (value: SearchDropdownOption[]) => {
    setIsError((pre) => ({ ...pre, search: false }));
    setAppliedFilter(value);
    if (value.length) {
      fetchFilterData(value);
    } else {
      fetchTableQuery();
    }
  };

  if (isLoading.page) {
    return <Loader />;
  }
  if (isError.page) {
    return (
      <div className="flex-center font-medium" data-testid="no-queries">
        <ErrorPlaceHolder heading="queries" />
      </div>
    );
  }

  return (
    <Row className="h-full" id="tablequeries">
      <Col span={18}>
        <Row
          className="p-r-lg m-t-md"
          data-testid="queries-container"
          gutter={[8, 16]}>
          <Col span={24}>
            <QueryFilters onFilterChange={onOwnerFilterChange} />
          </Col>

          {isLoading.query ? (
            <Loader />
          ) : isError.search ? (
            <Col
              className="flex-center font-medium"
              data-testid="no-queries"
              span={24}>
              <ErrorPlaceHolder
                heading="queries"
                type={ERROR_PLACEHOLDER_TYPE.VIEW}
              />
            </Col>
          ) : (
            tableQueries.data.map((query) => (
              <Col key={query.id} span={24}>
                <QueryCard
                  permission={queryPermissions}
                  query={query}
                  selectedId={selectedQuery?.id}
                  tableId={tableId}
                  onQuerySelection={handleSelectedQuery}
                  onQueryUpdate={handleQueryUpdate}
                  onUpdateVote={updateVote}
                />
              </Col>
            ))
          )}
          <Col span={24}>
            {tableQueries.paging.total > PAGE_SIZE && (
              <NextPrevious
                currentPage={currentPage}
                isNumberBased={Boolean(appliedFilter.length)}
                pageSize={PAGE_SIZE}
                paging={tableQueries.paging}
                pagingHandler={pagingHandler}
                totalCount={tableQueries.paging.total}
              />
            )}
          </Col>
        </Row>
      </Col>
      <Col className="bg-white border-main border-1 border-t-0" span={6}>
        {selectedQuery && (
          <div className="sticky top-0">
            <TableQueryRightPanel
              isLoading={isLoading.rightPanel}
              permission={queryPermissions}
              query={selectedQuery}
              onQueryUpdate={handleQueryUpdate}
            />
          </div>
        )}
      </Col>
    </Row>
  );
};

export default TableQueries;
