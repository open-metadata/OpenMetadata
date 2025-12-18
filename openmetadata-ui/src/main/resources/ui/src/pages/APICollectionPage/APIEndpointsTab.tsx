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
import { Link } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import TableAntd from '../../components/common/Table/Table';
import { useGenericContext } from '../../components/Customization/GenericProvider/GenericProvider';
import { API_COLLECTION_API_ENDPOINTS } from '../../constants/APICollection.constants';
import {
  INITIAL_PAGING_VALUE,
  NO_DATA,
  PAGE_SIZE,
} from '../../constants/constants';
import {
  COMMON_STATIC_TABLE_VISIBLE_COLUMNS,
  DEFAULT_API_ENDPOINT_TAB_VISIBLE_COLUMNS,
  TABLE_COLUMNS_KEYS,
} from '../../constants/TableKeys.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { APICollection } from '../../generated/entity/data/apiCollection';
import { APIEndpoint } from '../../generated/entity/data/apiEndpoint';
import { Include } from '../../generated/type/include';
import { usePaging } from '../../hooks/paging/usePaging';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import { useFqn } from '../../hooks/useFqn';
import { useTableFilters } from '../../hooks/useTableFilters';
import {
  getApiEndPoints,
  GetApiEndPointsType,
} from '../../rest/apiEndpointsAPI';
import { searchQuery } from '../../rest/searchAPI';
import { buildSchemaQueryFilter } from '../../utils/DatabaseSchemaDetailsUtils';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import {
  getColumnSorter,
  getEntityName,
  highlightSearchText,
} from '../../utils/EntityUtils';
import { stringToHTML } from '../../utils/StringsUtils';
import { descriptionTableObject } from '../../utils/TableColumn.util';
import { showErrorToast } from '../../utils/ToastUtils';

interface APIEndpointsTabProps {
  isVersionView?: boolean;
  isCustomizationPage?: boolean;
}

