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
  ButtonUtility,
  Dialog,
  FileUpload,
  FileUploadDropZone,
  getReadableFileSize,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import { Trash01, UploadCloud02 } from '@untitledui/icons';
import { Asset } from 'generated/attachments/asset';
import { FC, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { uploadAsset } from 'rest/assetAPI';
import { showErrorToast } from 'utils/ToastUtils';
import { UploadDocumentModalProps } from './UploadDocumentModal.interface';

type UploadStatus = 'uploading' | 'done' | 'error';

interface StagedFile {
  id: string;
  file: File;
}

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
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const uploadedAssetsRef = useRef<Asset[]>([]);

  const hasStartedUploading = queuedFiles.length > 0;

  const handleClose = () => {
    uploadedAssetsRef.current = [];
    setStagedFiles([]);
    setQueuedFiles([]);
    setIsUploading(false);
    onClose();
  };

  const uploadSingleFile = async (entry: QueuedFile): Promise<Asset | null> => {
    setQueuedFiles((prev) =>
      prev.map((f) =>
        f.id === entry.id ? { ...f, progress: 0, status: 'uploading' } : f
      )
    );

    try {
      const asset = await uploadAsset(entry.file, entityLink);
      setQueuedFiles((prev) =>
        prev.map((f) =>
          f.id === entry.id ? { ...f, progress: 100, status: 'done' } : f
        )
      );

      return asset;
    } catch {
      setQueuedFiles((prev) =>
        prev.map((f) =>
          f.id === entry.id ? { ...f, progress: 0, status: 'error' } : f
        )
      );

      return null;
    }
  };

  const handleDropFiles = (files: FileList) => {
    const newEntries: StagedFile[] = Array.from(files).map((file) => ({
      file,
      id: `${file.name}-${file.size}-${Date.now()}`,
    }));

    setStagedFiles((prev) => [...prev, ...newEntries]);
  };

  const handleSizeLimitExceed = () => {
    showErrorToast(
      t('message.file-size-limit-exceeded', {
        defaultValue:
          'Some files exceed the 5 MB size limit and were not uploaded.',
      })
    );
  };

  const handleRemoveStaged = (id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleRemoveQueued = (id: string) => {
    setQueuedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleRetry = async (id: string) => {
    const entry = queuedFiles.find((f) => f.id === id);

    if (!entry) {
      return;
    }

    setIsUploading(true);
    const asset = await uploadSingleFile(entry);
    setIsUploading(false);

    if (asset) {
      uploadedAssetsRef.current = [...uploadedAssetsRef.current, asset];
      onUploaded?.([asset]);
    }
  };

  const handleAttach = async () => {
    if (stagedFiles.length === 0) {
      return;
    }

    const newQueued: QueuedFile[] = stagedFiles.map(({ id, file }) => ({
      file,
      id,
      progress: 0,
      status: 'uploading' as UploadStatus,
    }));

    setStagedFiles([]);
    setQueuedFiles((prev) => [...prev, ...newQueued]);
    setIsUploading(true);

    const batchAssets: Asset[] = [];
    for (const entry of newQueued) {
      const asset = await uploadSingleFile(entry);
      if (asset) {
        batchAssets.push(asset);
      }
    }

    setIsUploading(false);

    if (batchAssets.length > 0) {
      onUploaded?.(batchAssets);
    }
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
                maxSize={5 * 1024 * 1024}
                orDragAndDropLabel={t('message.or-drag-and-drop', {
                  defaultValue: 'or drag and drop',
                })}
                onDropFiles={handleDropFiles}
                onSizeLimitExceed={handleSizeLimitExceed}
              />

              {stagedFiles.length > 0 && (
                <ul className="tw:flex tw:max-h-60 tw:flex-col tw:gap-3 tw:overflow-y-auto">
                  {stagedFiles.map(({ id, file }) => (
                    <li
                      className="tw:flex tw:items-center tw:gap-3 tw:rounded-xl tw:bg-primary tw:p-4 tw:ring-1 tw:ring-secondary tw:ring-inset"
                      key={id}>
                      <div className="tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:bg-secondary">
                        <UploadCloud02
                          className="tw:size-5 tw:text-tertiary"
                          strokeWidth={1.5}
                        />
                      </div>

                      <div className="tw:min-w-0 tw:flex-1">
                        <p className="tw:truncate tw:text-sm tw:font-medium tw:text-secondary">
                          {file.name}
                        </p>

                        <p className="tw:text-sm tw:text-tertiary">
                          {getReadableFileSize(file.size)}
                        </p>
                      </div>

                      <ButtonUtility
                        className="tw:shrink-0"
                        color="tertiary"
                        icon={Trash01}
                        size="xs"
                        tooltip={t('label.delete')}
                        onClick={() => handleRemoveStaged(id)}
                      />
                    </li>
                  ))}
                </ul>
              )}

              {hasStartedUploading && (
                <FileUpload.List className="tw:max-h-60 tw:overflow-y-auto">
                  {queuedFiles.map(({ id, file, progress, status }) => (
                    <FileUpload.ListItemProgressBar
                      completeLabel={t('label.complete')}
                      deleteLabel={t('label.delete')}
                      failed={status === 'error'}
                      failedLabel={t('message.upload-failed')}
                      key={id}
                      name={file.name}
                      progress={status === 'done' ? 100 : progress}
                      size={file.size}
                      tryAgainLabel={t('label.try-again')}
                      uploadingLabel={t('label.uploading')}
                      onDelete={
                        status !== 'uploading'
                          ? () => handleRemoveQueued(id)
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
                {t('label.cancel')}
              </Button>

              <Button
                color="primary"
                isDisabled={stagedFiles.length === 0 || isUploading}
                isLoading={isUploading}
                size="sm"
                onClick={handleAttach}>
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
