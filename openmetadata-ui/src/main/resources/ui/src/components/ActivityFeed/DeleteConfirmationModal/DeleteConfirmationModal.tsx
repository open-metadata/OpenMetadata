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

import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from '../../Modals/ConfirmationModal/ConfirmationModal';
import { DeleteConfirmationModalProp } from './DeleteConfirmationModal.interface';

const DeleteConfirmationModal: FC<DeleteConfirmationModalProp> = ({
  onDiscard,
  onDelete,
  visible,
}) => {
  const { t } = useTranslation();

  return (
    <ConfirmationModal
      bodyText={t('message.confirm-delete-message')}
      cancelText={t('label.cancel')}
      confirmText={t('label.delete')}
      header={t('message.delete-message-question-mark')}
      visible={visible}
      onCancel={onDiscard}
      onConfirm={onDelete}
    />
  );
};

export default DeleteConfirmationModal;