function APIEndpointsTab({
  isVersionView = false,
  isCustomizationPage = false,
}: Readonly<APIEndpointsTabProps>) {
  const { t } = useTranslation();
  const location = useCustomLocation();
  const { fqn: decodedAPICollectionFQN } = useFqn();
  const { data: apiCollection } = useGenericContext<APICollection>();
  const [apiEndpoints, setAPIEndpoints] = useState<APIEndpoint[]>([]);
  const [apiEndpointsLoading, setAPIEndpointsLoading] =
    useState<boolean>(false);
  const {
    paging,
    handlePageChange,
    currentPage,
    showPagination,
    pageSize,
    handlePagingChange,
    handlePageSizeChange,
    pagingCursor,
  } = usePaging();
  const { filters, setFilters } = useTableFilters({
    showDeletedEndpoints: false,
  });

  const searchValue = useMemo(() => {
    const param = location.search;
    const searchData = QueryString.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return searchData.endpoint as string | undefined;
  }, [location.search]);

  const searchAPIEndpoints = useCallback(
    async (searchValue: string, pageNumber = INITIAL_PAGING_VALUE) => {
      setAPIEndpointsLoading(true);
      handlePageChange(pageNumber, {
        cursorType: null,
        cursorValue: undefined,
      });
      try {
        const response = await searchQuery({
          query: '',
          pageNumber,
          pageSize: PAGE_SIZE,
          queryFilter: buildSchemaQueryFilter(
            'apiCollection.fullyQualifiedName',
            decodedAPICollectionFQN,
            searchValue
          ),
          searchIndex: SearchIndex.API_ENDPOINT_INDEX,
          includeDeleted: filters.showDeletedEndpoints,
          trackTotalHits: true,
        });
        const data = response.hits.hits.map((endpoint) => endpoint._source);
        const total = response.hits.total.value;
        setAPIEndpoints(data);
        handlePagingChange({ total });
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setAPIEndpointsLoading(false);
      }
    },
    [decodedAPICollectionFQN, filters.showDeletedEndpoints, handlePagingChange]
  );

  const getAPICollectionEndpoints = useCallback(
    async (params?: Pick<GetApiEndPointsType, 'paging'>) => {
      if (!apiCollection) {
        return;
      } else if (isCustomizationPage) {
        setAPIEndpoints(API_COLLECTION_API_ENDPOINTS);

        return;
      }

      setAPIEndpointsLoading(true);
      try {
        const res = await getApiEndPoints({
          ...params,
          fields: TabSpecificField.OWNERS,
          apiCollection: decodedAPICollectionFQN,
          service: apiCollection?.service?.fullyQualifiedName ?? '',
          include: filters.showDeletedEndpoints
            ? Include.Deleted
            : Include.NonDeleted,
        });
        setAPIEndpoints(res.data);
        handlePagingChange(res.paging);
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setAPIEndpointsLoading(false);
      }
    },
    [decodedAPICollectionFQN, filters.showDeletedEndpoints, apiCollection]
  );

  const tableColumn: ColumnsType<APIEndpoint> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: TABLE_COLUMNS_KEYS.NAME,
        key: TABLE_COLUMNS_KEYS.NAME,
        width: 400,
        sorter: getColumnSorter<APIEndpoint, 'name'>('name'),
        render: (_, record: APIEndpoint) => {
          return (
            <div className="d-inline-flex w-max-90">
              <Link
                className="break-word"
                data-testid={record.name}
                to={entityUtilClassBase.getEntityLink(
                  EntityType.API_ENDPOINT,
                  record.fullyQualifiedName as string
                )}>
                {stringToHTML(
                  highlightSearchText(getEntityName(record), searchValue)
                )}
              </Link>
            </div>
          );
        },
      },
      {
        title: t('label.request-method'),
        dataIndex: TABLE_COLUMNS_KEYS.REQUEST_METHOD,
        key: TABLE_COLUMNS_KEYS.REQUEST_METHOD,

        render: (requestMethod: APIEndpoint['requestMethod']) => {
          return <Typography.Text>{requestMethod ?? NO_DATA}</Typography.Text>;
        },
      },
      ...descriptionTableObject(),
    ],
    [searchValue, t]
  );

  const handleEndpointsPagination = useCallback(
    ({ cursorType, currentPage }: PagingHandlerParams) => {
      if (searchValue) {
        searchAPIEndpoints(searchValue, currentPage);
        handlePageChange(currentPage);
      } else if (cursorType) {
        getAPICollectionEndpoints({
          paging: {
            [cursorType]: paging[cursorType],
          },
        });
        handlePageChange(
          currentPage,
          { cursorType, cursorValue: paging[cursorType] },
          pageSize
        );
      }
    },
    [paging, getAPICollectionEndpoints, searchAPIEndpoints, searchValue]
  );

  const onEndpointSearch = useCallback(
    (value: string) => {
      setFilters({ endpoint: isEmpty(value) ? undefined : value });
      if (value) {
        searchAPIEndpoints(value);
      } else {
        getAPICollectionEndpoints();
        handlePageChange(INITIAL_PAGING_VALUE);
      }
    },
    [setFilters, searchAPIEndpoints, getAPICollectionEndpoints]
  );

  const handleDeleteAction = () => {
    setFilters({
      ...filters,
      showDeletedEndpoints: !filters.showDeletedEndpoints,
    });
    handlePageChange(INITIAL_PAGING_VALUE, {
      cursorType: null,
      cursorValue: undefined,
    });
  };

  useEffect(() => {
    const { cursorType, cursorValue } = pagingCursor ?? {};

    if (cursorType && cursorValue) {
      getAPICollectionEndpoints({
        paging: { [cursorType]: cursorValue, limit: pageSize },
      });
    } else {
      getAPICollectionEndpoints({ paging: { limit: pageSize } });
    }
  }, [apiCollection, pageSize, pagingCursor, getAPICollectionEndpoints]);

  const searchProps = useMemo(
    () => ({
      placeholder: t('label.search-for-type', {
        type: t('label.api-endpoint'),
      }),
      typingInterval: 500,
      searchValue: searchValue,
      onSearch: onEndpointSearch,
    }),
    [onEndpointSearch, searchValue, t]
  );

  return (
    <TableAntd
      columns={tableColumn}
      customPaginationProps={{
        currentPage,
        isLoading: apiEndpointsLoading,
        showPagination,
        isNumberBased: Boolean(searchValue),
        pageSize,
        paging,
        pagingHandler: handleEndpointsPagination,
        onShowSizeChange: handlePageSizeChange,
      }}
      data-testid="databaseSchema-tables"
      dataSource={apiEndpoints}
      defaultVisibleColumns={DEFAULT_API_ENDPOINT_TAB_VISIBLE_COLUMNS}
      extraTableFilters={
        !isVersionView && (
          <span>
            <Switch
              checked={filters.showDeletedEndpoints}
              data-testid="show-deleted"
              onClick={handleDeleteAction}
            />
            <Typography.Text className="m-l-xs">
              {t('label.deleted')}
            </Typography.Text>{' '}
          </span>
        )
      }
      loading={apiEndpointsLoading}
      locale={{
        emptyText: (
          <ErrorPlaceHolder
            className="mt-0-important"
            type={ERROR_PLACEHOLDER_TYPE.NO_DATA}
          />
        ),
      }}
      pagination={false}
      rowKey="id"
      searchProps={searchProps}
      size="small"
      staticVisibleColumns={COMMON_STATIC_TABLE_VISIBLE_COLUMNS}
    />
  );
}

export default APIEndpointsTab;
