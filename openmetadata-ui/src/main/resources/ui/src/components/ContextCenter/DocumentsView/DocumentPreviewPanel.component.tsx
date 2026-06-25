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
  Typography,
} from '@openmetadata/ui-core-components';
import { Copy06, XClose } from '@untitledui/icons';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatBytes } from '../../../utils/ContextCenterPureUtils';
import { getShortRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import CopyLinkButton from '../../CopyLinkButton/CopyLinkButton.component';
import DocumentStatusBadge from '../DocumentStatusBadge/DocumentStatusBadge.component';
import ExtractedMemoriesCard from '../ExtractedMemoriesCard/ExtractedMemoriesCard.component';
import {
  DocumentPreviewPanelProps,
  MetaRowProps,
} from './DocumentsView.interface';

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

  const { folderName, formattedFileSize } = useMemo(() => {
    return {
      folderName: getEntityName(file.folder),
      formattedFileSize: formatBytes(file.fileSize),
    };
  }, [file]);

  return (
    <Card
      className={
        'tw:w-100 tw:shrink-0 tw:h-full tw:flex tw:flex-col ' +
        'tw:animate-in tw:slide-in-from-right tw:duration-300'
      }
      data-testid="document-preview-panel">
      <Box
        className="tw:flex-1 tw:min-h-0 tw:overflow-y-auto tw:p-4"
        direction="col"
        gap={4}>
        <Card className="tw:p-4 tw:shrink-0">
          <Box align="center" className="tw:mb-3" justify="between">
            <Typography
              className="tw:text-quaternary tw:uppercase"
              size="text-xs"
              weight="semibold">
              {t('label.detail-plural')}
            </Typography>
            <Box align="center" gap={2}>
              <CopyLinkButton className="tw:w-7 tw:h-7" url={url}>
                <Copy06 aria-hidden="true" size={17} strokeWidth={1.8} />
              </CopyLinkButton>
              <ButtonUtility
                color="tertiary"
                data-testid="close-preview-btn"
                icon={XClose}
                size="xs"
                tooltip={t('label.close')}
                onClick={onClose}
              />
            </Box>
          </Box>
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

        <ExtractedMemoriesCard sourceId={file.id} />
      </Box>
    </Card>
  );
};

export default DocumentPreviewPanel;
