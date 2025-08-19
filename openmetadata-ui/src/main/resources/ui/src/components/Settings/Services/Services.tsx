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

import { Button, Col, Row, Space, Typography } from 'antd';
import { Tooltip } from '../../common/AntdCompat';;
import Card from 'antd/lib/card/Card';
import { ColumnsType, TableProps } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { isEmpty, map, startCase } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import {
  DISABLED,
  INITIAL_PAGING_VALUE,
  pagingObject,
} from '../../../constants/constants';
import { CONNECTORS_DOCS } from '../../../constants/docs.constants';
import { NO_PERMISSION_FOR_ACTION } from '../../../constants/HelperTextUtil';
import { PAGE_HEADERS } from '../../../constants/PageHeaders.constant';
import {
  OPEN_METADATA,
  servicesDisplayName,
} from '../../../constants/Services.constant';
import { TABLE_COLUMNS_KEYS } from '../../../constants/TableKeys.constants';
import { useAirflowStatus } from '../../../context/AirflowStatusProvider/AirflowStatusProvider';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { Operation } from '../../../generated/entity/policies/policy';
import { Include } from '../../../generated/type/include';
import LimitWrapper from '../../../hoc/LimitWrapper';
import { usePaging } from '../../../hooks/paging/usePaging';
import { DatabaseServiceSearchSource } from '../../../interface/search.interface';
import { ServicesType } from '../../../interface/service.interface';
import { getServices, searchService } from '../../../rest/serviceAPI';
import { getServiceLogo } from '../../../utils/CommonUtils';
import { getEntityName, highlightSearchText } from '../../../utils/EntityUtils';
import { checkPermission } from '../../../utils/PermissionsUtils';
import {
  getAddServicePath,
  getServiceDetailsPath,
} from '../../../utils/RouterUtils';
import {
  getOptionalFields,
  getResourceEntityFromServiceCategory,
  getServiceTypesFromServiceCategory,
} from '../../../utils/ServiceUtils';
import { stringToHTML } from '../../../utils/StringsUtils';
import {
  columnFilterIcon,
  ownerTableObject,
} from '../../../utils/TableColumn.util';
import { showErrorToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { ListView } from '../../common/ListView/ListView.component';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import RichTextEditorPreviewerV1 from '../../common/RichTextEditor/RichTextEditorPreviewerV1';
import RichTextEditorPreviewerNew from '../../common/RichTextEditor/RichTextEditorPreviewNew';
import ButtonSkeleton from '../../common/Skeleton/CommonSkeletons/ControlElements/ControlElements.component';
import { ColumnFilter } from '../../Database/ColumnFilter/ColumnFilter.component';
import PageHeader from '../../PageHeader/PageHeader.component';

interface ServicesProps {
  serviceName: ServiceCategory;
}

const Services = ({ serviceName }: ServicesProps) => {
  const { t } = useTranslation();
  const { isFetchingStatus, platform } = useAirflowStatus();

  const navigate = useNavigate();
  const handleAddServiceClick = () => {
    navigate(getAddServicePath(serviceName));
  };

  const [isLoading, setIsLoading] = useState(true);
  const [serviceDetails, setServiceDetails] = useState<ServicesType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [serviceTypeFilter, setServiceTypeFilter] =
    useState<Array<ServicesType['serviceType']>>();
  const {
    paging,
    handlePagingChange,
    currentPage,
    handlePageChange,
    pageSize,
    handlePageSizeChange,
    showPagination,
  } = usePaging();
  const [deleted, setDeleted] = useState<boolean>(false);
  const { permissions } = usePermissionProvider();

  const filterString = useMemo(() => {
    return serviceTypeFilter?.length
      ? `(${serviceTypeFilter
          .map((type) => `serviceType:${type}`)
          .join(' OR ')})`
      : undefined;
  }, [serviceTypeFilter]);

  const isPlatFormDisabled = useMemo(() => platform === DISABLED, [platform]);

  const searchIndex = useMemo(() => {
    setSearchTerm('');
    setServiceTypeFilter([]);

    switch (serviceName) {
      case ServiceCategory.DATABASE_SERVICES:
        return SearchIndex.DATABASE_SERVICE;
      case ServiceCategory.DASHBOARD_SERVICES:
        return SearchIndex.DASHBOARD_SERVICE;
      case ServiceCategory.MESSAGING_SERVICES:
        return SearchIndex.MESSAGING_SERVICE;
      case ServiceCategory.PIPELINE_SERVICES:
        return SearchIndex.PIPELINE_SERVICE;
      case ServiceCategory.ML_MODEL_SERVICES:
        return SearchIndex.ML_MODEL_SERVICE;
      case ServiceCategory.STORAGE_SERVICES:
        return SearchIndex.STORAGE_SERVICE;
      case ServiceCategory.SEARCH_SERVICES:
        return SearchIndex.SEARCH_SERVICE;
      case ServiceCategory.API_SERVICES:
        return SearchIndex.API_SERVICE_INDEX;
    }

    return SearchIndex.DATABASE_SERVICE;
  }, [serviceName]);

  const getServiceDetails = useCallback(
    async ({
      search,
      currentPage,
      after,
      before,
      filters,
    }: {
      search?: string;
      limit?: number;
      currentPage?: number;
      after?: string;
      before?: string;
      filters?: string;
    }) => {
      setIsLoading(true);
      try {
        let services = [];
        if (search || !isEmpty(filters)) {
          const {
            hits: { hits, total },
          } = await searchService({
            search,
            searchIndex,
            limit: pageSize,
            currentPage,
            filters,
            deleted,
          });

          services = hits.map(
            ({ _source }) => _source as DatabaseServiceSearchSource
          );
          handlePagingChange({ total: total.value });
        } else {
          const { data, paging } = await getServices({
            serviceName,
            limit: pageSize,
            after,
            before,
            include: deleted ? Include.Deleted : Include.NonDeleted,
          });

          services = data;
          handlePagingChange(paging);
        }

        setServiceDetails(
          serviceName === ServiceCategory.METADATA_SERVICES
            ? services.filter(
                (service) => service.fullyQualifiedName !== OPEN_METADATA
              )
            : services
        );
      } catch (error) {
        setServiceDetails([]);
        handlePagingChange(pagingObject);
        showErrorToast(
          error as AxiosError,
          t('server.entity-fetch-error', { entity: t('label.service-plural') })
        );
      } finally {
        setIsLoading(false);
      }
    },
    [searchIndex, serviceName, deleted, pageSize]
  );

  const handleServicePageChange = useCallback(
    ({ cursorType, currentPage }: PagingHandlerParams) => {
      if (searchTerm || filterString) {
        handlePageChange(currentPage);
        getServiceDetails({
          currentPage,
          search: searchTerm,
          limit: pageSize,
          filters: filterString,
        });
      } else if (cursorType) {
        handlePageChange(currentPage);
        getServiceDetails({
          [cursorType]: paging[cursorType],
          filters: filterString,
        });
      }
    },
    [getServiceDetails, searchTerm, filterString, paging, pageSize]
  );

  const addServicePermission = useMemo(
    () =>
      !isEmpty(permissions) &&
      checkPermission(
        Operation.Create,
        getResourceEntityFromServiceCategory(serviceName),
        permissions
      ),
    [permissions, serviceName]
  );

  const handleDeletedSwitchChange = useCallback(
    () => setDeleted((prevValue) => !prevValue),
    []
  );

  const getServicePageHeader = useCallback(() => {
    switch (serviceName) {
      case ServiceCategory.DATABASE_SERVICES:
        return PAGE_HEADERS.DATABASES_SERVICES;
      case ServiceCategory.DASHBOARD_SERVICES:
        return PAGE_HEADERS.DASHBOARD_SERVICES;
      case ServiceCategory.MESSAGING_SERVICES:
        return PAGE_HEADERS.MESSAGING_SERVICES;
      case ServiceCategory.METADATA_SERVICES:
        return PAGE_HEADERS.METADATA_SERVICES;
      case ServiceCategory.ML_MODEL_SERVICES:
        return PAGE_HEADERS.ML_MODELS_SERVICES;
      case ServiceCategory.PIPELINE_SERVICES:
        return PAGE_HEADERS.PIPELINES_SERVICES;
      case ServiceCategory.STORAGE_SERVICES:
        return PAGE_HEADERS.STORAGE_SERVICES;
      case ServiceCategory.SEARCH_SERVICES:
        return PAGE_HEADERS.SEARCH_SERVICES;
      case ServiceCategory.API_SERVICES:
        return PAGE_HEADERS.API_SERVICES;
      case ServiceCategory.SECURITY_SERVICES:
        return PAGE_HEADERS.SECURITY_SERVICES;
      default:
        return PAGE_HEADERS.DATABASES_SERVICES;
    }
  }, [serviceName]);

  const noDataPlaceholder = useMemo(() => {
    if (addServicePermission && isEmpty(searchTerm) && !filterString) {
      return (
        <ErrorPlaceHolder
          className="p-lg border-none"
          doc={CONNECTORS_DOCS}
          heading={servicesDisplayName[serviceName]}
          permission={addServicePermission}
          permissionValue={t('label.create-entity', {
            entity: `${servicesDisplayName[serviceName]}`,
          })}
          type={ERROR_PLACEHOLDER_TYPE.CREATE}
          onClick={handleAddServiceClick}
        />
      );
    }

    return (
      <ErrorPlaceHolder
        className="mt-24 border-none"
        type={ERROR_PLACEHOLDER_TYPE.NO_DATA}
      />
    );
  }, [
    addServicePermission,
    servicesDisplayName,
    serviceName,
    searchTerm,
    filterString,
    addServicePermission,
    handleAddServiceClick,
  ]);

  const serviceTypeFilters = useMemo(() => {
    return map(getServiceTypesFromServiceCategory(serviceName), (value) => ({
      text: startCase(value),
      value,
    }));
  }, [serviceName]);

  const customPaginationTableProps = useMemo(
    () => ({
      showPagination,
      currentPage,
      isLoading,
      isNumberBased: !isEmpty(searchTerm) || !isEmpty(serviceTypeFilter),
      pageSize,
      paging,
      pagingHandler: handleServicePageChange,
      onShowSizeChange: handlePageSizeChange,
    }),
    [
      showPagination,
      currentPage,
      isLoading,
      searchTerm,
      serviceTypeFilter,
      pageSize,
      paging,
      handleServicePageChange,
      handlePageSizeChange,
    ]
  );

  const columns: ColumnsType<ServicesType> = [
    {
      title: t('label.name'),
      dataIndex: TABLE_COLUMNS_KEYS.NAME,
      key: TABLE_COLUMNS_KEYS.NAME,
      width: 200,
      render: (name, record) => (
        <div className="d-flex gap-2 items-center">
          {getServiceLogo(record.serviceType || '', 'w-4')}
          <Link
            className="max-two-lines"
            data-testid={`service-name-${name}`}
            to={getServiceDetailsPath(
              record.fullyQualifiedName ?? record.name,
              serviceName
            )}>
            {stringToHTML(
              highlightSearchText(getEntityName(record), searchTerm)
            )}
          </Link>
        </div>
      ),
    },
    {
      title: t('label.description'),
      dataIndex: TABLE_COLUMNS_KEYS.DESCRIPTION,
      key: TABLE_COLUMNS_KEYS.DESCRIPTION,
      width: 200,
      render: (description) =>
        description ? (
          <RichTextEditorPreviewerNew
            className="max-two-lines"
            markdown={highlightSearchText(description, searchTerm)}
          />
        ) : (
          <span className="text-grey-muted">{t('label.no-description')}</span>
        ),
    },
    {
      title: t('label.type'),
      dataIndex: TABLE_COLUMNS_KEYS.SERVICE_TYPE,
      key: TABLE_COLUMNS_KEYS.SERVICE_TYPE,
      width: 200,
      filterDropdown: ColumnFilter,
      filterIcon: columnFilterIcon,
      filtered: !isEmpty(serviceTypeFilter),
      filteredValue: serviceTypeFilter,
      filters: serviceTypeFilters,
      render: (serviceType) => (
        <span className="font-normal text-grey-body">
          {stringToHTML(highlightSearchText(serviceType, searchTerm))}
        </span>
      ),
    },
    ...ownerTableObject<ServicesType>(),
  ];

  const serviceCardRenderer = (service: ServicesType) => {
    return (
      <Col key={service.name} lg={8} xl={6}>
        <Card className="w-full" size="small">
          <div
            className="d-flex justify-between text-grey-muted"
            data-testid="service-card">
            <Row gutter={[0, 6]}>
              <Col span={24}>
                <Link
                  className="no-underline"
                  to={getServiceDetailsPath(
                    service.fullyQualifiedName ?? service.name,
                    serviceName
                  )}>
                  <Typography.Text
                    className="text-base text-grey-body font-medium truncate w-48 d-inline-block"
                    data-testid={`service-name-${service.name}`}
                    title={getEntityName(service)}>
                    {getEntityName(service)}
                  </Typography.Text>
                </Link>
                <div
                  className="p-t-xs text-grey-body break-all description-text"
                  data-testid="service-description">
                  {service.description ? (
                    <RichTextEditorPreviewerV1
                      className="max-two-lines"
                      enableSeeMoreVariant={false}
                      markdown={service.description}
                    />
                  ) : (
                    <span className="text-grey-muted">
                      {t('label.no-description')}
                    </span>
                  )}
                </div>
                {getOptionalFields(service, serviceName)}
              </Col>
              <Col span={24}>
                <div className="m-b-xss" data-testid="service-type">
                  <label className="m-b-0">{`${t('label.type')}:`}</label>
                  <span className="font-normal m-l-xss text-grey-body">
                    {service.serviceType}
                  </span>
                </div>
              </Col>
            </Row>

            <div className="d-flex flex-col justify-between flex-none">
              <div className="d-flex justify-end" data-testid="service-icon">
                {getServiceLogo(service.serviceType || '', 'h-7')}
              </div>
            </div>
          </div>
        </Card>
      </Col>
    );
  };

  const handleServiceSearch = useCallback(
    async (search: string) => {
      handlePageChange(INITIAL_PAGING_VALUE);
      setSearchTerm(search);
    },
    [getServiceDetails]
  );

  useEffect(() => {
    getServiceDetails({
      search: searchTerm,
      limit: pageSize,
      filters: filterString,
    });
  }, [searchIndex, pageSize, serviceName, searchTerm, filterString, deleted]);

  const handleTableChange: TableProps<ServicesType>['onChange'] = (
    _pagination,
    filters
  ) => {
    setServiceTypeFilter(filters.serviceType as ServicesType['serviceType'][]);
  };

  return (
    <Row
      className="justify-center"
      data-testid="services-container"
      gutter={[16, 16]}>
      <Col span={24}>
        <Space className="w-full justify-between m-b-lg" data-testid="header">
          <PageHeader data={getServicePageHeader()} />
          {isFetchingStatus ? (
            <ButtonSkeleton size="default" />
          ) : (
            <Tooltip
              placement="left"
              title={
                addServicePermission
                  ? t('label.add-entity', {
                      entity: t('label.service'),
                    })
                  : NO_PERMISSION_FOR_ACTION
              }>
              {addServicePermission && !isPlatFormDisabled && (
                <LimitWrapper resource="dataAssets">
                  <Button
                    className="m-b-xs"
                    data-testid="add-service-button"
                    size="middle"
                    type="primary"
                    onClick={handleAddServiceClick}>
                    {t('label.add-new-entity', {
                      entity: t('label.service'),
                    })}
                  </Button>
                </LimitWrapper>
              )}
            </Tooltip>
          )}
        </Space>
      </Col>
      <Col span={24}>
        <ListView<ServicesType>
          cardRenderer={serviceCardRenderer}
          customPaginationProps={customPaginationTableProps}
          deleted={deleted}
          handleDeletedSwitchChange={handleDeletedSwitchChange}
          searchProps={{
            onSearch: handleServiceSearch,
            search: searchTerm,
          }}
          tableProps={{
            columns,
            dataSource: serviceDetails,
            rowKey: 'fullyQualifiedName',
            loading: isLoading,
            locale: {
              emptyText: noDataPlaceholder,
            },
            pagination: false,
            size: 'small',
            onChange: handleTableChange,
          }}
        />
      </Col>
    </Row>
  );
};

export default Services;
