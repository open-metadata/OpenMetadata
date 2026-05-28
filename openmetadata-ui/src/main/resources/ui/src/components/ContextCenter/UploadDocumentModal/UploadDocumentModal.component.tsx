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
import { FC, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DOCUMENT_MAX_FILE_SIZE } from '../../../constants/ContextCenter.constants';
import { ContextFile } from '../../../generated/entity/data/contextFile';
import { uploadDriveFile } from '../../../rest/assetAPI';
import { showSuccessToast } from '../../../utils/ToastUtils';
import {
  QueuedFile,
  UploadDocumentModalProps,
} from './UploadDocumentModal.interface';

const getFileExt = (name: string) =>
  name.split('.').pop()?.toLowerCase() ?? 'empty';

const UploadDocumentModal: FC<UploadDocumentModalProps> = ({
  isOpen,
  folderFqn,
  onClose,
  onUploaded,
}) => {
  const { t } = useTranslation();
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const cancelledRef = useRef(false);

  const hasPendingFiles = files.some(
    (f) => f.status === 'done' && !f.sizeExceeded
  );

  const handleClose = () => {
    cancelledRef.current = true;
    setFiles([]);
    setIsUploading(false);
    onClose();
  };

  const handleDropFiles = (dropped: FileList) => {
    const newEntries: QueuedFile[] = Array.from(dropped).map((file) => ({
      file,
      id: crypto.randomUUID(),
      progress: 100,
      status: 'done',
    }));

    setFiles((prev) => [...prev, ...newEntries]);
  };

  const handleSizeLimitExceed = (oversized: FileList) => {
    const newEntries: QueuedFile[] = Array.from(oversized).map((file) => ({
      file,
      id: crypto.randomUUID(),
      progress: 0,
      sizeExceeded: true,
      status: 'error',
    }));

    setFiles((prev) => [...prev, ...newEntries]);
  };

  const handleRemove = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const uploadSingleFile = async (
    entry: QueuedFile
  ): Promise<ContextFile | null> => {
    try {
      return await uploadDriveFile(entry.file, folderFqn);
    } catch {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === entry.id ? { ...f, progress: 0, status: 'error' } : f
        )
      );

      return null;
    }
  };

  const handleRetry = async (id: string) => {
    const entry = files.find((f) => f.id === id);

    if (!entry) {
      return;
    }

    setIsUploading(true);
    const contextFile = await uploadSingleFile(entry);
    setIsUploading(false);

    if (contextFile) {
      onUploaded?.([contextFile]);
    }
  };

  const handleAttach = async () => {
    const pending = files.filter((f) => f.status === 'done' && !f.sizeExceeded);

    if (pending.length === 0) {
      return;
    }

    cancelledRef.current = false;
    setIsUploading(true);

    const batchFiles: ContextFile[] = [];
    for (const entry of pending) {
      if (cancelledRef.current) {
        break;
      }

      const contextFile = await uploadSingleFile(entry);
      if (contextFile) {
        batchFiles.push(contextFile);
      }
    }

    if (!cancelledRef.current) {
      setIsUploading(false);

      if (batchFiles.length > 0) {
        onUploaded?.(batchFiles);
        showSuccessToast(t('message.documents-uploaded-successfully'));
        handleClose();
      }
    }
  };

  return (
    <ModalOverlay
      isDismissable
      isOpen={isOpen}
      style={{ zIndex: 999 }}
      onOpenChange={(open) => !open && handleClose()}>
      <Modal>
        <Dialog showCloseButton width={500} onClose={handleClose}>
          <Dialog.Header title={t('label.upload-document-plural')} />
          <Dialog.Content className="tw:pb-6 tw:max-h-[60vh] tw:overflow-y-auto tw:overflow-x-visible">
            <FileUpload.Root>
              <FileUploadDropZone
                allowsMultiple
                clickToUploadLabel={t('label.click-to-upload')}
                hint={t('message.upload-document-hint')}
                maxSize={DOCUMENT_MAX_FILE_SIZE}
                orDragAndDropLabel={t('label.or-drag-and-drop')}
                onDropFiles={handleDropFiles}
                onSizeLimitExceed={handleSizeLimitExceed}
              />

              {files.length > 0 && (
                <FileUpload.List>
                  {files.map(({ id, file, progress, status, sizeExceeded }) => (
                    <FileUpload.ListItemProgressBar
                      completeLabel={t('label.complete')}
                      deleteLabel={t('label.delete')}
                      failed={status === 'error'}
                      failedLabel={t('label.failed')}
                      key={id}
                      name={file.name}
                      progress={status === 'done' ? 100 : progress}
                      size={file.size}
                      tryAgainLabel={t('label.try-again')}
                      type={getFileExt(file.name)}
                      uploadingLabel={t('label.uploading')}
                      onDelete={() => handleRemove(id)}
                      onRetry={
                        status === 'error' && !sizeExceeded
                          ? () => handleRetry(id)
                          : undefined
                      }
                    />
                  ))}
                </FileUpload.List>
              )}
            </FileUpload.Root>
          </Dialog.Content>
          <Dialog.Footer className="quick-link-modal-footer">
            <Button color="secondary" size="sm" onClick={handleClose}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              isDisabled={!hasPendingFiles || isUploading}
              isLoading={isUploading}
              size="sm"
              onClick={handleAttach}>
              {t('label.attach-file-plural')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default UploadDocumentModal;
