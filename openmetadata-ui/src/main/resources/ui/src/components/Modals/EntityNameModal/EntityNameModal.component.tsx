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
import {
  Button,
  Dialog,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import { Form, FormProps } from 'antd';
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
    if (visible) {
      form.setFieldsValue(entity);
    }
  }, [visible]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onCancel();
    }
  };

  return (
    <ModalOverlay isOpen={visible} onOpenChange={handleOpenChange}>
      <Modal>
        <Dialog data-testid="entity-name-modal" title={title}>
          <Dialog.Content>
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
          </Dialog.Content>
          <Dialog.Footer>
            <Button color="secondary" onPress={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              data-testid="save-button"
              isLoading={isLoading}
              onPress={() => form.submit()}>
              {t('label.save')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default EntityNameModal;
