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

import { Button, Card, Col, Row, Space, theme, Typography } from 'antd';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory } from 'react-router-dom';
import { PAGE_HEADERS } from '../../../constants/PageHeaders.constant';
import { ServiceCategory } from '../../../enums/service.enum';
import { getAddServicePath, getSettingCategoryPath } from '../../../utils/RouterUtils';
import PageHeader from '../../PageHeader/PageHeader.component';
import { getServiceDetailsPath, ROUTES } from '../../../constants/constants';
import { DomainSupportedServiceTypes, ServicesType } from '../../../interface/service.interface';
import { getServiceLogo } from '../../../utils/CommonUtils';
import { getOptionalFields } from '../../../utils/ServiceUtils';
import RichTextEditorPreviewer from '../../common/RichTextEditor/RichTextEditorPreviewer';
import { ListView } from '../../common/ListView/ListView.component';
import { FilterOutlined } from '@ant-design/icons';
import { ColumnsType } from 'antd/lib/table';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { getThemeConfig } from '../../../utils/ThemeUtils';
import { ServiceType } from '../../../generated/entity/services/serviceType';
import { DatabaseService, DatabaseServiceType } from '../../../generated/entity/services/databaseService';
import { GlobalSettingsMenuCategory } from '../../../constants/GlobalSettings.constants';
import SettingItemCard from '../SettingItemCard/SettingItemCard.component';
import globalSettingsClassBase from '../../../utils/GlobalSettingsClassBase';
import { SettingMenuItem } from '../../../utils/GlobalSettingsUtils';

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



  // const settingCategoryData: SettingMenuItem | undefined = useMemo(() => {
  //   let categoryItem = globalSettingsClassBase
  //     .getGlobalSettingsMenuWithPermission(permissions, isAdminUser)
  //     .find((item) => item.key === settingCategory);

  //   if (categoryItem) {
  //     categoryItem = {
  //       ...categoryItem,
  //       items: categoryItem?.items?.filter((item) => item.isProtected),
  //     };
  //   }

  //   return categoryItem;
  // }, [settingCategory, permissions, isAdminUser]);

  const serviceDetails: Array<DomainSupportedServiceTypes> = [
    {
      id: "id",
      name: "database",
    } as DatabaseService,
  ];


  return (
    <Row
      className="justify-center m-b-md"
      data-testid="services-container"
      gutter={[16, 16]}>
      <Col span={24}>
        <Space className="w-full justify-between m-b-lg" data-testid="header">
          <PageHeader data={getServicePageHeader()} />

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
        </Space>
      </Col>
      <Col span={24}>
        {serviceDetails.map(serviceCardRenderer)}
      </Col>
    </Row>
  );
};

export default Services;


