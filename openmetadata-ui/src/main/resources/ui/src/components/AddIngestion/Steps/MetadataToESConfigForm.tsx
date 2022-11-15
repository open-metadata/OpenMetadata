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
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfigClass } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import './MetadataToESConfigForm.less';

interface Props {
  metadataToESConfig?: ConfigClass;
  handleMetadataToESConfig: (data: ConfigClass) => void;
  handlePrev: () => void;
  handleNext: () => void;
}

const { Text } = Typography;

export default function MetadataToESConfigForm({
  metadataToESConfig,
  handleMetadataToESConfig,
  handlePrev,
  handleNext,
}: Props) {
  const { t } = useTranslation();
  const [caCerts, SetCaCerts] = useState<string>('');
  const [regionName, SetRegionName] = useState<string>('');
  const [timeout, SetTimeout] = useState<number>(0);
  const [useAwsCredentials, SetUseAwsCredentials] = useState<boolean>(false);
  const [useSSL, SetUseSSL] = useState<boolean>(false);
  const [verifyCerts, SetVerifyCerts] = useState<boolean>(false);

  const handleCaCertsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    SetCaCerts(event.target.value);
  };
  const handleRegionNameChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    SetRegionName(event.target.value);
  };
  const handleTimeoutChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    SetTimeout(Number(event.target.value));
  };
  const handleAwaCredentialsChange = (checked: boolean) => {
    SetUseAwsCredentials(checked);
  };
  const handleUseSSLChange = (checked: boolean) => {
    SetUseSSL(checked);
  };
  const handleVerifyCertsChange = (checked: boolean) => {
    SetVerifyCerts(checked);
  };

  return (
    <Form className="metadata-to-es-config-form" layout="vertical">
      <Form.Item label={startCase('caCerts')}>
        <Text className="input-field-descriptions">
          {t('message.field-ca-certs-description')}
        </Text>
        <Input
          value={metadataToESConfig?.caCerts}
          onChange={handleCaCertsChange}
        />
      </Form.Item>
      <Form.Item label={startCase('regionName')}>
        <Text className="input-field-descriptions">
          {t('message.field-region-name-description')}
        </Text>
        <Input
          value={metadataToESConfig?.regionName}
          onChange={handleRegionNameChange}
        />
      </Form.Item>
      <Form.Item label={startCase('timeout')}>
        <Text className="input-field-descriptions">
          {t('message.field-timeout-description')}
        </Text>
        <Input
          type="number"
          value={metadataToESConfig?.timeout}
          onChange={handleTimeoutChange}
        />
      </Form.Item>
      <Divider />
      <Form.Item>
        <Space>
          <Text>{startCase('useAwsCredentials')}</Text>
          <Switch
            checked={metadataToESConfig?.useAwsCredentials}
            onClick={handleAwaCredentialsChange}
          />
        </Space>
        <Text className="switch-field-descriptions">
          {t('message.field-use-aws-credentials-description')}
        </Text>
      </Form.Item>
      <Divider />
      <Form.Item>
        <Space>
          <Text>{startCase('useSSL')}</Text>
          <Switch
            checked={metadataToESConfig?.useSSL}
            onClick={handleUseSSLChange}
          />
        </Space>
        <Text className="switch-field-descriptions">
          {t('message.field-use-ssl-description')}
        </Text>
      </Form.Item>
      <Divider />
      <Form.Item>
        <Space>
          <Text>{startCase('verifyCerts')}</Text>
          <Switch
            checked={metadataToESConfig?.verifyCerts}
            onClick={handleVerifyCertsChange}
          />
        </Space>
        <Text className="switch-field-descriptions">
          {t('message.field-verify-certs-description')}
        </Text>
      </Form.Item>
      <Divider />
      <Row justify="end">
        <Col>
          <Button type="link" onClick={handlePrev}>
            {t('label.back')}
          </Button>
        </Col>
        <Col>
          <Button
            type="primary"
            onClick={() => {
              handleMetadataToESConfig({
                caCerts,
                regionName,
                timeout,
                useAwsCredentials,
                useSSL,
                verifyCerts,
              });
              handleNext();
            }}>
            {t('label.next')}
          </Button>
        </Col>
      </Row>
    </Form>
  );
}
