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
import React, { FunctionComponent, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
// import { showErrorToast } from '../../../utils/ToastUtils';
// import RichTextEditor from '../../common/RichTextEditor/RichTextEditor';
import { isEmpty } from 'lodash';
import { User } from '../../../generated/entity/teams/user';
import { showErrorToast } from '../../../utils/ToastUtils';
import { FeedEditor } from '../../ActivityFeed/FeedEditor/FeedEditor';
import { EditorContentRef } from '../ModalWithMarkdownEditor/ModalWithMarkdownEditor.interface';
import './profile-edit-modal.less';
// import {
//   EditorContentRef,
//   ModalWithMarkdownEditorProps,
// } from './ModalWithMarkdownEditor.interface';

interface ProfileEditModalProps {
  userData: User;
  header: string;
  value: string;
  placeholder: string;
  onSave?: (text: string) => Promise<void>;
  onCancel?: () => void;
  visible: boolean;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<void>;
}

export const ProfileEditModal: FunctionComponent<ProfileEditModalProps> = ({
  userData,
  header,
  placeholder,
  value,
  onSave,
  onCancel,
  visible,
  updateUserDetails,
}: ProfileEditModalProps) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [displayName, setDisplayName] = useState(userData.displayName);
  const markdownRef = useRef<EditorContentRef>({} as EditorContentRef);
  const [editorValue, setEditorValue] = useState<string>('');
  const handleDisplayNameSave = useCallback(async () => {
    if (userData.displayName !== displayName) {
      // Compare correctly
      setIsLoading(true);
      try {
        await updateUserDetails(
          { displayName: isEmpty(displayName) ? undefined : displayName },
          'displayName'
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    }
  }, [displayName, updateUserDetails, userData.displayName]);

  const handleSaveData = async () => {
    await handleDisplayNameSave();
    if (markdownRef.current) {
      setIsLoading(true);
      try {
        const content = markdownRef.current?.getEditorContent?.()?.trim() ?? '';
        await onSave?.(content);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
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
          className="m-t-xs m-r-xs cancel-btn"
          data-testid="cancel"
          disabled={isLoading}
          key="cancelButton"
          type="primary"
          onClick={onCancel}>
          {t('label.cancel')}
        </Button>,
        <Button
          className="m-t-xs"
          data-testid="save"
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
          {t('label.edit-profile')}
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
      <Typography.Text className="modal-label m-b-xs">
        {t('label.description')}
      </Typography.Text>
      <FeedEditor
        defaultValue={userData.description}
        placeHolder={userData.description}
        // ref={editorRef}
        // onChangeHandler={()=>setDes}
        onSave={handleSaveData}
      />
    </Modal>
  );
};
