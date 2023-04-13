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
import { TRANSPORTATION_STRATEGY_OPTIONS } from 'constants/EmailConfig.constants';
import { SMTPSettings } from 'generated/email/smtpSettings';
import React, { FocusEvent } from 'react';
import { useTranslation } from 'react-i18next';

interface EmailConfigFormProps {
  emailConfigValues?: SMTPSettings;
  onSubmit: (configValues: SMTPSettings) => void;
  onBlur: (event: FocusEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  onFocus: (event: FocusEvent<HTMLFormElement>) => void;
}

const { Item } = Form;

function EmailConfigForm({
  emailConfigValues,
  onBlur,
  onCancel,
  onFocus,
  onSubmit,
}: EmailConfigFormProps) {
  const { t } = useTranslation();

  return (
    <Form
      id="email-config-form"
      initialValues={emailConfigValues}
      layout="vertical"
      name="email-configuration"
      validateMessages={{
        required: t('message.field-text-is-required', {
          fieldText: '${label}',
        }),
      }}
      onBlur={onBlur}
      onFinish={onSubmit}
      onFocus={onFocus}>
      <Item
        label={t('label.username')}
        name="username"
        rules={[{ required: true }]}>
        <Input id="username" />
      </Item>
      <Item
        label={t('label.password')}
        name="password"
        rules={[{ required: true }]}>
        <Input id="password" type="password" />
      </Item>
      <Item
        label={t('label.sender-email')}
        name="senderMail"
        rules={[{ required: true }]}>
        <Input id="senderMail" type="email" />
      </Item>
      <Item
        label={t('label.open-metadata-url')}
        name="openMetadataUrl"
        rules={[{ required: true }]}>
        <Input id="openMetadataUrl" />
      </Item>
      <Item
        label={t('label.server-endpoint')}
        name="serverEndpoint"
        rules={[{ required: true }]}>
        <Input id="serverEndpoint" />
      </Item>
      <Item
        label={t('label.server-port')}
        name="serverPort"
        rules={[{ required: true }]}>
        <Input id="serverPort" type="number" />
      </Item>
      <Item label={t('label.emailing-entity')} name="emailingEntity">
        <Input id="emailingEntity" />
      </Item>
      <Item
        label={t('label.enable-smtp-server')}
        name="enableSmtpServer"
        valuePropName="checked">
        <Switch id="enableSmtpServer" />
      </Item>
      <Item id="supportUrl" label={t('label.support-url')} name="supportUrl">
        <Input />
      </Item>
      <Item
        label={t('label.transportation-strategy')}
        name="transportationStrategy">
        <Select
          id="transportationStrategy"
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
          <Button htmlType="submit" type="primary">
            {t('label.submit')}
          </Button>
        </Col>
      </Row>
    </Form>
  );
}

export default EmailConfigForm;
