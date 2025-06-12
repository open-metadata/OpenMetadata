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

import { Button, Input, Modal, Typography } from 'antd';
import { AxiosError } from 'axios';
import { FunctionComponent, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User } from '../../../generated/entity/teams/user';
import { showErrorToast } from '../../../utils/ToastUtils';
import './profile-edit-modal.less';

interface ProfileEditModalProps {
  userData: User;
  header: string;
  value: string;
  placeholder: string;
  onSave?: () => void;
  onCancel?: () => void;
  visible: boolean;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<void>;
}

export const ProfileEditModal: FunctionComponent<ProfileEditModalProps> = ({
  userData,
  onSave,
  onCancel,
  visible,
  updateUserDetails,
}: ProfileEditModalProps) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [displayName, setDisplayName] = useState(userData.displayName);

  const handleSaveData = async () => {
    setIsLoading(true);
    try {
      await updateUserDetails({ displayName }, 'displayName');
      onSave?.();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const onDisplayNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value),
    []
  );

  return (
    <Modal
      centered
      closable
      destroyOnClose
      className="profile-edit-modal"
      data-testid="profile-edit-modal"
      footer={[
        <Button
          className="m-t-xs m-r-xs cancel-name-edit-btn"
          data-testid="cancel"
          disabled={isLoading}
          key="cancelButton"
          type="primary"
          onClick={onCancel}>
          {t('label.cancel')}
        </Button>,
        <Button
          className="m-t-xs save-updated-name-btn"
          data-testid="save-display-name"
          key="saveButton"
          loading={isLoading}
          type="primary"
          onClick={handleSaveData}>
          {t('label.save')}
        </Button>,
      ]}
      maskClosable={false}
      open={visible}
      title={
        <Typography.Text className="modal-header">
          {t('label.edit-name')}
        </Typography.Text>
      }
      onCancel={onCancel}>
      <Typography.Text className="modal-label m-b-xs">
        {t('label.display-name')}
      </Typography.Text>
      <Input
        className="w-full display-name-edit-input"
        data-testid="displayName"
        id="displayName"
        name="displayName"
        placeholder={t('label.display-name')}
        type="text"
        value={displayName}
        onChange={onDisplayNameChange}
      />
    </Modal>
  );
};
