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
  Typography,
} from '@openmetadata/ui-core-components';
import axios, { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProcessingStatus } from '../../../../generated/entity/data/contextFile';
import { downloadDriveFile } from '../../../../rest/assetAPI';
import { handleAssetDownload } from '../../../../utils/ContextCenterPureUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import FilePreviewer from '../../../common/FilePreviewer/FilePreviewer';
import Loader from '../../../common/Loader/Loader';
import { MAX_PREVIEW_SIZE } from './FilePreviewModal.constants';
import { FilePreviewModalProps } from './FilePreviewModal.types';

const BLOCKED_STATUSES = [
  ProcessingStatus.Failed,
  ProcessingStatus.Unsupported,
];

const FilePreviewModal = ({ file, isOpen, onClose }: FilePreviewModalProps) => {
  const { t } = useTranslation();
  const [blob, setBlob] = useState<Blob>();
  const [isLoading, setIsLoading] = useState(false);
  const [isBlobOversized, setIsBlobOversized] = useState(false);

  const isMetadataTooLarge = useMemo(
    () => (file?.fileSize ?? 0) > MAX_PREVIEW_SIZE,
    [file?.fileSize]
  );

  const isTooLarge = isMetadataTooLarge || isBlobOversized;

  const isBlocked = useMemo(
    () =>
      !!file?.processingStatus &&
      BLOCKED_STATUSES.includes(file.processingStatus),
    [file?.processingStatus]
  );

  useEffect(() => {
    if (!isOpen || !file || isMetadataTooLarge || isBlocked) {
      return;
    }

    const controller = new AbortController();

    const fetchFile = async () => {
      setIsLoading(true);
      setIsBlobOversized(false);
      try {
        const data = await downloadDriveFile(file.id, controller.signal);
        if (controller.signal.aborted) {
          return;
        }
        // Metadata `fileSize` can lie (stale, missing, or not yet reprocessed) —
        // the resolved blob is the source of truth for the size guard.
        if (data.size > MAX_PREVIEW_SIZE) {
          setIsBlobOversized(true);
        } else {
          setBlob(data);
        }
      } catch (error) {
        if (axios.isCancel(error) || controller.signal.aborted) {
          return;
        }
        showErrorToast(error as AxiosError);
        onClose();
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
      setIsBlobOversized(false);
    };
  }, [isOpen, file, isMetadataTooLarge, isBlocked, onClose]);

  const handleDownload = () => file && handleAssetDownload(file);

  const renderBody = () => {
    if (isBlocked) {
      return (
        <div data-testid="file-preview-not-supported">
          <Typography className="tw:p-8 tw:text-center" color="secondary">
            {t('message.preview-not-supported')}
          </Typography>
          <div className="tw:flex tw:justify-center tw:pb-8">
            <Button size="sm" onPress={handleDownload}>
              {t('label.download')}
            </Button>
          </div>
        </div>
      );
    }
    if (isTooLarge) {
      return (
        <div data-testid="file-preview-too-large">
          <Typography className="tw:p-8 tw:text-center" color="secondary">
            {t('message.file-too-large-to-preview')}
          </Typography>
          <div className="tw:flex tw:justify-center tw:pb-8">
            <Button size="sm" onPress={handleDownload}>
              {t('label.download')}
            </Button>
          </div>
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
