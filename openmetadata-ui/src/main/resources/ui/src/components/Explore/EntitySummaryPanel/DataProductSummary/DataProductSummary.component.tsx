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
import { Col, Divider, Row, Space, Typography } from 'antd';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataProduct } from '../../../../generated/entity/domains/dataProduct';
import { getEntityName } from '../../../../utils/EntityUtils';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';
import RichTextEditorPreviewer from '../../../common/rich-text-editor/RichTextEditorPreviewer';
import SummaryPanelSkeleton from '../../../Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';

interface DataProductSummaryProps {
  entityDetails: DataProduct;
  isLoading?: boolean;
}

const DataProductSummary = ({
  entityDetails,
  isLoading,
}: DataProductSummaryProps) => {
  const { t } = useTranslation();

  const experts = useMemo(() => entityDetails.experts ?? [], [entityDetails]);

  return (
    <SummaryPanelSkeleton loading={Boolean(isLoading)}>
      <>
        <Row className="m-md m-t-0" gutter={[0, 8]}>
          <Col span={24}>
            <Typography.Text
              className="summary-panel-section-title"
              data-testid="domain-header">
              {t('label.domain')}
            </Typography.Text>
          </Col>
          <Col span={24}>
            <Typography.Text data-testid="domain-header">
              {getEntityName(entityDetails.domain)}
            </Typography.Text>
          </Col>
        </Row>
        <Divider className="m-y-xs" />

        <Row className="m-md" gutter={[0, 8]}>
          <Col span={24}>
            <Typography.Text
              className="summary-panel-section-title"
              data-testid="description-header">
              {t('label.description')}
            </Typography.Text>
          </Col>
          <Col span={24}>
            <div>
              {entityDetails.description?.trim() ? (
                <RichTextEditorPreviewer
                  markdown={entityDetails.description}
                  maxLength={80}
                />
              ) : (
                <Typography className="text-grey-body">
                  {t('label.no-data-found')}
                </Typography>
              )}
            </div>
          </Col>
        </Row>

        <Divider className="m-y-xs" />

        <Row className="m-md m-t-0" gutter={[0, 8]}>
          <Col span={24}>
            <Typography.Text
              className="summary-panel-section-title"
              data-testid="owner-header">
              {t('label.owner')}
            </Typography.Text>
          </Col>
          <Col span={24}>
            {entityDetails.owner ? (
              <OwnerLabel
                key={entityDetails.owner.fullyQualifiedName}
                owner={entityDetails.owner}
              />
            ) : (
              <Typography.Text
                className="text-grey-body"
                data-testid="no-owner-header">
                {t('label.no-entity', {
                  entity: t('label.owner-lowercase'),
                })}
              </Typography.Text>
            )}
          </Col>
        </Row>

        <Divider className="m-y-xs" />

        <Row className="m-md m-t-0" gutter={[0, 8]}>
          <Col span={24}>
            <Typography.Text
              className="summary-panel-section-title"
              data-testid="expert-header">
              {t('label.expert-plural')}
            </Typography.Text>
          </Col>
          <Col span={24}>
            {experts.length > 0 ? (
              <Space wrap size={[8, 8]}>
                {experts.map((assignee) => (
                  <OwnerLabel
                    key={assignee.fullyQualifiedName}
                    owner={assignee}
                  />
                ))}
              </Space>
            ) : (
              <Typography.Text
                className="text-grey-body"
                data-testid="no-expert-header">
                {t('label.no-entity', {
                  entity: t('label.expert-lowercase'),
                })}
              </Typography.Text>
            )}
          </Col>
        </Row>

        <Divider className="m-y-xs" />
      </>
    </SummaryPanelSkeleton>
  );
};

export default DataProductSummary;
