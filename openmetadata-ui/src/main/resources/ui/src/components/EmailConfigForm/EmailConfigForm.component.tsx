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

import { Button, Col, Form, Row } from 'antd';
import { VALIDATION_MESSAGES } from 'constants/constants';
import { TRANSPORTATION_STRATEGY_OPTIONS } from 'constants/EmailConfig.constants';
import { SMTPSettings } from 'generated/email/smtpSettings';
import React, { FocusEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FieldProp, FieldTypes, generateFormFields } from 'utils/formUtils';

interface EmailConfigFormProps {
  emailConfigValues?: SMTPSettings;
  onSubmit: (configValues: SMTPSettings) => void;
  onCancel: () => void;
  onFocus: (event: FocusEvent<HTMLFormElement>) => void;
}

function EmailConfigForm({
  emailConfigValues,
  onCancel,
  onFocus,
  onSubmit,
}: EmailConfigFormProps) {
  const { t } = useTranslation();

  const emailConfigFields: FieldProp[] = [
    {
      name: 'username',
      id: 'root/username',
      required: true,
      label: t('label.username'),
      type: FieldTypes.TEXT,
    },
    {
      name: 'password',
      id: 'root/password',
      required: true,
      label: t('label.password'),
      type: FieldTypes.TEXT,
      props: {
        type: 'password',
      },
    },
    {
      name: 'senderMail',
      id: 'root/senderMail',
      required: true,
      label: t('label.sender-email'),
      type: FieldTypes.TEXT,
      props: {
        type: 'email',
      },
    },
    {
      name: 'openMetadataUrl',
      id: 'root/openMetadataUrl',
      required: true,
      label: t('label.open-metadata-url'),
      type: FieldTypes.TEXT,
    },
    {
      name: 'serverEndpoint',
      id: 'root/serverEndpoint',
      required: true,
      label: t('label.server-endpoint'),
      type: FieldTypes.TEXT,
    },
    {
      name: 'serverPort',
      id: 'root/serverPort',
      required: true,
      label: t('label.server-port'),
      type: FieldTypes.NUMBER,
      props: {
        className: 'w-full',
      },
    },
    {
      name: 'emailingEntity',
      id: 'root/emailingEntity',
      required: false,
      label: t('label.emailing-entity'),
      type: FieldTypes.TEXT,
    },
    {
      name: 'enableSmtpServer',
      id: 'root/enableSmtpServer',
      required: false,
      label: t('label.enable-smtp-server'),
      type: FieldTypes.SWITCH,
      itemProps: {
        valuePropName: 'checked',
      },
    },
    {
      name: 'supportUrl',
      id: 'root/supportUrl',
      required: false,
      label: t('label.support-url'),
      type: FieldTypes.TEXT,
    },
    {
      name: 'transportationStrategy',
      id: 'root/transportationStrategy',
      required: false,
      label: t('label.transportation-strategy'),
      type: FieldTypes.SELECT,
      props: {
        options: TRANSPORTATION_STRATEGY_OPTIONS,
      },
    },
  ];

  return (
    <Form
      id="email-config-form"
      initialValues={emailConfigValues}
      layout="vertical"
      name="email-configuration"
      validateMessages={VALIDATION_MESSAGES}
      onFinish={onSubmit}
      onFocus={onFocus}>
      {generateFormFields(emailConfigFields)}
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
