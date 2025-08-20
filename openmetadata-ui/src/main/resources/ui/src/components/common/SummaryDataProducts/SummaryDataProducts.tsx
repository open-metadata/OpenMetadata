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
import { Col, Row, Tag, Typography } from 'antd';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import DataProductIcon from '../../../assets/svg/ic-data-product.svg?react';
import { EntityType } from '../../../enums/entity.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { getEntityName } from '../../../utils/EntityUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { SearchedDataProps } from '../../SearchedData/SearchedData.interface';
const SummaryDataProducts = ({
  dataAsset,
}: {
  dataAsset: SearchedDataProps['data'][number]['_source'] & {
    dataProducts: DataProduct[];
  };
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const dataProducts = useMemo(() => {
    return dataAsset?.dataProducts ?? [];
  }, [dataAsset]);

  const redirectLink = useCallback((fqn: string) => {
    navigate(getEntityDetailsPath(EntityType.DATA_PRODUCT, fqn));
  }, []);

  return (
    <Row className="p-md border-radius-card summary-panel-card" gutter={[0, 8]}>
      <Col span={24}>
        <Typography.Text
          className="summary-panel-section-title"
          data-testid="data-products-header">
          {t('label.data-product-plural')}
        </Typography.Text>
      </Col>
      <Col className="d-flex flex-wrap gap-2" span={24}>
        {dataProducts.length > 0 ? (
          dataProducts.map((product) => {
            return (
              <Tag
                className="tag-chip tag-chip-content"
                key={`dp-tags-${product.fullyQualifiedName}`}
                onClick={() => redirectLink(product.fullyQualifiedName ?? '')}>
                <div className="d-flex w-full">
                  <div className="d-flex items-center p-x-xs w-full gap-1">
                    <DataProductIcon
                      className="align-middle"
                      height={12}
                      width={12}
                    />
                    <Typography.Paragraph
                      className="m-0 tags-label"
                      data-testid={`data-product-${product.fullyQualifiedName}`}>
                      {getEntityName(product)}
                    </Typography.Paragraph>
                  </div>
                </div>
              </Tag>
            );
          })
        ) : (
          <Typography.Text className="text-sm no-data-chip-placeholder">
            {t('label.no-data-found')}
          </Typography.Text>
        )}
      </Col>
    </Row>
  );
};

export default SummaryDataProducts;
