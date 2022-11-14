import { Button, Form, Input, Switch } from 'antd';
import React, { useState } from 'react';
import { ConfigClass } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';

interface Props {
  metadataToESConfig?: ConfigClass;
  handleMetadataToESConfig: (data: ConfigClass) => void;
  handlePrev: () => void;
  handleNext: () => void;
}

export default function MetadataToESConfigForm({
  metadataToESConfig,
  handleMetadataToESConfig,
  handlePrev,
  handleNext,
}: Props) {
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
    <Form layout="vertical">
      <Form.Item label="caCerts">
        <Input
          value={metadataToESConfig?.caCerts}
          onChange={handleCaCertsChange}
        />
      </Form.Item>
      <Form.Item label="regionName">
        <Input
          value={metadataToESConfig?.regionName}
          onChange={handleRegionNameChange}
        />
      </Form.Item>
      <Form.Item label="timeout">
        <Input
          type="number"
          value={metadataToESConfig?.timeout}
          onChange={handleTimeoutChange}
        />
      </Form.Item>
      <Form.Item label="useAwsCredentials">
        <Switch
          checked={metadataToESConfig?.useAwsCredentials}
          onClick={handleAwaCredentialsChange}
        />
      </Form.Item>
      <Form.Item label="useSSL">
        <Switch
          checked={metadataToESConfig?.useSSL}
          onClick={handleUseSSLChange}
        />
      </Form.Item>
      <Form.Item label="verifyCerts">
        <Switch
          checked={metadataToESConfig?.verifyCerts}
          onClick={handleVerifyCertsChange}
        />
      </Form.Item>
      <Button type="link" onClick={handlePrev}>
        Back
      </Button>
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
        Next
      </Button>
    </Form>
  );
}
