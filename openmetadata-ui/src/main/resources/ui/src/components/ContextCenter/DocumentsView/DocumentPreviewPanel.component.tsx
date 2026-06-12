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
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { Copy06, XClose } from '@untitledui/icons';
import { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ContextMemory } from '../../../generated/entity/context/contextMemory';
import { getListContextMemories } from '../../../rest/contextMemoryAPI';
import { formatBytes } from '../../../utils/ContextCenterUtils';
import { getShortRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import CopyLinkButton from '../../CopyLinkButton/CopyLinkButton.component';
import DocumentStatusBadge from '../DocumentStatusBadge/DocumentStatusBadge.component';
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

const ExtractedMemoriesCard: FC<{ fileId: string }> = ({ fileId }) => {
  const { t } = useTranslation();
  const [memories, setMemories] = useState<ContextMemory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isStale = false;

    const fetchMemories = async () => {
      try {
        setIsLoading(true);
        const response = await getListContextMemories({
          sourceFileId: fileId,
          limit: 50,
        });
        if (!isStale) {
          setMemories(response.data);
        }
      } catch {
        if (!isStale) {
          setMemories([]);
        }
      } finally {
        if (!isStale) {
          setIsLoading(false);
        }
      }
    };

    fetchMemories();

    return () => {
      isStale = true;
    };
  }, [fileId]);

  return (
    <Card className="tw:p-4" data-testid="extracted-memories-card">
      <div className="tw:mb-3">
        <Typography
          className="tw:text-gray-500 tw:uppercase"
          size="text-xs"
          weight="semibold">
          {t('label.memory-plural')}
          {!isLoading && memories.length > 0 ? ` (${memories.length})` : ''}
        </Typography>
      </div>
      {isLoading ? (
        <Box direction="col" gap={2}>
          <Skeleton height="14px" variant="rounded" width="80%" />
          <Skeleton height="14px" variant="rounded" width="60%" />
        </Box>
      ) : memories.length === 0 ? (
        <Typography className="tw:text-gray-400" size="text-sm">
          {t('label.no-entity', { entity: t('label.memory-plural') })}
        </Typography>
      ) : (
        <Box direction="col">
          {memories.map((memory) => (
            <Box
              className="tw:py-1.5"
              data-testid={`extracted-memory-${memory.id}`}
              direction="col"
              key={memory.id}>
              <Typography
                ellipsis
                className="tw:text-gray-900"
                size="text-sm"
                weight="medium">
                {memory.title ?? getEntityName(memory)}
              </Typography>
              {memory.question && (
                <Typography
                  ellipsis
                  className="tw:text-gray-500"
                  size="text-xs">
                  {memory.question}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Card>
  );
};

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
          <Box align="center" className="tw:py-1.5" justify="between">
            <Typography className="tw:text-gray-500" size="text-sm">
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
              <Typography className="tw:text-gray-500" size="text-sm">
                {t('label.error')}
              </Typography>
              <Typography
                className="tw:text-error-600 tw:break-words"
                data-testid="processing-error"
                size="text-sm">
                {file.processingError}
              </Typography>
            </Box>
          )}
        </Card>

        <ExtractedMemoriesCard fileId={file.id} />
      </Box>
    </Box>
  );
};

export default DocumentPreviewPanel;
