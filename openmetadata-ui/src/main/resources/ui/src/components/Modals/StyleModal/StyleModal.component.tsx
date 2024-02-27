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
import { Form, FormProps, Input, Modal } from 'antd';
import { isUndefined, omit } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { HEX_COLOR_CODE_REGEX } from '../../../constants/regex.constants';
import ColorPicker from '../../common/ColorPicker/ColorPicker.component';
import FormItemLabel from '../../common/Form/FormItemLabel';
import { StyleModalProps, StyleWithInput } from './StyleModal.interface';

const StyleModal = ({ open, onCancel, onSubmit, style }: StyleModalProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [saving, setSaving] = React.useState<boolean>(false);

  const handleSubmit: FormProps<StyleWithInput>['onFinish'] = async (value) => {
    try {
      setSaving(true);
      await onSubmit(omit(value, 'colorInput'));
    } catch (err) {
      // Error is handled in parent component
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      cancelText={t('label.cancel')}
      okButtonProps={{
        form: 'style-modal',
        htmlType: 'submit',
        loading: saving,
      }}
      okText={t('label.submit')}
      open={open}
      title={t('label.edit-entity', { entity: t('label.style') })}
      onCancel={onCancel}>
      <Form<StyleWithInput>
        form={form}
        id="style-modal"
        initialValues={{
          ...style,
          colorInput: style?.color,
        }}
        layout="vertical"
        onFinish={handleSubmit}
        onValuesChange={(value) => {
          if (!isUndefined(value.color)) {
            form.setFieldValue('colorInput', value.color);
          }
          if (!isUndefined(value.colorInput)) {
            form.setFieldValue('color', value.colorInput);
          }
        }}>
        <Form.Item
          label={
            <FormItemLabel
              align={{ targetOffset: [18, 0] }}
              helperText={t('message.govern-url-size-message')}
              label={t('label.icon-url')}
              placement="topLeft"
            />
          }
          name="iconURL">
          <Input
            data-testid="icon-url"
            placeholder={t('label.enter-entity', {
              entity: t('label.icon-url'),
            })}
          />
        </Form.Item>
        <Form.Item
          label={t('label.color')}
          name="color"
          rules={[
            {
              pattern: HEX_COLOR_CODE_REGEX,
              message: t('message.hex-color-validation'),
            },
          ]}>
          <ColorPicker />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default StyleModal;
