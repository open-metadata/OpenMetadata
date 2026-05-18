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
  Modal,
  ModalOverlay,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { ChevronRight } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { Folder } from 'generated/entity/data/folder';
import { FC, Key, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileTypeBadge } from 'utils/ContextCenterUtils';
import { ReactComponent as FolderIcon } from '../../../assets/svg/ic-folder-new.svg';
import { moveFileToFolder } from '../../../rest/assetAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { DocFile } from '../DocumentsView/DocumentsView.interface';

export interface MoveToFolderModalProps {
  file: DocFile;
  folders: Folder[];
  isOpen: boolean;
  onClose: () => void;
  onMoved: (file: DocFile, targetFolderId: string) => void;
}

const MoveToFolderModal: FC<MoveToFolderModalProps> = ({
  file,
  folders,
  isOpen,
  onClose,
  onMoved,
}) => {
  const { t } = useTranslation();
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [isMoving, setIsMoving] = useState(false);

  const currentFolderName = file.folderId
    ? (folders.find((f) => f.id === file.folderId)?.displayName ??
      folders.find((f) => f.id === file.folderId)?.name)
    : undefined;

  const availableFolders = folders.filter((f) => f.id !== file.folderId);

  const handleClose = () => {
    setSelectedFolderId('');
    onClose();
  };

  const handleSave = async () => {
    if (!selectedFolderId) {
      return;
    }

    try {
      setIsMoving(true);
      await moveFileToFolder(file.driveFileId ?? file.id, selectedFolderId);
      onMoved(file, selectedFolderId);
      showSuccessToast(
        t('message.entity-moved-successfully', { entity: t('label.document') })
      );
      handleClose();
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <ModalOverlay
      isDismissable={!isMoving}
      isOpen={isOpen}
      onOpenChange={(open) => !open && !isMoving && handleClose()}>
      <Modal>
        <Dialog
          showCloseButton
          title={t('label.move-to-folder')}
          width={440}
          onClose={handleClose}>
          <Dialog.Content className="tw:flex tw:flex-col tw:gap-5 tw:pb-6">
            <div className="tw:flex tw:items-center tw:gap-2">
              <FileTypeBadge fileType={file.fileType} />
              <Typography className="tw:text-tertiary tw:truncate" size="text-sm">
                {file.name}
              </Typography>
            </div>

            <div className="tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-secondary tw:bg-primary tw:px-3 tw:py-2.5">
              <FolderIcon
                className="tw:shrink-0 tw:text-gray-500"
                height={16}
                width={16}
              />
              <Typography size="text-sm" weight="medium">
                {currentFolderName ?? t('label.no-folder')}
              </Typography>
              <ChevronRight
                className="tw:shrink-0 tw:text-gray-400"
                height={14}
                width={14}
              />
              <div className="tw:flex-1">
                <Select
                  className="tw:w-full"
                  data-testid="folder-select-trigger"
                  placeholder={t('label.folder')}
                  selectedKey={selectedFolderId || null}
                  onSelectionChange={(key: Key) =>
                    setSelectedFolderId(key as string)
                  }>
                  {availableFolders.map((folder) => (
                    <Select.Item
                      id={folder.id}
                      key={folder.id}
                      label={folder.displayName ?? folder.name}
                    />
                  ))}
                </Select>
              </div>
            </div>

            <div className="tw:flex tw:justify-end tw:gap-3">
              <Button
                color="secondary"
                isDisabled={isMoving}
                size="sm"
                onPress={handleClose}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                data-testid="move-folder-save-btn"
                isDisabled={!selectedFolderId || isMoving}
                isLoading={isMoving}
                size="sm"
                onPress={handleSave}>
                {t('label.save')}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default MoveToFolderModal;
