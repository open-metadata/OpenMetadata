/*
 *  Copyright 2021 Collate
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
import {
  confirmationBodyText,
  confirmHeadertext,
} from '../../../constants/feed.constants';
import ConfirmationModal from '../../Modals/ConfirmationModal/ConfirmationModal';

interface DeleteConfirmationModalProp {
  onDiscard: () => void;
  onDelete: () => void;
}

const DeleteConfirmationModal: FC<DeleteConfirmationModalProp> = ({
  onDiscard,
  onDelete,
}) => {
  return (
    <ConfirmationModal
      bodyClassName="tw-h-18"
      bodyText={confirmationBodyText}
      cancelText="Cancel"
      className="tw-w-auto tw-h-screen"
      confirmText="Delete"
      header={confirmHeadertext}
      onCancel={onDiscard}
      onConfirm={onDelete}
    />
  );
};

export default DeleteConfirmationModal;
