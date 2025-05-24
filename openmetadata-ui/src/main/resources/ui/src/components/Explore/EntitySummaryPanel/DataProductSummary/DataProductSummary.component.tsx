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
import { Col, Row, Space, Typography } from 'antd';
import { get } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataProduct } from '../../../../generated/entity/domains/dataProduct';
import { getSortedTagsWithHighlight } from '../../../../utils/EntitySummaryPanelUtils';
import { getEntityName } from '../../../../utils/EntityUtils';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';
import SummaryPanelSkeleton from '../../../common/Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';
import SummaryTagsDescription from '../../../common/SummaryTagsDescription/SummaryTagsDescription.component';
import { SearchedDataProps } from '../../../SearchedData/SearchedData.interface';

interface DataProductSummaryProps {
  entityDetails: DataProduct;
  isLoading?: boolean;
  highlights?: SearchedDataProps['data'][number]['highlight'];
}

const DataProductSummary = ({
  entityDetails,
  isLoading,
  highlights,
}: DataProductSummaryProps) => {
  const { t } = useTranslation();

  const experts = useMemo(() => entityDetails.experts ?? [], [entityDetails]);

  return (
    <SummaryPanelSkeleton loading={Boolean(isLoading)}>
      <div className="d-flex flex-col gap-5">
        <Row className="p-md border-radius-card" gutter={[0, 8]}>
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

        <SummaryTagsDescription
          entityDetail={entityDetails}
          tags={getSortedTagsWithHighlight(
            entityDetails.tags,
            get(highlights, 'tag.name')
          )}
        />

        <Row className="p-md border-radius-card" gutter={[0, 8]}>
          <Col span={24}>
            <Typography.Text
              className="summary-panel-section-title"
              data-testid="owner-header">
              {t('label.owner-plural')}
            </Typography.Text>
          </Col>
          <Col span={24}>
            <OwnerLabel owners={entityDetails.owners ?? []} />
          </Col>
        </Row>

        <Row className="p-md border-radius-card" gutter={[0, 8]}>
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
                <OwnerLabel owners={experts} />
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
      </div>
    </SummaryPanelSkeleton>
  );
};

export default DataProductSummary;
