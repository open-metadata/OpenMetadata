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
import { AxiosError } from 'axios';
import { FC, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { DOCUMENT_MAX_FILE_SIZE } from '../../../constants/ContextCenter.constants';
import { ContextFile } from '../../../generated/entity/data/contextFile';
import { uploadDriveFile } from '../../../rest/assetAPI';
import { runWithConcurrencyLimit } from '../../../utils/AsyncUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import {
  QueuedFile,
  UploadDocumentModalProps,
  UploadStatus,
} from './UploadDocumentModal.interface';

const getFileExt = (name: string) =>
  name.split('.').pop()?.toLowerCase() ?? 'empty';

// Cap simultaneous uploads so a large batch does not fire one request per file at once.
const UPLOAD_CONCURRENCY = 3;

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
    (f) => f.status === UploadStatus.Done && !f.sizeExceeded
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
      id: uuidv4(),
      progress: 100,
      status: UploadStatus.Done,
    }));

    setFiles((prev) => [...prev, ...newEntries]);
  };

  const handleSizeLimitExceed = (oversized: FileList) => {
    const newEntries: QueuedFile[] = Array.from(oversized).map((file) => ({
      file,
      id: uuidv4(),
      progress: 0,
      sizeExceeded: true,
      status: UploadStatus.Error,
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
    } catch (err) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === entry.id
            ? { ...f, progress: 0, status: UploadStatus.Error }
            : f
        )
      );
      showErrorToast(err as AxiosError, t('message.upload-failed'));

      return null;
    }
  };

  const handleRetry = async (id: string) => {
    const entry = files.find((f) => f.id === id);

    if (!entry) {
      return;
    }

    // Mark the file as 'retrying' synchronously before any async work.
    // This immediately flips failed=false in the JSX (hiding the "Try Again"
    // button and showing "Uploading..." instead) without waiting for any
    // async state update or isUploading guard — which were the root cause of
    // the button staying visible after a successful retry.
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, status: UploadStatus.Retrying } : f
      )
    );

    try {
      const contextFile = await uploadDriveFile(entry.file, folderFqn);
      setFiles((prev) => prev.filter((f) => f.id !== id));
      showSuccessToast(t('message.documents-uploaded-successfully'));
      onUploaded?.([contextFile]);
    } catch (err) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, progress: 0, status: UploadStatus.Error } : f
        )
      );
      showErrorToast(err as AxiosError, t('message.upload-failed'));
    }
  };

  const handleAttach = async () => {
    const pending = files.filter(
      (f) => f.status === UploadStatus.Done && !f.sizeExceeded
    );

    if (pending.length === 0) {
      return;
    }

    // Capture any files already in error state (e.g. duplicate-name failures from
    // a previous attempt). These are not included in `pending` so the batch size
    // comparison alone can't detect them — we must check before the uploads start.
    const hasPreExistingErrors = files.some(
      (f) => f.status === UploadStatus.Error && !f.sizeExceeded
    );

    cancelledRef.current = false;
    setIsUploading(true);

    const results = await runWithConcurrencyLimit(
      pending,
      UPLOAD_CONCURRENCY,
      (entry) => uploadSingleFile(entry),
      () => cancelledRef.current
    );
    const batchFiles = results.filter((file): file is ContextFile =>
      Boolean(file)
    );

    if (!cancelledRef.current) {
      setIsUploading(false);

      if (batchFiles.length > 0) {
        // Mark each successfully uploaded file as 'uploaded' so the row
        // shows "Complete" and is excluded from any future Attach click.
        const succeededIds = new Set(
          pending.filter((_, i) => Boolean(results[i])).map((e) => e.id)
        );
        setFiles((prev) =>
          prev.map((f) =>
            succeededIds.has(f.id)
              ? { ...f, progress: 100, status: UploadStatus.Uploaded }
              : f
          )
        );

        onUploaded?.(batchFiles);
        const allBatchSucceeded = batchFiles.length === pending.length;
        if (allBatchSucceeded && !hasPreExistingErrors) {
          showSuccessToast(t('message.documents-uploaded-successfully'));
          handleClose();
        } else {
          showSuccessToast(t('message.some-documents-uploaded-successfully'));
        }
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
          <Dialog.Content className="tw:pb-6">
            <FileUpload.Root>
              <FileUploadDropZone
                allowsMultiple
                clickToUploadLabel={t('label.click-to-upload')}
                hint={t('message.upload-document-hint')}
                input-data-testid="file-upload-input"
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
                      failed={status === UploadStatus.Error}
                      failedLabel={t('label.failed')}
                      key={id}
                      name={file.name}
                      progress={
                        status === UploadStatus.Done ||
                        status === UploadStatus.Uploaded
                          ? 100
                          : progress
                      }
                      size={file.size}
                      tryAgainLabel={t('label.try-again')}
                      type={getFileExt(file.name)}
                      uploadingLabel={t('label.uploading')}
                      onDelete={() => handleRemove(id)}
                      onRetry={
                        status === UploadStatus.Error &&
                        !sizeExceeded &&
                        !isUploading
                          ? () => handleRetry(id)
                          : undefined
                      }
                    />
                  ))}
                </FileUpload.List>
              )}
            </FileUpload.Root>
          </Dialog.Content>
          <Dialog.Footer className="tw:border-0 tw:mt-0!">
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
