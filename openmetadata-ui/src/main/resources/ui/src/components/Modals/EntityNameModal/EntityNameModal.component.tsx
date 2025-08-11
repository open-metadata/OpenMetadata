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
import { Button, Form, FormProps, Modal, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ENTITY_NAME_REGEX } from '../../../constants/regex.constants';
import SanitizedInput from '../../common/SanitizedInput/SanitizedInput';
import { EntityName, EntityNameModalProps } from './EntityNameModal.interface';

const EntityNameModal = <T extends EntityName>({
  visible,
  entity,
  onCancel,
  onSave,
  title,
  // re-name will update actual name of the entity, it will impact across application
  // By default its disabled, send allowRename true to get the functionality
  allowRename = false,
  nameValidationRules = [],
  additionalFields,
  displayNameValidationRules = [],
}: EntityNameModalProps<T>) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);

  const handleSave: FormProps['onFinish'] = async (obj) => {
    setIsLoading(true);
    await form.validateFields();
    // Error must be handled by the parent component
    await onSave(obj);
    setIsLoading(false);
  };

  useEffect(() => {
    form.setFieldsValue(entity);
  }, [visible]);

  return (
    <Modal
      destroyOnClose
      closable={false}
      footer={[
        <Button key="cancel-btn" type="link" onClick={onCancel}>
          {t('label.cancel')}
        </Button>,
        <Button
          data-testid="save-button"
          key="save-btn"
          loading={isLoading}
          type="primary"
          onClick={() => form.submit()}>
          {t('label.save')}
        </Button>,
      ]}
      maskClosable={false}
      okText={t('label.save')}
      open={visible}
      title={
        <Typography.Text strong data-testid="header">
          {title}
        </Typography.Text>
      }
      onCancel={onCancel}>
      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Form.Item
          label={t('label.name')}
          name="name"
          rules={[
            {
              required: true,
              message: `${t('label.field-required', {
                field: t('label.name'),
              })}`,
            },
            {
              pattern: ENTITY_NAME_REGEX,
              message: t('message.entity-name-validation'),
            },
            ...nameValidationRules,
          ]}>
          <SanitizedInput
            disabled={!allowRename}
            placeholder={t('label.enter-entity-name', {
              entity: t('label.glossary'),
            })}
          />
        </Form.Item>
        <Form.Item
          label={t('label.display-name')}
          name="displayName"
          rules={displayNameValidationRules}>
          <SanitizedInput placeholder={t('message.enter-display-name')} />
        </Form.Item>

        {additionalFields}
      </Form>
    </Modal>
  );
};

export default EntityNameModal;
