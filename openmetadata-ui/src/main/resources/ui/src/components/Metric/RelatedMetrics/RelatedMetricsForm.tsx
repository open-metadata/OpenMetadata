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
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Button, Col, Form, Row, Space } from 'antd';
import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIndex } from '../../../enums/search.enum';
import DataAssetAsyncSelectList from '../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList';
import { DataAssetOption } from '../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';

interface RelatedMetricsFormProps {
  metricFqn: string;
  defaultValue?: string[];
  initialOptions?: DataAssetOption[];
  onSubmit: (option: DataAssetOption[]) => Promise<void>;
  onCancel: () => void;
}

export const RelatedMetricsForm: FC<RelatedMetricsFormProps> = ({
  defaultValue,
  initialOptions,
  onCancel,
  onSubmit,
  metricFqn,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);

  return (
    <Form
      data-testid="related-metric-form"
      form={form}
      initialValues={{ relatedMetrics: defaultValue }}
      name="related-metric-form"
      onFinish={(data) => {
        setIsSubmitLoading(true);
        onSubmit(data['relatedMetrics']);
      }}>
      <Row gutter={[0, 8]}>
        <Col className="gutter-row d-flex justify-end" span={24}>
          <Space align="center">
            <Button
              className="p-x-05"
              data-testid="cancelRelatedMetrics"
              disabled={isSubmitLoading}
              icon={<CloseOutlined size={12} />}
              size="small"
              onClick={onCancel}
            />
            <Button
              className="p-x-05"
              data-testid="saveRelatedMetrics"
              htmlType="submit"
              icon={<CheckOutlined size={12} />}
              loading={isSubmitLoading}
              size="small"
              type="primary"
            />
          </Space>
        </Col>

        <Col className="gutter-row" span={24}>
          <Form.Item noStyle name="relatedMetrics">
            <DataAssetAsyncSelectList
              filterFqns={[metricFqn]}
              initialOptions={initialOptions}
              mode="multiple"
              placeholder={t('label.related-metric-plural')}
              searchIndex={SearchIndex.METRIC_SEARCH_INDEX}
            />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );
};
