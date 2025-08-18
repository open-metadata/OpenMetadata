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

import { Button, Col, Form, Input, Row, Select } from 'antd';
import { Switch } from 'antd';
import { FocusEvent } from 'react';
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
      data-testid="email-config-form"
      form={form}
      id="email-config-form"
      initialValues={emailConfigValues}
      layout="vertical"
      name="email-configuration"
      validateMessages={VALIDATION_MESSAGES}
      onFinish={onSubmit}
      onFocus={onFocus}>
      <Item label={t('label.username')} name="username">
        <Input data-testid="username-input" id="root/username" />
      </Item>
      <Item label={t('label.password')} name="password">
        <Input
          data-testid="password-input"
          id="root/password"
          type="password"
        />
      </Item>
      <Item
        label={t('label.sender-email')}
        name="senderMail"
        rules={[{ required: true }]}>
        <Input
          data-testid="sender-email-input"
          id="root/senderMail"
          type="email"
        />
      </Item>
      <Item
        label={t('label.server-endpoint')}
        name="serverEndpoint"
        rules={[{ required: true }]}>
        <Input data-testid="server-endpoint-input" id="root/serverEndpoint" />
      </Item>
      <Item
        label={t('label.server-port')}
        name="serverPort"
        rules={[{ required: true }]}>
        <Input
          data-testid="server-port-input"
          id="root/serverPort"
          type="number"
        />
      </Item>
      <Item label={t('label.emailing-entity')} name="emailingEntity">
        <Input data-testid="emailing-entity-input" id="root/emailingEntity" />
      </Item>
      <Item name="enableSmtpServer">
        <Row>
          <Col span={8}>{t('label.enable-smtp-server')}</Col>
          <Col span={16}>
            <Switch
              data-testid="smtp-server-input"
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
        <Input data-testid="support-url-input" id="root/supportUrl" />
      </Item>
      <Item
        label={t('label.transportation-strategy')}
        name="transportationStrategy">
        <Select
          data-testid="transportation-strategy-input"
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
            {t('label.save')}
          </Button>
        </Col>
      </Row>
    </Form>
  );
}

export default EmailConfigForm;
