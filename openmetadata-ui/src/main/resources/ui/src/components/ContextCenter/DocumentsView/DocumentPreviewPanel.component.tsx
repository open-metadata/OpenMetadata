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
import { Copy06, XClose } from '@untitledui/icons';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatBytes } from '../../../utils/ContextCenterUtils';
import { getShortRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import CopyLinkButton from '../../CopyLinkButton/CopyLinkButton.component';
import {
  DocumentPreviewPanelProps,
  MetaRowProps,
} from './DocumentsView.interface';

const MetaRow: FC<MetaRowProps> = ({ label, value }) => (
  <Box align="center" className="tw:py-1.5" justify="between">
    <Typography className="tw:text-gray-500" size="text-sm">
      {label}
    </Typography>
    <Typography className="tw:text-gray-900" size="text-sm" weight="medium">
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

  const { folderName, fileName, formattedFileSize } = useMemo(() => {
    return {
      folderName: getEntityName(file.folder),
      fileName: getEntityName(file),
      formattedFileSize: formatBytes(file.fileSize),
    };
  }, [file]);

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

      <Box
        className="tw:flex-1 tw:overflow-y-auto tw:p-4 tw:bg-gray-50"
        direction="col"
        gap={4}>
        <Card className="tw:p-4">
          <div className="tw:mb-3">
            <Typography
              className="tw:text-gray-500 tw:uppercase"
              size="text-xs"
              weight="semibold">
              {t('label.status')}
            </Typography>
          </div>
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
        </Card>
      </Box>
    </Box>
  );
};

export default DocumentPreviewPanel;
