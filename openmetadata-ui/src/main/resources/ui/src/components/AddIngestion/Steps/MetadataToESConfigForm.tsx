import {
  Button,
  Col,
  Divider,
  Form,
  Input,
  Row,
  Space,
  Switch,
  Typography,
} from 'antd';
import { startCase } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ConfigClass } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import './MetadataToESConfigForm.less';

interface Props {
  handleMetadataToESConfig: (data: ConfigClass) => void;
  handlePrev: () => void;
  handleNext: () => void;
}

const { Text } = Typography;

export default function MetadataToESConfigForm({
  handleMetadataToESConfig,
  handlePrev,
  handleNext,
}: Props) {
  const { t } = useTranslation();

  const getFieldLabels = (label: string, description: string) => {
    return (
      <Space direction="vertical">
        <Text>{label}</Text>
        <Text className="input-field-descriptions">{description}</Text>
      </Space>
    );
  };

  const handleSubmit = (values: ConfigClass) => {
    handleMetadataToESConfig({
      ...values,
    });
    handleNext();
  };

  return (
    <Form
      className="metadata-to-es-config-form"
      layout="vertical"
      onFinish={handleSubmit}>
      <Form.Item
        label={getFieldLabels(
          startCase('caCerts'),
          t('message.field-ca-certs-description')
        )}
        name="caCerts">
        <Input />
      </Form.Item>
      <Form.Item
        label={getFieldLabels(
          startCase('regionName'),
          t('message.field-region-name-description')
        )}
        name="regionName">
        <Input />
      </Form.Item>
      <Form.Item
        label={getFieldLabels(
          startCase('timeout'),
          t('message.field-timeout-description')
        )}
        name="timeout">
        <Input type="number" />
      </Form.Item>
      <Divider />
      <Form.Item
        className="switch-item"
        label={startCase('useAwsCredentials')}
        name="useAwsCredentials">
        <Switch />
      </Form.Item>
      <Text className="switch-field-descriptions">
        {t('message.field-use-aws-credentials-description')}
      </Text>
      <Divider />
      <Form.Item
        className="switch-item"
        label={startCase('useSSL')}
        name="useSSL">
        <Switch />
      </Form.Item>
      <Text className="switch-field-descriptions">
        {t('message.field-use-ssl-description')}
      </Text>
      <Divider />
      <Form.Item
        className="switch-item"
        label={startCase('verifyCerts')}
        name="verifyCerts">
        <Switch />
      </Form.Item>
      <Text className="switch-field-descriptions">
        {t('message.field-verify-certs-description')}
      </Text>
      <Divider />
      <Row justify="end">
        <Col>
          <Button type="link" onClick={handlePrev}>
            {t('label.back')}
          </Button>
        </Col>
        <Col>
          <Button htmlType="submit" type="primary">
            {t('label.next')}
          </Button>
        </Col>
      </Row>
    </Form>
  );
}
