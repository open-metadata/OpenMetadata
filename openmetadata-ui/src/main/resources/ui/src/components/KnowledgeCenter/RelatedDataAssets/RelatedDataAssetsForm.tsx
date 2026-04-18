import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Button, Col, Form, Row, Space } from 'antd';
import DataAssetAsyncSelectList from 'components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList';
import { DataAssetOption } from 'components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';

import { FC, useState } from 'react';
import i18n from 'utils/i18next/LocalUtil';

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
              data-testid="cancelDataAssets"
              disabled={isSubmitLoading}
              icon={<CloseOutlined size={12} />}
              size="small"
              onClick={onCancel}
            />
            <Button
              className="p-x-05"
              data-testid="saveDataAssets"
              htmlType="submit"
              icon={<CheckOutlined size={12} />}
              loading={isSubmitLoading}
              size="small"
              type="primary"
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
