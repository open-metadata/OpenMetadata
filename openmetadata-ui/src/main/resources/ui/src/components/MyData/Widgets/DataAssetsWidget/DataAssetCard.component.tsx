/*
 *  Copyright 2024 Collate.
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
import { Card, Col, Row, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getServiceDetailsPath } from '../../../../constants/constants';
import { ServiceCategoryPlural } from '../../../../enums/service.enum';
import { Table } from '../../../../generated/entity/data/table';
import { ExploreSearchSource } from '../../../../interface/search.interface';
import { getServiceLogo } from '../../../../utils/CommonUtils';
import { getEntityName } from '../../../../utils/EntityUtils';
import RichTextEditorPreviewer from '../../../common/RichTextEditor/RichTextEditorPreviewer';
import './data-assets-widget.less';
interface DataAssetCardProps {
  service: ExploreSearchSource;
}

const DataAssetCard = ({ service }: DataAssetCardProps) => {
  const { t } = useTranslation();

  return (
    <Link
      className="no-underline"
      data-testid={`data-asset-service-${service.name}`}
      to={getServiceDetailsPath(
        service.fullyQualifiedName ?? service.name,
        ServiceCategoryPlural[
          service?.entityType as keyof typeof ServiceCategoryPlural
        ]
      )}>
      <Card className="service-card" data-testid="service-card" size="small">
        <div
          className="d-flex justify-center items-center"
          data-testid="service-icon">
          {getServiceLogo((service as Table).serviceType ?? '', 'h-8')}
        </div>
        <Row className="m-l-xs" gutter={[0, 6]}>
          <Col span={24}>
            <Typography.Text
              className="text-base text-grey-body font-medium truncate w-full d-inline-block"
              data-testid={`service-name-${service.name}`}
              title={getEntityName(service)}>
              {getEntityName(service)}
            </Typography.Text>
            <div
              className="text-grey-body break-all description-text"
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
          </Col>
          <Col className="m-b-xss" data-testid="service-type" span={24}>
            <label className="m-b-0">{`${t('label.type')}:`}</label>
            <span className="font-normal m-l-xss text-grey-body">
              {(service as Table).serviceType}
            </span>
          </Col>
        </Row>
      </Card>
    </Link>
  );
};

export default DataAssetCard;
