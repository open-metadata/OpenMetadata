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

import { Button, Card, Col, Row, Space, Tooltip, Typography } from 'antd';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { isEmpty } from 'lodash';
import React, { Fragment, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory } from 'react-router-dom';
import { getEntityName } from 'utils/EntityUtils';
import {
  getServiceDetailsPath,
  SERVICE_VIEW_CAP,
} from '../../constants/constants';
import { CONNECTORS_DOCS } from '../../constants/docs.constants';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { servicesDisplayName } from '../../constants/Services.constant';
import { ServiceCategory } from '../../enums/service.enum';
import { Operation } from '../../generated/entity/policies/policy';
import { Paging } from '../../generated/type/paging';
import { ServicesType } from '../../interface/service.interface';
import { getServiceLogo, showPagination } from '../../utils/CommonUtils';
import { checkPermission } from '../../utils/PermissionsUtils';
import { getAddServicePath } from '../../utils/RouterUtils';
import {
  getOptionalFields,
  getResourceEntityFromServiceCategory,
} from '../../utils/ServiceUtils';
import { useAuthContext } from '../authentication/auth-provider/AuthProvider';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from '../common/next-previous/NextPrevious';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import PageHeader from '../header/PageHeader.component';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';

interface ServicesProps {
  serviceData: ServicesType[];
  serviceName: ServiceCategory;
  paging: Paging;
  currentPage: number;
  onPageChange: (cursorType: string | number, activePage?: number) => void;
}

const Services = ({
  serviceData,
  serviceName,
  paging,
  currentPage,
  onPageChange,
}: ServicesProps) => {
  const { t } = useTranslation();
  const { isAuthDisabled } = useAuthContext();
  const history = useHistory();
  const handleAddServiceClick = () => {
    history.push(getAddServicePath(serviceName));
  };

  const { permissions } = usePermissionProvider();

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
      default:
        return PAGE_HEADERS.DATABASES_SERVICES;
    }
  }, [serviceName]);

  const noDataPlaceholder = useMemo(
    () =>
      addServicePermission ? (
        <ErrorPlaceHolder
          className="mt-24"
          doc={CONNECTORS_DOCS}
          heading={servicesDisplayName[serviceName]}
          permission={addServicePermission}
          type={ERROR_PLACEHOLDER_TYPE.CREATE}
          onClick={handleAddServiceClick}
        />
      ) : (
        <ErrorPlaceHolder
          className="mt-24"
          type={ERROR_PLACEHOLDER_TYPE.NO_DATA}
        />
      ),
    [
      addServicePermission,
      servicesDisplayName,
      serviceName,
      addServicePermission,
      handleAddServiceClick,
    ]
  );

  return (
    <Row className="justify-center" data-testid="services-container">
      <Fragment>
        <Col span={24}>
          <Space className="w-full justify-between m-b-lg" data-testid="header">
            <PageHeader data={getServicePageHeader()} />
            <Tooltip
              placement="left"
              title={
                addServicePermission
                  ? t('label.add-entity', {
                      entity: t('label.service'),
                    })
                  : NO_PERMISSION_FOR_ACTION
              }>
              {(addServicePermission || isAuthDisabled) && (
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
              )}
            </Tooltip>
          </Space>
        </Col>
        {serviceData.length ? (
          <Col span={24}>
            <Row data-testid="data-container" gutter={[16, 16]}>
              {serviceData.map((service) => (
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
                              encodeURIComponent(
                                service.fullyQualifiedName ?? service.name
                              ),
                              serviceName
                            )}>
                            <Typography.Text
                              className="text-base text-grey-body font-medium truncate w-48"
                              data-testid={`service-name-${service.name}`}
                              title={getEntityName(service)}>
                              {getEntityName(service)}
                            </Typography.Text>
                          </Link>
                          <div
                            className="p-t-xs text-grey-body break-all description-text"
                            data-testid="service-description">
                            {service.description ? (
                              <RichTextEditorPreviewer
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
                            <label className="m-b-0">{`${t(
                              'label.type'
                            )}:`}</label>
                            <span className="font-normal m-l-xss text-grey-body">
                              {service.serviceType}
                            </span>
                          </div>
                        </Col>
                      </Row>

                      <div className="d-flex flex-col justify-between flex-none">
                        <div
                          className="d-flex justify-end"
                          data-testid="service-icon">
                          {getServiceLogo(service.serviceType || '', 'h-7')}
                        </div>
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Col>
        ) : (
          <Col span={24}>{noDataPlaceholder}</Col>
        )}

        {showPagination(paging) && (
          <NextPrevious
            currentPage={currentPage}
            pageSize={SERVICE_VIEW_CAP}
            paging={paging}
            pagingHandler={onPageChange}
            totalCount={paging.total}
          />
        )}
      </Fragment>
    </Row>
  );
};

export default Services;
