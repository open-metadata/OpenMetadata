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
      title={t('label.change-password')}
      visible={visible}
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
              placeholder={t('label.enter-old-password')}
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
          <Input.Password placeholder={t('label.enter-new-password')} />
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
