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

import { SaveOutlined } from '@ant-design/icons';
import { Button, Modal, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import './unsaved-changes-modal.less';
import { UnsavedChangesModalProps } from './UnsavedChangesModal.interface';

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  open,
  onDiscard,
  onSave,
  onCancel,
  title,
  description,
  discardText,
  saveText,
  loading = false,
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      centered
      closable
      className="unsaved-changes-modal-container"
      data-testid="unsaved-changes-modal"
      footer={null}
      open={open}
      width={400}
      onCancel={onCancel}>
      <div className="unsaved-changes-modal">
        <div className="unsaved-changes-modal-body">
          <div className="unsaved-changes-modal-icon">
            <SaveOutlined />
          </div>

          <div className="unsaved-changes-modal-content">
            <Typography.Title
              className="unsaved-changes-modal-title"
              data-testid="unsaved-changes-modal-title"
              level={5}>
              {title || t('message.unsaved-changes')}
            </Typography.Title>
            <Typography.Text
              className="unsaved-changes-modal-description"
              data-testid="unsaved-changes-modal-description">
              {description || t('message.unsaved-changes-description')}
            </Typography.Text>
          </div>
        </div>

        <div className="unsaved-changes-modal-actions">
          <Button
            className="unsaved-changes-modal-discard"
            data-testid="unsaved-changes-modal-discard"
            onClick={onDiscard}>
            {discardText || t('message.unsaved-changes-discard')}
          </Button>
          <Button
            className="unsaved-changes-modal-save"
            data-testid="unsaved-changes-modal-save"
            loading={loading}
            type="primary"
            onClick={onSave}>
            {saveText || t('message.unsaved-changes-save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
