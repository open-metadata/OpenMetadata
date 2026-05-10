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
  FileUpload,
  FileUploadDropZone,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UploadDocumentModalProps } from './UploadDocumentModal.interface';

interface QueuedFile {
  id: string;
  file: File;
}

const UploadDocumentModal: FC<UploadDocumentModalProps> = ({
  isOpen,
  onClose,
  onUpload,
}) => {
  const { t } = useTranslation();
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);

  const handleDropFiles = (files: FileList) => {
    const newEntries: QueuedFile[] = Array.from(files).map((file) => ({
      file,
      id: `${file.name}-${file.size}-${Date.now()}`,
    }));

    setQueuedFiles((prev) => [...prev, ...newEntries]);
    onUpload?.(files);
  };

  const handleRemove = (id: string) => {
    setQueuedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleClose = () => {
    setQueuedFiles([]);
    onClose();
  };

  return (
    <ModalOverlay
      isDismissable
      isOpen={isOpen}
      onOpenChange={(open) => !open && handleClose()}>
      <Modal>
        <Dialog
          showCloseButton
          title={t('label.upload-document-plural')}
          width={500}
          onClose={handleClose}>
          <Dialog.Content className="tw:pb-6">
            <FileUpload.Root>
              <FileUploadDropZone
                allowsMultiple
                clickToUploadLabel={t('label.click-to-upload', {
                  defaultValue: 'Click to upload',
                })}
                hint={t('message.upload-document-hint')}
                maxSize={25 * 1024 * 1024}
                orDragAndDropLabel={t('message.or-drag-and-drop', {
                  defaultValue: 'or drag and drop',
                })}
                onDropFiles={handleDropFiles}
              />

              {queuedFiles.length > 0 && (
                <FileUpload.List className="tw:max-h-60 tw:overflow-y-auto">
                  {queuedFiles.map(({ id, file }) => (
                    <FileUpload.ListItemProgressBar
                      key={id}
                      name={file.name}
                      progress={100}
                      size={file.size}
                      onDelete={() => handleRemove(id)}
                    />
                  ))}
                </FileUpload.List>
              )}
            </FileUpload.Root>

            <div className="tw:flex tw:justify-end tw:gap-3">
              <Button color="secondary" size="sm" onClick={handleClose}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                isDisabled={queuedFiles.length === 0}
                size="sm"
                onClick={handleClose}>
                {t('label.attach-file-plural')}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default UploadDocumentModal;
