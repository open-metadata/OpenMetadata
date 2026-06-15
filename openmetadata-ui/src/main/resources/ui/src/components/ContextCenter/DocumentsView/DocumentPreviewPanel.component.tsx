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
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { Copy06, XClose } from '@untitledui/icons';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatBytes } from '../../../utils/ContextCenterPureUtils';
import { ContextMemory } from '../../../generated/entity/context/contextMemory';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getListContextMemories } from '../../../rest/contextMemoryAPI';
import { getShortRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import CopyLinkButton from '../../CopyLinkButton/CopyLinkButton.component';
import CreateMemoryModal from '../CreateMemoryModal/CreateMemoryModal.component';
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
  const { currentUser } = useApplicationStore();
  const [memories, setMemories] = useState<ContextMemory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [memoryToView, setMemoryToView] = useState<ContextMemory>();

  const fetchMemories = useCallback(
    async (isCancelled?: () => boolean) => {
      try {
        setIsLoading(true);
        const response = await getListContextMemories({
          sourceFileId: fileId,
          fields: 'owners,sourceFile',
          limit: 50,
        });
        if (!isCancelled?.()) {
          setMemories(response.data);
        }
      } catch {
        if (!isCancelled?.()) {
          setMemories([]);
        }
      } finally {
        if (!isCancelled?.()) {
          setIsLoading(false);
        }
      }
    },
    [fileId]
  );

  useEffect(() => {
    let isStale = false;
    fetchMemories(() => isStale);

    return () => {
      isStale = true;
    };
  }, [fetchMemories]);

  const handleMemoryDeleted = useCallback(() => {
    setMemoryToView(undefined);
    fetchMemories();
  }, [fetchMemories]);

  const canDeleteMemory =
    (memoryToView?.owners?.some((o) => o.name === currentUser?.name) ??
      false) ||
    Boolean(currentUser?.isAdmin);

  return (
    // shrink-0: Card sets overflow-hidden, which lets flexbox shrink it to fit
    // the scroll container and clip the list instead of letting the body scroll
    <Card className="tw:p-4 tw:shrink-0" data-testid="extracted-memories-card">
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
              className="tw:py-1.5 tw:-mx-2 tw:px-2 tw:rounded-md tw:cursor-pointer hover:tw:bg-gray-50"
              data-testid={`extracted-memory-${memory.id}`}
              direction="col"
              key={memory.id}
              role="button"
              tabIndex={0}
              onClick={() => setMemoryToView(memory)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setMemoryToView(memory);
                }
              }}>
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

      {memoryToView && (
        <CreateMemoryModal
          viewOnly
          canDelete={canDeleteMemory}
          currentUserName={currentUser?.name}
          isOpen={Boolean(memoryToView)}
          memoryToEdit={memoryToView}
          onClose={() => setMemoryToView(undefined)}
          onCreated={() => setMemoryToView(undefined)}
          onDeleted={handleMemoryDeleted}
          onUpdated={handleMemoryDeleted}
        />
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
              className="tw:text-gray-500 tw:uppercase"
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
    </Card>
  );
};

export default DocumentPreviewPanel;
