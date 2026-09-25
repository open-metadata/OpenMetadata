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
import { useTranslation } from 'react-i18next';
import { useFilePreviewContent } from '../../../../hooks/useFilePreviewContent';
import { handleAssetDownload } from '../../../../utils/ContextCenterPureUtils';
import FilePreviewer from '../../../common/FilePreviewer/FilePreviewer';
import Loader from '../../../common/Loader/Loader';
import { FilePreviewModalProps } from './FilePreviewModal.types';

const FilePreviewModal = ({ file, isOpen, onClose }: FilePreviewModalProps) => {
  const { t } = useTranslation();
  const { status, blob } = useFilePreviewContent(file, {
    enabled: isOpen,
    onError: onClose,
  });

  const dialogTitle = file?.displayName ?? file?.name ?? t('label.preview');

  const handleDownload = () => file && handleAssetDownload(file);

  const renderDownloadFallback = (testId: string, message: string) => (
    <div data-testid={testId}>
      <Typography className="tw:p-8 tw:text-center" color="secondary">
        {message}
      </Typography>
      <div className="tw:flex tw:justify-center tw:pb-8">
        <Button size="sm" onPress={handleDownload}>
          {t('label.download')}
        </Button>
      </div>
    </div>
  );

  const renderBody = () => {
    if (status === 'too-large') {
      return renderDownloadFallback(
        'file-preview-too-large',
        t('message.file-too-large-to-preview')
      );
    }
    if (status !== 'ready' || !blob) {
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
        <Dialog showCloseButton width={900} onClose={onClose}>
          <Dialog.Header className="tw:border-b tw:border-subtle tw:pb-4 tw:pr-12">
            <Typography
              ellipsis
              as="h2"
              className="tw:text-primary"
              data-testid="file-preview-title"
              size="text-md"
              slot="title"
              title={dialogTitle}
              weight="semibold">
              {dialogTitle}
            </Typography>
          </Dialog.Header>
          <Dialog.Content className="tw:min-h-[60vh] tw:max-h-[85vh] tw:overflow-auto">
            {renderBody()}
          </Dialog.Content>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default FilePreviewModal;
