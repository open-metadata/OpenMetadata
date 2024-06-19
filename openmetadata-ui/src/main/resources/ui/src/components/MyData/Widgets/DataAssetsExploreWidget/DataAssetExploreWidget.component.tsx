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
import { CloseOutlined, DragOutlined } from '@ant-design/icons';
import { Card, Col, Row, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isUndefined } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_LARGE,
} from '../../../../constants/constants';
import { SearchIndex } from '../../../../enums/search.enum';
import { ExploreSearchSource } from '../../../../interface/search.interface';
import { WidgetCommonProps } from '../../../../pages/CustomizablePage/CustomizablePage.interface';
import { searchData } from '../../../../rest/miscAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import './data-asset-explore-widget.less';
import DataAssetCard from './DataAssetCard/DataAssetCard.component';

const DataAssetExploreWidget = ({
  isEditView = false,
  handleRemoveWidget,
  widgetKey,
}: WidgetCommonProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<boolean>(false);
  const [services, setServices] = useState<ExploreSearchSource[]>([]);

  const fetchDataAsset = useCallback(async () => {
    setLoading(true);
    try {
      const res = await searchData(
        '',
        INITIAL_PAGING_VALUE,
        PAGE_SIZE_LARGE,
        '',
        'updatedAt',
        '',
        [
          SearchIndex.DATABASE_SERVICE,
          SearchIndex.MESSAGING_SERVICE,
          SearchIndex.DASHBOARD_SERVICE,
          SearchIndex.PIPELINE_SERVICE,
          SearchIndex.ML_MODEL_SERVICE,
          SearchIndex.STORAGE_SERVICE,
          SearchIndex.SEARCH_SERVICE,
        ]
      );
      setServices(res?.data?.hits?.hits.map((hit) => hit._source));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCloseClick = useCallback(() => {
    !isUndefined(handleRemoveWidget) && handleRemoveWidget(widgetKey);
  }, [widgetKey]);

  useEffect(() => {
    fetchDataAsset();
  }, []);

  return (
    <Card
      className="data-asset-explore-widget-container card-widget h-full"
      loading={loading}>
      <Row gutter={[0, 15]}>
        <Col span={24}>
          <Row justify="space-between">
            <Col>
              <Typography.Text className="font-medium">
                {t('label.service-plural')}
              </Typography.Text>
            </Col>
            <Col>
              {isEditView && (
                <Space>
                  <DragOutlined
                    className="drag-widget-icon cursor-pointer"
                    data-testid="drag-widget-btn"
                    size={14}
                  />
                  <CloseOutlined
                    data-testid="remove-widget-btn"
                    size={14}
                    onClick={handleCloseClick}
                  />
                </Space>
              )}
            </Col>
          </Row>
        </Col>
        <Col span={24}>
          <Row className="data-asset-explore-widget-body" gutter={[10, 10]}>
            {services.map((service) => (
              <Col key={service.id} lg={8} xl={6}>
                <DataAssetCard service={service} />
              </Col>
            ))}
          </Row>
        </Col>
      </Row>
    </Card>
  );
};

export default DataAssetExploreWidget;
