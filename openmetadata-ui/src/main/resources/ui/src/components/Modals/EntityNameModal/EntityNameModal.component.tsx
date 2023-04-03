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
import { Button, Form, Input, Modal, Typography } from 'antd';
import { EntityReference } from 'generated/type/entityReference';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  visible: boolean;
  onCancel: () => void;
  onSave: (obj: { name: string; displayName: string }) => void;
  entity: EntityReference;
}

const EntityNameModal: React.FC<Props> = ({
  visible,
  entity,
  onCancel,
  onSave,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<{ name: string; displayName: string }>();

  const handleSave = async (obj: { name: string; displayName: string }) => {
    try {
      await form.validateFields();
      onSave(obj);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    form.setFieldsValue({ name: entity.name, displayName: entity.displayName });
  }, [visible]);

  return (
    <Modal
      destroyOnClose
      footer={[
        <Button key="cancel-btn" type="link" onClick={onCancel}>
          {t('label.cancel')}
        </Button>,
        <Button
          data-testid="save-button"
          key="save-btn"
          type="primary"
          onClick={() => form.submit()}>
          {t('label.save')}
        </Button>,
      ]}
      okText={t('label.save')}
      open={visible}
      title={
        <Typography.Text strong data-testid="header">
          {t('label.edit-glossary-name')}
        </Typography.Text>
      }>
      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Form.Item
          extra={
            <Typography.Text className="help-text p-x-xs m-t-xs tw-text-xs tw-text-grey-muted">
              {t('message.edit-glossary-name-help')}
            </Typography.Text>
          }
          label={`${t('label.name')}:`}
          name="name"
          rules={[
            {
              required: true,
              message: `${t('label.field-required', {
                field: t('label.name'),
              })}`,
            },
          ]}>
          <Input
            placeholder={t('label.enter-entity-name', {
              entity: t('label.glossary'),
            })}
          />
        </Form.Item>
        <Form.Item
          extra={
            <Typography.Text className="help-text p-x-xs tw-text-xs tw-text-grey-muted">
              {t('message.edit-glossary-display-name-help')}
            </Typography.Text>
          }
          label={`${t('label.display-name')}:`}
          name="displayName"
          rules={[
            {
              required: true,
              message: `${t('label.field-required', {
                field: t('label.name'),
              })}`,
            },
          ]}>
          <Input placeholder={t('message.enter-display-name')} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EntityNameModal;
