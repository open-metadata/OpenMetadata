/*
 *  Copyright 2024 Collate.
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
import { AxiosError } from 'axios';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VALIDATION_MESSAGES } from '../../../../constants/constants';
import { testEmailConnection } from '../../../../rest/settingConfigAPI';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';

interface TesEmailProps {
  onCancel: () => void;
}

const TestEmail = ({ onCancel }: TesEmailProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit: FormProps['onFinish'] = async (values) => {
    try {
      setIsLoading(true);
      const res = await testEmailConnection(values);
      showSuccessToast(res.data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
      onCancel();
    }
  };

  return (
    <Modal
      destroyOnClose
      open
      closable={false}
      closeIcon={null}
      data-testid="test-email-modal"
      maskClosable={false}
      okButtonProps={{
        htmlType: 'submit',
        id: 'test-email-form',
        form: 'test-email-form',
        loading: isLoading,
      }}
      okText={t('label.test')}
      title={t('label.test-email-connection')}
      onCancel={onCancel}>
      <Form
        data-testid="test-email-form"
        form={form}
        id="test-email-form"
        layout="vertical"
        validateMessages={VALIDATION_MESSAGES}
        onFinish={handleSubmit}>
        <Form.Item
          label={t('label.email')}
          name="email"
          rules={[{ type: 'email', required: true }]}>
          <Input
            autoFocus
            data-testid="test-email-input"
            placeholder={t('label.enter-entity', {
              entity: t('label.email-lowercase'),
            })}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default TestEmail;
