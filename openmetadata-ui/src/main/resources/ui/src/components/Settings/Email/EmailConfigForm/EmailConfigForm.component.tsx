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

import { Box, Grid, Toggle } from '@openmetadata/ui-core-components';
import { Button, Form, Input, Select } from 'antd';
import { FocusEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { VALIDATION_MESSAGES } from '../../../../constants/constants';
import {
  EMAIL_CONFIG_FORM_FIELDS,
  TRANSPORTATION_STRATEGY_OPTIONS,
} from '../../../../constants/EmailConfig.constants';
import { SMTPSettings } from '../../../../generated/email/smtpSettings';

interface EmailConfigFormProps {
  isLoading: boolean;
  emailConfigValues?: SMTPSettings;
  /** Fields the deployment configuration owns: shown, but not editable. */
  managedFields?: (keyof SMTPSettings)[];
  onSubmit: (configValues: SMTPSettings) => void;
  onCancel: () => void;
  onFocus: (event: FocusEvent<HTMLFormElement>) => void;
}

const { Item } = Form;

function EmailConfigForm({
  emailConfigValues,
  isLoading,
  managedFields = [],
  onCancel,
  onFocus,
  onSubmit,
}: EmailConfigFormProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const isManaged = (field: keyof SMTPSettings) =>
    managedFields.includes(field);
  const isEveryFieldManaged = EMAIL_CONFIG_FORM_FIELDS.every(isManaged);

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
        <Input
          data-testid="username-input"
          disabled={isManaged('username')}
          id="root/username"
        />
      </Item>
      <Item label={t('label.password')} name="password">
        <Input
          data-testid="password-input"
          disabled={isManaged('password')}
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
          disabled={isManaged('senderMail')}
          id="root/senderMail"
          type="email"
        />
      </Item>
      <Item
        label={t('label.server-endpoint')}
        name="serverEndpoint"
        rules={[{ required: true }]}>
        <Input
          data-testid="server-endpoint-input"
          disabled={isManaged('serverEndpoint')}
          id="root/serverEndpoint"
        />
      </Item>
      <Item
        label={t('label.server-port')}
        name="serverPort"
        rules={[{ required: true }]}>
        <Input
          data-testid="server-port-input"
          disabled={isManaged('serverPort')}
          id="root/serverPort"
          type="number"
        />
      </Item>
      <Item label={t('label.emailing-entity')} name="emailingEntity">
        <Input
          data-testid="emailing-entity-input"
          disabled={isManaged('emailingEntity')}
          id="root/emailingEntity"
        />
      </Item>
      <Item name="enableSmtpServer">
        <Grid className="layout-row layout-grid">
          <Grid.Item className="layout-column" span={8}>
            {t('label.enable-smtp-server')}
          </Grid.Item>
          <Grid.Item className="layout-column" span={16}>
            <Toggle
              data-testid="smtp-server-input"
              defaultSelected={emailConfigValues?.enableSmtpServer}
              id="root/enableSmtpServer"
              isDisabled={isManaged('enableSmtpServer')}
              size="sm"
              onChange={(value) =>
                form.setFieldsValue({ enableSmtpServer: value })
              }
            />
          </Grid.Item>
        </Grid>
      </Item>
      <Item label={t('label.support-url')} name="supportUrl">
        <Input
          data-testid="support-url-input"
          disabled={isManaged('supportUrl')}
          id="root/supportUrl"
        />
      </Item>
      <Item
        label={t('label.transportation-strategy')}
        name="transportationStrategy">
        <Select
          data-testid="transportation-strategy-input"
          disabled={isManaged('transportationStrategy')}
          id="root/transportationStrategy"
          options={TRANSPORTATION_STRATEGY_OPTIONS}
        />
      </Item>
      <Box className="layout-row" justify="end" wrap="wrap">
        <Box className="layout-column tw:block">
          <Button type="link" onClick={onCancel}>
            {t('label.cancel')}
          </Button>
        </Box>
        {!isEveryFieldManaged && (
          <Box className="layout-column tw:block">
            <Button htmlType="submit" loading={isLoading} type="primary">
              {t('label.save')}
            </Button>
          </Box>
        )}
      </Box>
    </Form>
  );
}

export default EmailConfigForm;
