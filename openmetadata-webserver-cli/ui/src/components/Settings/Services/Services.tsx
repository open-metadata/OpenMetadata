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

import { Button, Col, Row, Space } from 'antd';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { PAGE_HEADERS } from '../../../constants/PageHeaders.constant';
import { ServiceCategory } from '../../../enums/service.enum';
import { getAddServicePath } from '../../../utils/RouterUtils';
import PageHeader from '../../PageHeader/PageHeader.component';

interface ServicesProps {
  serviceName: ServiceCategory;
}

const Services = ({ serviceName }: ServicesProps) => {
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
    </Row>
  );
};

export default Services;
