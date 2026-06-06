/*
 *  Copyright 2026 Collate.
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

import {
  Button,
  Dialog,
  Input,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { FolderPlus } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Folder } from '../../../generated/entity/data/folder';
import { createFolder } from '../../../rest/assetAPI';
import { showErrorToast } from '../../../utils/ToastUtils';

export interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (folder: Folder) => void;
}

const CreateFolderModal: FC<CreateFolderModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleClose = () => {
    setName('');
    onClose();
  };

  const handleCreate = async () => {
    const trimmed = name.trim();

    if (!trimmed) {
      return;
    }

    try {
      setIsCreating(true);
      const folder = await createFolder({
        name: trimmed,
        displayName: trimmed,
      });
      onCreated(folder);
      handleClose();
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <ModalOverlay
      isDismissable={!isCreating}
      isOpen={isOpen}
      onOpenChange={(open) => !open && !isCreating && handleClose()}>
      <Modal>
        <Dialog showCloseButton width={440} onClose={handleClose}>
          <Dialog.Content className="tw:flex tw:flex-col tw:gap-4 tw:pb-6">
            <div className="tw:bg-brand-primary tw:p-2 tw:mb-2 tw:w-max tw:leading-0 tw:rounded-xl">
              <FolderPlus
                className="tw:text-brand-700"
                height={32}
                width={32}
              />
            </div>
            <Typography className="tw:mb-3" size="text-md" weight="semibold">
              {t('label.create-new-folder')}
            </Typography>
            <div className="tw:flex tw:flex-col tw:gap-1.5">
              <Typography
                className="tw:text-gray-700"
                size="text-sm"
                weight="medium">
                {t('label.entity-name', { entity: t('label.folder') })}
              </Typography>
              <Input
                autoFocus
                data-testid="folder-name-input"
                placeholder={t('label.entity-name', {
                  entity: t('label.folder'),
                })}
                value={name}
                onChange={(value) => setName(value)}
              />
            </div>

            <div className="tw:flex tw:justify-end tw:gap-3 tw:mt-6">
              <Button
                color="secondary"
                isDisabled={isCreating}
                size="sm"
                onPress={handleClose}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                data-testid="create-folder-btn"
                isDisabled={!name.trim() || isCreating}
                isLoading={isCreating}
                size="sm"
                onPress={handleCreate}>
                {t('label.save')}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default CreateFolderModal;
