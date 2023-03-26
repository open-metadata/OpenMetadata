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

import { Form, Input, Modal, Space, Typography } from 'antd';
import { VALIDATION_MESSAGES } from 'constants/constants';
import { delimiterRegex } from 'constants/regex.constants';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface SubmitProps {
  name: string;
}

interface RenameFormProps {
  visible: boolean;
  onCancel: () => void;
  isSaveButtonDisabled: boolean;
  header: string;
  initialValues: SubmitProps;
  onSubmit: (value: SubmitProps) => void;
}

const RenameForm: React.FC<RenameFormProps> = ({
  visible,
  onCancel,
  isSaveButtonDisabled,
  header,
  initialValues,
  onSubmit,
}): JSX.Element => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  useEffect(() => {
    form.setFieldsValue(initialValues);
  }, [initialValues]);

  return (
    <Modal
      centered
      destroyOnClose
      closable={false}
      data-testid="modal-container"
      okButtonProps={{
        form: 'renameForm',
        type: 'primary',
        htmlType: 'submit',
        disabled: isSaveButtonDisabled,
      }}
      okText={t('label.ok')}
      open={visible}
      title={
        <Typography.Text strong data-testid="rename-header">
          {header}
        </Typography.Text>
      }
      width={650}
      onCancel={() => {
        form.setFieldsValue({ name: '' });
        onCancel();
      }}>
      <Form
        data-testid="rename-form"
        form={form}
        initialValues={initialValues}
        layout="vertical"
        name="renameForm"
        validateMessages={VALIDATION_MESSAGES}
        onFinish={onSubmit}>
        <Form.Item
          className="multiple-label-field"
          data-testid="rename-field"
          label={
            <Space direction="vertical" size={0}>
              <Typography.Text>{t('label.name')}</Typography.Text>
              <Typography.Text className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
                {t('message.renaming-entity-message')}
              </Typography.Text>
            </Space>
          }
          name="name"
          rules={[
            {
              required: true,
              type: 'string',
              min: 2,
              max: 64,
              whitespace: true,
            },
            {
              validator: (_, value) => {
                if (delimiterRegex.test(value)) {
                  return Promise.reject(
                    t('message.entity-delimiters-not-allowed', {
                      entity: t('label.name'),
                    })
                  );
                }

                return Promise.resolve();
              },
            },
          ]}>
          <Input data-testid="rename-input" placeholder={t('label.name')} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default RenameForm;
