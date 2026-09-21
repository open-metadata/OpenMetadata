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
  Dialog,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProcessingStatus } from '../../../../generated/entity/data/contextFile';
import { downloadDriveFile } from '../../../../rest/assetAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import FilePreviewer from '../../../common/FilePreviewer/FilePreviewer';
import Loader from '../../../common/Loader/Loader';
import { MAX_PREVIEW_SIZE } from './FilePreviewModal.constants';
import { FilePreviewModalProps } from './FilePreviewModal.interface';

const BLOCKED_STATUSES = [
  ProcessingStatus.Failed,
  ProcessingStatus.Unsupported,
];

const FilePreviewModal = ({ file, isOpen, onClose }: FilePreviewModalProps) => {
  const { t } = useTranslation();
  const [blob, setBlob] = useState<Blob>();
  const [isLoading, setIsLoading] = useState(false);

  const isTooLarge = useMemo(
    () => (file?.fileSize ?? 0) > MAX_PREVIEW_SIZE,
    [file?.fileSize]
  );

  const isBlocked = useMemo(
    () =>
      !!file?.processingStatus &&
      BLOCKED_STATUSES.includes(file.processingStatus),
    [file?.processingStatus]
  );

  useEffect(() => {
    if (!isOpen || !file || isTooLarge || isBlocked) {
      return;
    }

    const controller = new AbortController();

    const fetchFile = async () => {
      setIsLoading(true);
      try {
        const data = await downloadDriveFile(file.id);
        if (!controller.signal.aborted) {
          setBlob(data);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          showErrorToast(error as AxiosError);
          onClose();
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };
    fetchFile();

    return () => {
      controller.abort();
      setBlob(undefined);
    };
  }, [isOpen, file, isTooLarge, isBlocked, onClose]);

  const renderBody = () => {
    if (isBlocked) {
      return (
        <div data-testid="file-preview-not-supported">
          <Typography className="tw:p-8 tw:text-center" color="secondary">
            {t('message.preview-not-supported')}
          </Typography>
        </div>
      );
    }
    if (isTooLarge) {
      return (
        <div data-testid="file-preview-too-large">
          <Typography className="tw:p-8 tw:text-center" color="secondary">
            {t('message.file-too-large-to-preview')}
          </Typography>
        </div>
      );
    }
    if (isLoading || !blob) {
      return <Loader />;
    }

    return (
      <FilePreviewer
        content={blob}
        fileExtension={file?.fileExtension}
        fileName={file?.displayName ?? file?.name}
        fileType={file?.fileType}
        mimeType={file?.contentType}
      />
    );
  };

  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal>
        <Dialog
          showCloseButton
          title={t('label.preview')}
          width={900}
          onClose={onClose}>
          <Dialog.Content className="tw:min-h-[60vh] tw:max-h-[85vh] tw:overflow-auto">
            {renderBody()}
          </Dialog.Content>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default FilePreviewModal;
