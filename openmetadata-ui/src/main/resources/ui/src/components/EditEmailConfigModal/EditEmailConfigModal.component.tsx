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

import { Form, Input, Modal, Select, Switch } from 'antd';
import { TRANSPORTATION_STRATEGY_OPTIONS } from 'constants/EmailConfig.constants';
import { SMTPSettings } from 'generated/email/smtpSettings';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface EditEmailConfigModalProps {
  emailConfigValues?: SMTPSettings;
  showModal: boolean;
  onSubmit: (configValues: SMTPSettings) => void;
  onCancel: () => void;
}

const { Item } = Form;

function EditEmailConfigModal({
  emailConfigValues,
  showModal,
  onCancel,
  onSubmit,
}: EditEmailConfigModalProps) {
  const { t } = useTranslation();

  const handleSubmit = useCallback((updatedData: SMTPSettings) => {
    onSubmit(updatedData);
    onCancel();
  }, []);

  return (
    <Modal
      centered
      destroyOnClose
      closable={false}
      okButtonProps={{
        form: 'email-config-form',
        type: 'primary',
        htmlType: 'submit',
      }}
      okText="Submit"
      open={showModal}
      title={t('label.edit-entity', { entity: t('label.email-configuration') })}
      width={650}
      onCancel={onCancel}>
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
        onFinish={handleSubmit}>
        <Item
          label={t('label.username')}
          name="username"
          rules={[{ required: true }]}>
          <Input />
        </Item>
        <Item
          label={t('label.password')}
          name="password"
          rules={[{ required: true }]}>
          <Input type="password" />
        </Item>
        <Item
          label={t('label.sender-email')}
          name="senderMail"
          rules={[{ required: true }]}>
          <Input type="email" />
        </Item>
        <Item
          label={t('label.open-metadata-url')}
          name="openMetadataUrl"
          rules={[{ required: true }]}>
          <Input />
        </Item>
        <Item
          label={t('label.server-endpoint')}
          name="serverEndpoint"
          rules={[{ required: true }]}>
          <Input />
        </Item>
        <Item
          label={t('label.server-port')}
          name="serverPort"
          rules={[{ required: true }]}>
          <Input type="number" />
        </Item>
        <Item label={t('label.emailing-entity')} name="emailingEntity">
          <Input />
        </Item>
        <Item
          label={t('label.enable-smtp-server')}
          name="enableSmtpServer"
          valuePropName="checked">
          <Switch />
        </Item>
        <Item label={t('label.support-url')} name="supportUrl">
          <Input />
        </Item>
        <Item
          label={t('label.transportation-strategy')}
          name="transportationStrategy">
          <Select options={TRANSPORTATION_STRATEGY_OPTIONS} />
        </Item>
      </Form>
    </Modal>
  );
}

export default EditEmailConfigModal;
