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

import { Box } from '@mui/material';
import { Form, FormProps, Modal } from 'antd';
import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { iconTooltipDataRender } from '../../../utils/DomainUtils';
import { MUIColorPicker } from '../../common/ColorPicker';
import { DEFAULT_TAG_ICON, MUIIconPicker } from '../../common/IconPicker';
import { StyleModalProps } from './StyleModal.interface';

const StyleModalNew: FC<StyleModalProps> = ({
  open,
  onCancel,
  onSubmit,
  style,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState<boolean>(false);

  const selectedColor = Form.useWatch('color', form);

  const handleSubmit: FormProps['onFinish'] = async (values) => {
    try {
      setSaving(true);
      await onSubmit(values);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      cancelText={t('label.cancel')}
      okButtonProps={{
        form: 'style-modal-new',
        htmlType: 'submit',
        loading: saving,
      }}
      okText={t('label.save')}
      open={open}
      title={t('label.edit-entity', { entity: t('label.style') })}
      onCancel={onCancel}>
      <Form
        form={form}
        id="style-modal-new"
        initialValues={{
          iconURL: style?.iconURL,
          color: style?.color,
        }}
        layout="vertical"
        onFinish={handleSubmit}>
        <Box sx={{ mb: 3 }}>
          <Form.Item name="iconURL" trigger="onChange" valuePropName="value">
            <MUIIconPicker
              allowUrl
              backgroundColor={selectedColor}
              customStyles={{
                searchBoxWidth: 366,
              }}
              defaultIcon={DEFAULT_TAG_ICON}
              label={t('label.icon')}
              placeholder={t('label.icon-url')}
              toolTip={iconTooltipDataRender()}
            />
          </Form.Item>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Form.Item name="color" trigger="onChange" valuePropName="value">
            <MUIColorPicker label={t('label.color')} />
          </Form.Item>
        </Box>
      </Form>
    </Modal>
  );
};

export default StyleModalNew;
