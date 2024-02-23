/*
 *  Copyright 2023 Collate.
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

import { Button, Col, Form, Input, Row, Select, Switch } from 'antd';
import React, { FocusEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { VALIDATION_MESSAGES } from '../../../../constants/constants';
import { TRANSPORTATION_STRATEGY_OPTIONS } from '../../../../constants/EmailConfig.constants';
import { SMTPSettings } from '../../../../generated/email/smtpSettings';

interface EmailConfigFormProps {
  isLoading: boolean;
  emailConfigValues?: SMTPSettings;
  onSubmit: (configValues: SMTPSettings) => void;
  onCancel: () => void;
  onFocus: (event: FocusEvent<HTMLFormElement>) => void;
}

const { Item } = Form;

function EmailConfigForm({
  emailConfigValues,
  isLoading,
  onCancel,
  onFocus,
  onSubmit,
}: EmailConfigFormProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  return (
    <Form
      form={form}
      id="email-config-form"
      initialValues={emailConfigValues}
      layout="vertical"
      name="email-configuration"
      validateMessages={VALIDATION_MESSAGES}
      onFinish={onSubmit}
      onFocus={onFocus}>
      <Item
        label={t('label.username')}
        name="username"
        rules={[{ required: true }]}>
        <Input id="root/username" />
      </Item>
      <Item
        label={t('label.password')}
        name="password"
        rules={[{ required: true }]}>
        <Input id="root/password" type="password" />
      </Item>
      <Item
        label={t('label.sender-email')}
        name="senderMail"
        rules={[{ required: true }]}>
        <Input id="root/senderMail" type="email" />
      </Item>
      <Item
        label={t('label.open-metadata-url')}
        name="openMetadataUrl"
        rules={[{ required: true }]}>
        <Input id="root/openMetadataUrl" />
      </Item>
      <Item
        label={t('label.server-endpoint')}
        name="serverEndpoint"
        rules={[{ required: true }]}>
        <Input id="root/serverEndpoint" />
      </Item>
      <Item
        label={t('label.server-port')}
        name="serverPort"
        rules={[{ required: true }]}>
        <Input id="root/serverPort" type="number" />
      </Item>
      <Item label={t('label.emailing-entity')} name="emailingEntity">
        <Input id="root/emailingEntity" />
      </Item>
      <Item name="enableSmtpServer">
        <Row>
          <Col span={8}>{t('label.enable-smtp-server')}</Col>
          <Col span={16}>
            <Switch
              defaultChecked={emailConfigValues?.enableSmtpServer}
              id="root/enableSmtpServer"
              onChange={(value) =>
                form.setFieldsValue({ enableSmtpServer: value })
              }
            />
          </Col>
        </Row>
      </Item>
      <Item label={t('label.support-url')} name="supportUrl">
        <Input id="root/supportUrl" />
      </Item>
      <Item
        label={t('label.transportation-strategy')}
        name="transportationStrategy">
        <Select
          id="root/transportationStrategy"
          options={TRANSPORTATION_STRATEGY_OPTIONS}
        />
      </Item>
      <Row justify="end">
        <Col>
          <Button type="link" onClick={onCancel}>
            {t('label.cancel')}
          </Button>
        </Col>
        <Col>
          <Button htmlType="submit" loading={isLoading} type="primary">
            {t('label.submit')}
          </Button>
        </Col>
      </Row>
    </Form>
  );
}

export default EmailConfigForm;
