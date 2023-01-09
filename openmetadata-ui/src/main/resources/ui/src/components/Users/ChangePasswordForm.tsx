/*
 *  Copyright 2022 Collate.
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

import { Form, Input, Modal } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { passwordErrorMessage } from '../../constants/ErrorMessages.constant';
import { passwordRegex } from '../../constants/regex.constants';
import { ChangePasswordRequest } from '../../generated/auth/changePasswordRequest';

type ChangePasswordForm = {
  visible: boolean;
  onCancel: () => void;
  onSave: (data: ChangePasswordRequest) => void;
  isLoggedinUser: boolean;
  isLoading: boolean;
};

const ChangePasswordForm: React.FC<ChangePasswordForm> = ({
  visible,
  onCancel,
  onSave,
  isLoggedinUser,
  isLoading,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const newPassword = Form.useWatch('newPassword', form);

  return (
    <Modal
      centered
      closable={false}
      confirmLoading={isLoading}
      okButtonProps={{
        form: 'change-password-form',
        type: 'primary',
        htmlType: 'submit',
      }}
      okText={t('label.update-password')}
      open={visible}
      title={t('label.change-entity', {
        entity: t('label.password'),
      })}
      width={500}
      onCancel={() => {
        form.resetFields();
        onCancel();
      }}>
      <Form
        form={form}
        id="change-password-form"
        layout="vertical"
        name="change-password-form"
        validateMessages={{ required: '${label} is required' }}
        onFinish={onSave}>
        {isLoggedinUser && (
          <Form.Item
            label={t('label.old-password')}
            name="oldPassword"
            rules={[
              {
                required: true,
              },
            ]}>
            <Input.Password
              data-testid="name"
              placeholder={t('label.enter-type-password', {
                type: t('label.old'),
              })}
            />
          </Form.Item>
        )}
        <Form.Item
          label={t('label.new-password')}
          name="newPassword"
          rules={[
            {
              required: true,
            },
            {
              pattern: passwordRegex,
              message: passwordErrorMessage,
            },
          ]}>
          <Input.Password
            placeholder={t('label.enter-type-password', {
              type: t('label.new'),
            })}
          />
        </Form.Item>
        <Form.Item
          label={t('label.confirm-new-password')}
          name="confirmPassword"
          rules={[
            {
              validator: (_, value) => {
                if (value !== newPassword) {
                  return Promise.reject(t('label.password-not-match'));
                }

                return Promise.resolve();
              },
            },
          ]}>
          <Input.Password placeholder={t('label.confirm-new-password')} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ChangePasswordForm;
