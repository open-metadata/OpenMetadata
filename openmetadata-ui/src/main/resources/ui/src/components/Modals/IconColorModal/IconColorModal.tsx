/*
 *  Copyright 2025 Collate.
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
import { Form } from 'antd';
import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Style } from '../../../generated/type/schema';
import { iconTooltipDataRender } from '../../../utils/DomainUtils';
import { MUIColorPicker } from '../../common/ColorPicker';
import { DEFAULT_TAG_ICON, MUIIconPicker } from '../../common/IconPicker';
import { StyleModalProps } from '../StyleModal/StyleModal.interface';

const IconColorModal: FC<StyleModalProps> = ({
  open,
  onCancel,
  onSubmit,
  style,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const selectedColor = Form.useWatch('color', form);

  const handleSubmit = async (values: Style) => {
    try {
      setIsSaving(true);
      await onSubmit(values);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalOverlay
      isDismissable={!isSaving}
      isOpen={open}
      onOpenChange={(v) => !v && !isSaving && onCancel()}>
      <Modal data-testid="icon-color-modal">
        <Dialog title={t('label.edit-entity', { entity: t('label.style') })}>
          <Dialog.Content>
            <Form
              form={form}
              id="style-modal-new"
              initialValues={{
                iconURL: style?.iconURL,
                color: style?.color,
              }}
              layout="vertical"
              onFinish={handleSubmit}>
              <div className="tw:mb-6">
                <Form.Item
                  name="iconURL"
                  trigger="onChange"
                  valuePropName="value">
                  <MUIIconPicker
                    allowUrl
                    backgroundColor={selectedColor}
                    data-testid="icon-picker-btn"
                    defaultIcon={DEFAULT_TAG_ICON}
                    label={t('label.icon')}
                    placeholder={t('label.icon-url')}
                    toolTip={iconTooltipDataRender()}
                  />
                </Form.Item>
              </div>

              <div className="tw:mb-6">
                <Form.Item
                  name="color"
                  trigger="onChange"
                  valuePropName="value">
                  <MUIColorPicker label={t('label.color')} />
                </Form.Item>
              </div>
            </Form>
          </Dialog.Content>

          <Dialog.Footer>
            <Button
              color="secondary"
              data-testid="cancel-button"
              isDisabled={isSaving}
              onPress={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              showTextWhileLoading
              color="primary"
              data-testid="save-button"
              isDisabled={isSaving}
              isLoading={isSaving}
              onPress={() => form.submit()}>
              {t('label.save')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default IconColorModal;
