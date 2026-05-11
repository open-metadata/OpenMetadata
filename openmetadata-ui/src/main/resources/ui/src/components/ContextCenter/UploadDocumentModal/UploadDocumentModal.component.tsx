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
import { Asset } from 'generated/attachments/asset';
import { FC, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { uploadAsset } from 'rest/assetAPI';
import { showErrorToast } from 'utils/ToastUtils';
import { UploadDocumentModalProps } from './UploadDocumentModal.interface';

type UploadStatus = 'uploading' | 'done' | 'error' | 'size-error';

interface QueuedFile {
  id: string;
  file: File;
  progress: number;
  status: UploadStatus;
}

const UploadDocumentModal: FC<UploadDocumentModalProps> = ({
  isOpen,
  entityLink,
  onClose,
  onUploaded,
}) => {
  const { t } = useTranslation();
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const uploadedAssetsRef = useRef<Asset[]>([]);

  const handleClose = () => {
    if (uploadedAssetsRef.current.length > 0) {
      onUploaded?.(uploadedAssetsRef.current);
    }

    uploadedAssetsRef.current = [];
    setQueuedFiles([]);
    onClose();
  };

  const uploadSingleFile = async (entry: QueuedFile): Promise<void> => {
    try {
      const asset = await uploadAsset(entry.file, entityLink);
      uploadedAssetsRef.current = [...uploadedAssetsRef.current, asset];
      setQueuedFiles((prev) =>
        prev.map((f) =>
          f.id === entry.id ? { ...f, progress: 100, status: 'done' } : f
        )
      );
    } catch {
      setQueuedFiles((prev) =>
        prev.map((f) =>
          f.id === entry.id ? { ...f, progress: 0, status: 'error' } : f
        )
      );
    }
  };

  const handleDropFiles = (files: FileList) => {
    const newEntries: QueuedFile[] = Array.from(files).map((file) => ({
      file,
      id: `${file.name}-${file.size}-${Date.now()}`,
      progress: 0,
      status: 'uploading' as UploadStatus,
    }));

    setQueuedFiles((prev) => [...prev, ...newEntries]);

    newEntries.forEach((entry) => uploadSingleFile(entry));
  };

  const handleSizeLimitExceed = (files: FileList) => {
    const oversizedEntries: QueuedFile[] = Array.from(files).map((file) => ({
      file,
      id: `${file.name}-${file.size}-${Date.now()}`,
      progress: 0,
      status: 'size-error' as UploadStatus,
    }));

    setQueuedFiles((prev) => [...prev, ...oversizedEntries]);
    showErrorToast(
      t('message.file-size-limit-exceeded', {
        defaultValue:
          'Some files exceed the 5 MB size limit and were not uploaded.',
      })
    );
  };

  const handleRemove = (id: string) => {
    setQueuedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleRetry = (id: string) => {
    const entry = queuedFiles.find((f) => f.id === id);

    if (!entry) {
      return;
    }

    setQueuedFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, progress: 0, status: 'uploading' } : f
      )
    );

    uploadSingleFile({ ...entry, status: 'uploading' });
  };

  const isUploading = queuedFiles.some((f) => f.status === 'uploading');

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
                maxSize={5 * 1024 * 1024}
                orDragAndDropLabel={t('message.or-drag-and-drop', {
                  defaultValue: 'or drag and drop',
                })}
                onDropFiles={handleDropFiles}
                onSizeLimitExceed={handleSizeLimitExceed}
              />

              {queuedFiles.length > 0 && (
                <FileUpload.List className="tw:max-h-60 tw:overflow-y-auto">
                  {queuedFiles.map(({ id, file, progress, status }) => (
                    <FileUpload.ListItemProgressBar
                      failed={status === 'error' || status === 'size-error'}
                      key={id}
                      name={file.name}
                      progress={status === 'done' ? 100 : progress}
                      size={file.size}
                      onDelete={
                        status !== 'uploading'
                          ? () => handleRemove(id)
                          : undefined
                      }
                      onRetry={
                        status === 'error' ? () => handleRetry(id) : undefined
                      }
                    />
                  ))}
                </FileUpload.List>
              )}
            </FileUpload.Root>

            <div className="tw:flex tw:justify-end tw:gap-3">
              <Button
                color="secondary"
                isDisabled={isUploading}
                size="sm"
                onClick={handleClose}>
                {t('label.close')}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default UploadDocumentModal;
