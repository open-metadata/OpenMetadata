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

import { Form, FormProps, Input, Modal } from 'antd';
import { AxiosError } from 'axios';
import { FunctionComponent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User } from '../../../generated/entity/teams/user';
import { showErrorToast } from '../../../utils/ToastUtils';

interface ProfileEditModalProps {
  userData: User;
  onCancel: () => void;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<void>;
}

export const ProfileEditModal: FunctionComponent<ProfileEditModalProps> = ({
  userData,
  onCancel,
  updateUserDetails,
}: ProfileEditModalProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSaveData: FormProps['onFinish'] = async ({
    displayName,
  }): Promise<void> => {
    setIsLoading(true);
    try {
      await updateUserDetails({ displayName }, 'displayName');
      onCancel();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    form.setFieldsValue({ displayName: userData.displayName });
  }, [userData.displayName]);

  return (
    <Modal
      centered
      open
      cancelText={t('label.cancel')}
      closable={false}
      confirmLoading={isLoading}
      data-testid="profile-edit-modal"
      maskClosable={false}
      okButtonProps={{
        form: 'profile-edit-form',
        type: 'primary',
        htmlType: 'submit',
      }}
      okText={t('label.save')}
      title={t('label.edit-entity', {
        entity: t('label.display-name'),
      })}
      width={500}
      onCancel={onCancel}>
      <Form
        form={form}
        id="profile-edit-form"
        layout="vertical"
        onFinish={handleSaveData}>
        <Form.Item label={t('label.display-name')} name="displayName">
          <Input
            data-testid="displayName-input"
            placeholder={t('label.display-name')}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
