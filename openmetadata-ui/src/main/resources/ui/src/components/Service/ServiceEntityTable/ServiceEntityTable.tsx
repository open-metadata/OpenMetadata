/*
 *  Copyright 2025 Collate.
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
import { ServiceTypes } from 'Models';
import QueryString from 'qs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  INITIAL_PAGING_VALUE,
  INITIAL_TABLE_FILTERS,
} from '../../../constants/constants';
import { TABLE_SCROLL_VALUE } from '../../../constants/Table.constants';
import {
  COMMON_STATIC_TABLE_VISIBLE_COLUMNS,
  DEFAULT_SERVICE_TAB_VISIBLE_COLUMNS,
} from '../../../constants/TableKeys.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { usePaging } from '../../../hooks/paging/usePaging';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { useFqn } from '../../../hooks/useFqn';
import { useTableFilters } from '../../../hooks/useTableFilters';
import { ServicePageData } from '../../../pages/ServiceDetailsPage/ServiceDetailsPage.interface';
import { searchQuery } from '../../../rest/searchAPI';
import {
  callServicePatchAPI,
  getServiceMainTabColumns,
} from '../../../utils/ServiceMainTabContentUtils';
import { buildSchemaQueryFilter } from '../../../utils/DatabaseSchemaDetailsUtils';
import { t } from '../../../utils/i18next/LocalUtil';
import {
  getCountLabel,
  getSearchIndexForService,
} from '../../../utils/ServiceUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import Table from '../../common/Table/Table';
import { EntityName } from '../../Modals/EntityNameModal/EntityNameModal.interface';

interface ServiceEntityTableProps {
  isCustomizationPage?: boolean;
}

const ServiceEntityTable = ({
  isCustomizationPage = false,
}: ServiceEntityTableProps) => {
  const routeParams = useParams<{ serviceCategory?: string }>();
  const serviceCategory = (routeParams.serviceCategory ?? '') as ServiceTypes;
  const { fqn: decodedServiceFQN } = useFqn();
  const { permissions } = usePermissionProvider();
  const location = useCustomLocation();

  const [entities, setEntities] = useState<ServicePageData[]>([]);
  const entitiesRef = useRef<ServicePageData[]>(entities);
  entitiesRef.current = entities;
  const [isLoading, setIsLoading] = useState(true);
  const { filters, setFilters } = useTableFilters(INITIAL_TABLE_FILTERS);
  const { showDeletedTables: showDeleted } = filters;
  const pagingInfo = usePaging();
  const {
    paging,
    pageSize,
    currentPage,
    handlePageChange,
    handlePagingChange,
  } = pagingInfo;

  const searchValue = useMemo(() => {
    const param = location.search;
    const searchData = QueryString.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return searchData.schema as string | undefined;
  }, [location.search]);

  const fetchEntities = useCallback(
    async (pageNumber: number = INITIAL_PAGING_VALUE) => {
      if (!serviceCategory || !decodedServiceFQN) {
        setIsLoading(false);

        return;
      }

      const searchIndex = getSearchIndexForService(serviceCategory);

      try {
        setIsLoading(true);
        const res = await searchQuery({
          pageNumber,
          pageSize,
          searchIndex,
          query: '',
          queryFilter: buildSchemaQueryFilter(
            'service.fullyQualifiedName.keyword',
            decodedServiceFQN,
            searchValue
          ),
          includeDeleted: showDeleted,
          trackTotalHits: true,
        });
        const items = res.hits.hits.map(
          (hit) => hit._source as ServicePageData
        );
        const total = res.hits.total.value;

        setEntities(items);
        handlePagingChange({ total });
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [
      serviceCategory,
      pageSize,
      decodedServiceFQN,
      searchValue,
      showDeleted,
      handlePagingChange,
    ]
  );

  const handleDisplayNameUpdate = useCallback(
    async (entityData: EntityName, id?: string) => {
      try {
        const pageDataDetails = entitiesRef.current.find(
          (data) => data.id === id
        );
        if (!pageDataDetails) {
          return;
        }
        const updatedData = {
          ...pageDataDetails,
          displayName: entityData.displayName ?? undefined,
        };
        const jsonPatch = compare(pageDataDetails, updatedData);
        const response = await callServicePatchAPI(
          serviceCategory,
          pageDataDetails.id,
          jsonPatch
        );
        setEntities((prevData) =>
          prevData.map((data) =>
            data.id === id && response ? response : data
          )
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [serviceCategory]
  );

  const editDisplayNamePermission = useMemo(() => {
    if (isCustomizationPage) {
      return false;
    }

    const servicePermissions: Record<string, { EditAll?: boolean; EditDisplayName?: boolean } | undefined> = {
      databaseServices: permissions.databaseService,
      messagingServices: permissions.messagingService,
      dashboardServices: permissions.dashboardService,
      pipelineServices: permissions.pipelineService,
      mlmodelServices: permissions.mlmodelService,
      storageServices: permissions.storageService,
      searchServices: permissions.searchService,
      apiServices: permissions.apiService,
      driveServices: permissions.driveService,
    };

    const currentPermission = servicePermissions[serviceCategory];

    return (
      currentPermission?.EditAll || currentPermission?.EditDisplayName || false
    );
  }, [permissions, serviceCategory, isCustomizationPage]);

  const tableColumns: ColumnsType<ServicePageData> = useMemo(
    () =>
      getServiceMainTabColumns(
        serviceCategory,
        editDisplayNamePermission,
        handleDisplayNameUpdate,
        searchValue
      ),
    [
      serviceCategory,
      handleDisplayNameUpdate,
      editDisplayNamePermission,
      searchValue,
    ]
  );

  const handleShowDeleted = useCallback(
    (value: boolean) => {
      setFilters({ showDeletedTables: value });
      handlePageChange(INITIAL_PAGING_VALUE, {
        cursorType: null,
        cursorValue: undefined,
      });
    },
    [handlePageChange, setFilters]
  );

  const onServiceSearch = useCallback(
    (value: string) => {
      setFilters({ schema: isEmpty(value) ? undefined : value });
      handlePageChange(INITIAL_PAGING_VALUE, {
        cursorType: null,
        cursorValue: undefined,
      });
    },
    [handlePageChange, setFilters]
  );

  const tablePaginationHandler = useCallback(
    ({ currentPage }: PagingHandlerParams) => {
      handlePageChange(currentPage);
    },
    [handlePageChange]
  );

  const searchProps = useMemo(
    () => ({
      placeholder: t('label.search-for-type', {
        type: getCountLabel(serviceCategory),
      }),
      typingInterval: 500,
      searchValue,
      onSearch: onServiceSearch,
    }),
    [onServiceSearch, serviceCategory, searchValue]
  );

  useEffect(() => {
    if (isCustomizationPage) {
      setEntities([]);
      setIsLoading(false);

      return;
    }
    fetchEntities(currentPage);
  }, [currentPage, isCustomizationPage, fetchEntities]);

  return (
    <Table
      columns={tableColumns}
      customPaginationProps={{
        currentPage,
        isLoading,
        isNumberBased: true,
        showPagination: pagingInfo.showPagination,
        pageSize: pagingInfo.pageSize,
        paging,
        pagingHandler: tablePaginationHandler,
        onShowSizeChange: pagingInfo.handlePageSizeChange,
      }}
      data-testid="service-children-table"
      dataSource={entities}
      defaultVisibleColumns={DEFAULT_SERVICE_TAB_VISIBLE_COLUMNS}
      entityType={serviceCategory}
      extraTableFilters={
        <span>
          <Switch
            checked={showDeleted}
            data-testid="show-deleted"
            onClick={handleShowDeleted}
          />
          <Typography.Text className="m-l-xs">
            {t('label.deleted')}
          </Typography.Text>
        </span>
      }
      loading={isLoading}
      pagination={false}
      rowKey="id"
      scroll={TABLE_SCROLL_VALUE}
      searchProps={searchProps}
      size="small"
      staticVisibleColumns={COMMON_STATIC_TABLE_VISIBLE_COLUMNS}
    />
  );
};

export default ServiceEntityTable;
