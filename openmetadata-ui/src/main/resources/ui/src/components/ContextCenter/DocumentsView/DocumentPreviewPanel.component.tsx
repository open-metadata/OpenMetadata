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
  Box,
  ButtonUtility,
  Card,
  FileIcon,
  Typography,
} from '@openmetadata/ui-core-components';
import { XClose } from '@untitledui/icons';
import { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CopyIcon } from '../../../assets/svg/action-icons/copy.svg';
import { useFilePreviewContent } from '../../../hooks/useFilePreviewContent';
import { formatBytes } from '../../../utils/ContextCenterPureUtils';
import { getShortRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import FilePreviewer from '../../common/FilePreviewer/FilePreviewer';
import { PreviewRendererId } from '../../common/FilePreviewer/FilePreviewer.types';
import { resolveRenderer } from '../../common/FilePreviewer/FilePreviewer.utils';
import Loader from '../../common/Loader/Loader';
import CopyLinkButton from '../../CopyLinkButton/CopyLinkButton.component';
import DocumentStatusBadge from '../DocumentStatusBadge/DocumentStatusBadge.component';
import ExtractedMemoriesCard from '../ExtractedMemoriesCard/ExtractedMemoriesCard.component';
import {
  DocumentPreviewPanelProps,
  MetaRowProps,
} from './DocumentsView.interface';
import FilePreviewModal from './FilePreviewModal/FilePreviewModal';

const MetaRow: FC<MetaRowProps> = ({ label, value }) => (
  <Box align="center" className="tw:py-1.5" justify="between">
    <Typography className="tw:text-quaternary" size="text-sm">
      {label}
    </Typography>
    <Typography className="tw:text-primary" size="text-sm" weight="medium">
      {value}
    </Typography>
  </Box>
);

const DocumentPreviewPanel: FC<DocumentPreviewPanelProps> = ({
  file,
  url,
  onClose,
}) => {
  const { t } = useTranslation();

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  const { folderName, fileName, formattedFileSize, isPreviewSupported } =
    useMemo(() => {
      return {
        folderName: getEntityName(file.folder),
        fileName: getEntityName(file),
        formattedFileSize: formatBytes(file.fileSize),
        isPreviewSupported:
          resolveRenderer({
            fileExtension: file.fileExtension,
            fileType: file.fileType,
            mimeType: file.contentType,
          }) !== PreviewRendererId.Unsupported,
      };
    }, [file]);

  const { status, blob } = useFilePreviewContent(file, {
    enabled: isPreviewSupported,
  });

  const renderPlaceholder = (message: string) => (
    <Box
      align="center"
      className="tw:h-full tw:p-4"
      direction="col"
      gap={2}
      justify="center">
      <FileIcon
        className="tw:size-10"
        theme="light"
        type={file.fileExtension ?? ''}
        variant="default"
      />
      <Typography className="tw:text-quaternary tw:text-center" size="text-xs">
        {message}
      </Typography>
    </Box>
  );

  const renderMiniature = () => {
    if (!isPreviewSupported) {
      return renderPlaceholder(t('message.preview-not-supported'));
    }
    if (status === 'too-large') {
      return renderPlaceholder(t('message.file-too-large-to-preview'));
    }
    if (status === 'error') {
      return renderPlaceholder(t('message.file-preview-render-failed'));
    }
    if (status !== 'ready' || !blob) {
      return <Loader />;
    }

    return (
      <button
        aria-label={t('label.preview')}
        className="tw:block tw:w-full tw:h-full tw:overflow-hidden tw:cursor-pointer tw:bg-secondary_subtle"
        data-testid="preview-miniature"
        type="button"
        onClick={() => setIsPreviewModalOpen(true)}>
        <div className="tw:pointer-events-none tw:h-full tw:overflow-hidden tw:flex tw:items-center tw:justify-center">
          <FilePreviewer
            compact
            content={blob}
            fileExtension={file.fileExtension}
            fileName={fileName}
            fileType={file.fileType}
            mimeType={file.contentType}
          />
        </div>
      </button>
    );
  };

  return (
    <Box
      className={
        'tw:w-100 tw:shrink-0 tw:h-full ' +
        'tw:border tw:border-l-0 tw:border-secondary tw:bg-primary ' +
        'tw:animate-in tw:slide-in-from-right tw:duration-300 tw:rounded-tr-xl tw:rounded-br-xl'
      }
      data-testid="document-preview-panel"
      direction="col">
      <Box
        align="center"
        className="tw:px-4 tw:py-3 tw:border-b tw:border-secondary tw:shrink-0"
        gap={3}
        justify="between">
        <Box align="center" className="tw:max-w-[78%]" gap={2}>
          <FileIcon
            className="tw:size-6 tw:shrink-0"
            theme="light"
            type={file.fileExtension ?? ''}
            variant="default"
          />
          <div className="tw:min-w-0">
            <Typography
              ellipsis
              className="tw:flex-1"
              data-testid="preview-file-name"
              size="text-sm"
              weight="semibold">
              {fileName}
            </Typography>
          </div>
        </Box>
        <Box align="center" gap={2}>
          <CopyLinkButton className="tw:w-8 tw:h-8" url={url}>
            <CopyIcon aria-hidden="true" height={20} width={20} />
          </CopyLinkButton>
          <ButtonUtility
            color="tertiary"
            data-testid="close-preview-btn"
            icon={<XClose height={20} width={20} />}
            size="xs"
            tooltip={t('label.close')}
            onClick={onClose}
          />
        </Box>
      </Box>

      <Box
        className="tw:flex-1 tw:min-h-0 tw:overflow-y-auto tw:p-4 tw:bg-gray-50"
        direction="col"
        gap={4}>
        <div
          className="tw:shrink-0 tw:h-60 tw:rounded-lg tw:border tw:border-secondary tw:bg-primary tw:overflow-hidden"
          data-testid="document-preview-miniature">
          {renderMiniature()}
        </div>

        <Card className="tw:p-4 tw:shrink-0">
          <div className="tw:mb-3">
            <Typography
              className="tw:text-quaternary tw:uppercase"
              size="text-xs"
              weight="semibold">
              {t('label.detail-plural')}
            </Typography>
          </div>
          <Box align="center" className="tw:py-1.5" justify="between">
            <Typography className="tw:text-quaternary" size="text-sm">
              {t('label.status')}
            </Typography>
            <DocumentStatusBadge
              error={file.processingError}
              stats={file.extractionStats}
              status={file.processingStatus}
            />
          </Box>
          {folderName && (
            <MetaRow label={t('label.folder')} value={folderName} />
          )}
          <MetaRow label={t('label.size')} value={formattedFileSize} />
          {file.updatedBy && (
            <MetaRow label={t('label.updated-by')} value={file.updatedBy} />
          )}
          {Boolean(file.updatedAt) && (
            <MetaRow
              label={t('label.updated-at')}
              value={getShortRelativeTime(file.updatedAt)}
            />
          )}
          {file.processingError && (
            <Box className="tw:py-1.5" direction="col" gap={1}>
              <Typography className="tw:text-quaternary" size="text-sm">
                {t('label.error')}
              </Typography>
              <Typography
                className="tw:text-error-primary tw:break-words"
                data-testid="processing-error"
                size="text-sm">
                {file.processingError}
              </Typography>
            </Box>
          )}
        </Card>

        <ExtractedMemoriesCard
          sourceId={file.id}
          titleClassName="tw:uppercase"
        />
      </Box>

      <FilePreviewModal
        file={file}
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
      />
    </Box>
  );
};

export default DocumentPreviewPanel;
