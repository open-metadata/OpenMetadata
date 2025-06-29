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
import { isEmpty, isUndefined } from 'lodash';
import { Bucket } from 'Models';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DataAssetsIcon } from '../../../../assets/svg/data-assets-widget.svg';
import { HOW_TO_GUIDE_DOCS } from '../../../../constants/docs.constants';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../../enums/common.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { WidgetCommonProps } from '../../../../pages/CustomizablePage/CustomizablePage.interface';
import { searchData } from '../../../../rest/miscAPI';
import { Transi18next } from '../../../../utils/CommonUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import './data-assets-widget.less';
import DataAssetCard from './DataAssetCard/DataAssetCard.component';

const DataAssetsWidget = ({
  isEditView = false,
  handleRemoveWidget,
  widgetKey,
}: WidgetCommonProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<boolean>(false);
  const [services, setServices] = useState<Bucket[]>([]);

  const fetchDataAssets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await searchData('', 0, 0, '', 'updatedAt', '', [
        SearchIndex.TABLE,
        SearchIndex.TOPIC,
        SearchIndex.DASHBOARD,
        SearchIndex.PIPELINE,
        SearchIndex.MLMODEL,
        SearchIndex.CONTAINER,
        SearchIndex.SEARCH_INDEX,
        SearchIndex.API_ENDPOINT_INDEX,
      ]);
      setServices(res?.data.aggregations?.['sterms#serviceType'].buckets);
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
    fetchDataAssets();
  }, []);

  return (
    <Card
      className="data-assets-explore-widget-container card-widget h-full"
      data-testid="data-assets-widget"
      loading={loading}>
      <Row gutter={[0, 16]}>
        <Col span={24}>
          <Row justify="space-between">
            <Col>
              <Typography.Text className="font-medium">
                {t('label.data-asset-plural')}
              </Typography.Text>
            </Col>
            <Col>
              {isEditView && (
                <Space>
                  <DragOutlined
                    className="drag-widget-icon cursor-pointer"
                    data-testid="drag-widget-button"
                    size={14}
                  />
                  <CloseOutlined
                    data-testid="remove-widget-button"
                    size={14}
                    onClick={handleCloseClick}
                  />
                </Space>
              )}
            </Col>
          </Row>
        </Col>
        <Col className="data-assets-explore-widget-body" span={24}>
          {isEmpty(services) ? (
            <ErrorPlaceHolder
              className="border-none"
              icon={<DataAssetsIcon height={SIZE.SMALL} width={SIZE.SMALL} />}
              type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
              <Typography.Paragraph
                className="tw-max-w-md"
                style={{ marginBottom: '0' }}>
                <Transi18next
                  i18nKey="message.no-data-assets"
                  renderElement={
                    <a
                      data-testid="how-to-guide-doc-link"
                      href={HOW_TO_GUIDE_DOCS}
                      rel="noopener noreferrer"
                      target="_blank"
                    />
                  }
                />
              </Typography.Paragraph>
            </ErrorPlaceHolder>
          ) : (
            <Row gutter={[0, 8]}>
              {services.map((service) => (
                <Col key={service.key} lg={6} xl={4}>
                  <DataAssetCard service={service} />
                </Col>
              ))}
            </Row>
          )}
        </Col>
      </Row>
    </Card>
  );
};

export default DataAssetsWidget;
