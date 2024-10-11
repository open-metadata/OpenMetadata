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

import { Button, Card, Col, Row, Space, Typography } from 'antd';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory } from 'react-router-dom';
import { PAGE_HEADERS } from '../../../constants/PageHeaders.constant';
import { ServiceCategory } from '../../../enums/service.enum';
import { getAddServicePath, getSettingPath } from '../../../utils/RouterUtils';
import PageHeader from '../../PageHeader/PageHeader.component';
import { getServiceDetailsPath } from '../../../constants/constants';
import { DomainSupportedServiceTypes, ServicesType } from '../../../interface/service.interface';
import { getServiceLogo } from '../../../utils/CommonUtils';
import { getOptionalFields } from '../../../utils/ServiceUtils';
import RichTextEditorPreviewer from '../../common/RichTextEditor/RichTextEditorPreviewer';
import { FilterOutlined } from '@ant-design/icons';
import { ColumnsType } from 'antd/lib/table';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { getThemeConfig } from '../../../utils/ThemeUtils';
import { GlobalSettingOptions, GlobalSettingsMenuCategory } from '../../../constants/GlobalSettings.constants';
import SettingItemCard from '../SettingItemCard/SettingItemCard.component';
import { ReactComponent as DashboardIcon } from '../../../assets/svg/dashboard-colored.svg';
import { ReactComponent as DatabaseIcon } from '../../../assets/svg/database-colored.svg';
import { ReactComponent as IconAPI } from '../../../assets/svg/ic-api-service.svg';
import { ReactComponent as OpenMetadataIcon } from '../../../assets/svg/logo-monogram.svg';
import { ReactComponent as MessagingIcon } from '../../../assets/svg/messaging-colored.svg';
import { ReactComponent as MlModelIcon } from '../../../assets/svg/ml-model-colored.svg';
import { ReactComponent as PipelineIcon } from '../../../assets/svg/pipeline-colored.svg';
import { ReactComponent as SearchIcon } from '../../../assets/svg/search-colored.svg';
import { ReactComponent as DataObservability } from '../../../assets/svg/setting-data-observability.svg';
import { ReactComponent as StorageIcon } from '../../../assets/svg/storage-colored.svg';

interface ServicesProps {
  serviceName: ServiceCategory;
}

const Services = ({ serviceName }: ServicesProps) => {
  const theme = getThemeConfig();
  const { t } = useTranslation();

  const history = useHistory();
  const handleAddServiceClick = () => {
    history.push(getAddServicePath(serviceName));
  };

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
      default:
        return PAGE_HEADERS.DATABASES_SERVICES;
    }
  }, [serviceName]);

  const getRoute = () => {
    switch (serviceName) {
      case ServiceCategory.DATABASE_SERVICES:
        return `/databaseServices/add-service`;
      default:
        return "/databases"
    }
  };

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
                  to={getRoute()}>
                  <Typography.Text
                    className="text-base text-grey-body font-medium truncate w-48 d-inline-block"
                    data-testid={`service-name-${service.name}`}
                    title={service.name}>
                    {service.name}
                  </Typography.Text>
                </Link>
                <div
                  className="p-t-xs text-grey-body break-all description-text"
                  data-testid="service-description">
                  {service.description ? (
                    <RichTextEditorPreviewer
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

  const columns: ColumnsType<DomainSupportedServiceTypes> = [
    {
      title: t('label.name'),
      dataIndex: 'name',
      key: 'name',
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
            {serviceName}
          </Link>
        </div>
      ),
    },
    {
      title: t('label.description'),
      dataIndex: 'description',
      key: 'description',
      width: 200,
      render: (description) =>
        description ? (
          <RichTextEditorPreviewer
            className="max-two-lines"
            enableSeeMoreVariant={false}
            markdown={description}
          />
        ) : (
          <span className="text-grey-muted">{t('label.no-description')}</span>
        ),
    },
    {
      title: t('label.type'),
      dataIndex: 'serviceType',
      key: 'serviceType',
      width: 200,
      // filterDropdown: ColumnFilter,
      filterIcon: (filtered) => (
        <FilterOutlined
          style={{
            color: filtered ? theme.primaryColor : undefined,
          }}
        />
      ),
      filtered: false,
      render: (serviceType) => (
        <span className="font-normal text-grey-body">{serviceType}</span>
      ),
    },
    {
      title: t('label.owner'),
      dataIndex: 'owners',
      key: 'owners',
      width: 200,
      render: (owners: string[]) => owners && owners !== undefined ?
        owners.map((values, index) => (<div key={index}>{owners}</div>)) : <>no</>,
    },
  ];

  const noDataPlaceholder = useMemo(() => {

    return (
      <ErrorPlaceHolder
        className="mt-24"
        type={ERROR_PLACEHOLDER_TYPE.NO_DATA}
      />
    );
  }, []);


  const serviceCategories = [
    {
      label: t('label.database-plural'),
      description: t('message.page-sub-header-for-databases'),
      isProtected: false,
      key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.DATABASES}`,
      icon: DatabaseIcon,
    },
    {
      label: t('label.messaging'),
      description: t('message.page-sub-header-for-messagings'),
      isProtected: false,
      key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.MESSAGING}`,
      icon: MessagingIcon,
    },
    {
      label: t('label.dashboard-plural'),
      description: t('message.page-sub-header-for-dashboards'),
      isProtected: false,
      key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.DASHBOARDS}`,
      icon: DashboardIcon,
    },
    {
      label: t('label.pipeline-plural'),
      description: t('message.page-sub-header-for-pipelines'),
      isProtected: false,
      key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.PIPELINES}`,
      icon: PipelineIcon,
    },
    {
      label: t('label.ml-model-plural'),
      description: t('message.page-sub-header-for-ml-models'),
      isProtected: false,
      key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.MLMODELS}`,
      icon: MlModelIcon,
    },
    {
      label: t('label.storage-plural'),
      description: t('message.page-sub-header-for-storages'),
      isProtected: false,
      key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.STORAGES}`,
      icon: StorageIcon,
    },
    {
      label: t('label.search'),
      description: t('message.page-sub-header-for-search'),
      isProtected: false,
      key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.SEARCH}`,
      icon: SearchIcon,
    },
    {
      label: t('label.metadata'),
      description: t('message.page-sub-header-for-metadata'),
      isProtected: false,
      key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.METADATA}`,
      icon: OpenMetadataIcon,
    },
    {
      label: t('label.api-uppercase-plural'),
      description: t('message.page-sub-header-for-apis'),
      isProtected: false,
      key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.APIS}`,
      icon: IconAPI,
      isBeta: true,
    },
    {
      label: t('label.data-observability'),
      description: t('message.page-sub-header-for-data-observability'),
      isProtected: false,
      key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.DATA_OBSERVABILITY}`,
      icon: DataObservability,
    },
  ];

  const handleSettingItemClick = (key: string) => {
    const [category, option] = key.split('.');

    history.push(getSettingPath(category, option));
  };

  return (
    <Row
      className="justify-center m-b-md"
      data-testid="services-container"
      gutter={[16, 16]}>
      <Col span={24}>
        <Space className="w-full justify-between m-b-lg" data-testid="header">
          <PageHeader data={getServicePageHeader()} />

        </Space>
      </Col>
      <Col span={24}>
        <Row gutter={[20, 20]}>
          {serviceCategories.map((category) => (
            <Col key={category?.key} span={6}>
              <SettingItemCard
                data={category}
                onClick={handleSettingItemClick}
              />
            </Col>
          ))}
        </Row>
      </Col>
    </Row>
  );
};

export default Services;


