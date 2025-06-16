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
import { Modal, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import './customise-home-modal.less';
import { CustomiseHomeModalProps } from './CustomiseHomeModal.interface';

const CustomiseHomeModal = ({ onClose, open }: CustomiseHomeModalProps) => {
  const { t } = useTranslation();

  return (
    <Modal open={open} onCancel={onClose}>
      <div className="customise-home-modal">
        <div className="customise-home-modal-header">
          <Typography.Text className="customise-home-modal-title">
            {t('label.customize-entity', {
              entity: t('label.home'),
            })}
          </Typography.Text>
        </div>
      </div>
    </Modal>
  );
};

export default CustomiseHomeModal;
