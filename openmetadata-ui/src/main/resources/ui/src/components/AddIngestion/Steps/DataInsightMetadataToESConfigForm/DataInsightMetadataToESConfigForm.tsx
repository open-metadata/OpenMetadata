/*
 *  Copyright 2022 Collate.
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

import { Button, Col, Divider, Form, Input, Row, Switch } from 'antd';
import { AddIngestionState } from 'components/AddIngestion/addIngestion.interface';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfigClass } from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import '../MetadataToESConfigForm/MetadataToESConfigForm.less';

interface Props {
  data: AddIngestionState;
  handleMetadataToESConfig: (data: ConfigClass) => void;
  handlePrev: () => void;
  handleNext: () => void;
  onFocus: (fieldId: string) => void;
}

const { Item } = Form;

const DataInsightMetadataToESConfigForm = ({
  handleMetadataToESConfig,
  handlePrev,
  handleNext,
  onFocus,
  data,
}: Props) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  const handleSubmit = (values: ConfigClass) => {
    handleMetadataToESConfig({
      ...values,
    });
    handleNext();
  };

  const initialValues = useMemo(
    () => ({
      caCerts: data.metadataToESConfig?.caCerts,
      regionName: data.metadataToESConfig?.regionName,
      timeout: data.metadataToESConfig?.timeout,
      useAwsCredentials: data.metadataToESConfig?.useAwsCredentials,
      useSSL: data.metadataToESConfig?.useSSL,
      verifyCerts: data.metadataToESConfig?.verifyCerts,
    }),
    [data]
  );

  return (
    <Form
      className="metadata-to-es-config-form"
      form={form}
      initialValues={initialValues}
      layout="vertical"
      onFinish={handleSubmit}
      onFocus={(e) => onFocus(e.target.id)}>
      <Item label={t('label.ca-certs')} name="caCerts">
        <Input id="root/caCerts" />
      </Item>
      <Item label={t('label.region-name')} name="regionName">
        <Input id="root/regionName" />
      </Item>
      <Item label={t('label.timeout')} name="timeout">
        <Input id="root/timeout" type="number" />
      </Item>
      <Divider />
      <Item name="useAwsCredentials">
        <Row>
          <Col span={8}>{t('label.use-aws-credential-plural')}</Col>
          <Col span={16}>
            <Switch
              defaultChecked={initialValues.useAwsCredentials}
              id="root/useAwsCredentials"
              onChange={(value) =>
                form.setFieldsValue({ useAwsCredentials: value })
              }
            />
          </Col>
        </Row>
      </Item>
      <Divider />
      <Item name="useSSL">
        <Row>
          <Col span={8}>{t('label.use-ssl-uppercase')}</Col>
          <Col span={16}>
            <Switch
              defaultChecked={initialValues.useSSL}
              id="root/useSSL"
              onChange={(value) => form.setFieldsValue({ useSSL: value })}
            />
          </Col>
        </Row>
      </Item>
      <Divider />
      <Item name="verifyCerts">
        <Row>
          <Col span={8}>{t('label.verify-cert-plural')}</Col>
          <Col span={16}>
            <Switch
              defaultChecked={initialValues.verifyCerts}
              id="root/verifyCerts"
              onChange={(value) => form.setFieldsValue({ verifyCerts: value })}
            />
          </Col>
        </Row>
      </Item>
      <Divider />
      <Row justify="end">
        <Col>
          <Button data-testid="back-button" type="link" onClick={handlePrev}>
            {t('label.back')}
          </Button>
        </Col>
        <Col>
          <Button data-testid="next-button" htmlType="submit" type="primary">
            {t('label.next')}
          </Button>
        </Col>
      </Row>
    </Form>
  );
};

export default DataInsightMetadataToESConfigForm;
