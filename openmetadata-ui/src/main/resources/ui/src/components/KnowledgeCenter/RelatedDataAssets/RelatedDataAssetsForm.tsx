/*
 *  Copyright 2026 Collate.
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
import { Col, Form, Row, Space } from 'antd';
import { Button } from '@openmetadata/ui-core-components';
import DataAssetAsyncSelectList from '../../../components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList';
import { DataAssetOption } from '../../../components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';

import { FC, useState } from 'react';
import i18n from '../../../utils/i18next/LocalUtil';

interface RelatedDataAssetsFormProps {
  defaultValue?: string[];
  initialOptions?: DataAssetOption[];
  onSubmit: (option: DataAssetOption[]) => Promise<void>;
  onCancel: () => void;
}

const knowledgeCenterQueryFilter = {
  query: {
    bool: {
      must_not: [
        { term: { entityType: 'dataProduct' } },
        { term: { entityType: 'domain' } },
        { match: { isBot: true } },
      ],
    },
  },
};

export const RelatedDataAssetsForm: FC<RelatedDataAssetsFormProps> = ({
  defaultValue,
  initialOptions,
  onCancel,
  onSubmit,
}) => {
  const { t } = i18n;
  const [form] = Form.useForm();
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);

  return (
    <Form
      data-testid="dataAssetsForm"
      form={form}
      initialValues={{ dataAssets: defaultValue }}
      name="dataAssetsForm"
      onFinish={(data) => {
        setIsSubmitLoading(true);
        onSubmit(data['dataAssets']);
      }}>
      <Row gutter={[0, 8]}>
        <Col className="gutter-row d-flex justify-end" span={24}>
          <Space align="center">
            <Button
              className="p-x-05"
              color="secondary"
              data-testid="cancelDataAssets"
              iconLeading={<CloseOutlined size={12} />}
              isDisabled={isSubmitLoading}
              size="xs"
              onClick={onCancel}
            />
            <Button
              className="p-x-05"
              color="primary"
              data-testid="saveDataAssets"
              iconLeading={<CheckOutlined size={12} />}
              isLoading={isSubmitLoading}
              size="xs"
              type="submit"
            />
          </Space>
        </Col>

        <Col className="gutter-row" span={24}>
          <Form.Item noStyle name="dataAssets">
            <DataAssetAsyncSelectList
              initialOptions={initialOptions}
              mode="multiple"
              placeholder={t('label.data-asset-plural')}
              queryFilter={knowledgeCenterQueryFilter}
            />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );
};
