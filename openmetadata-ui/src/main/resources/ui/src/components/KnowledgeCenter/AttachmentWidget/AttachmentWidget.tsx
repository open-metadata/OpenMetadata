/*
 *  Copyright 2025 Collate.
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
  getReadableFileSize,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { Download01 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AssetType } from '../../../generated/attachments/asset';
import { downloadAsset, listAssetsByFqn } from '../../../rest/assetAPI';
import { downloadBlob } from '../../../utils/ContextCenterPureUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import WidgetCard from '../../common/WidgetCard/WidgetCard';
import {
  AttachmentItem,
  AttachmentWidgetProps,
} from './AttachmentWidget.interface';

const AttachmentWidget: FC<AttachmentWidgetProps> = ({ entityFqn }) => {
  const { t } = useTranslation();
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAttachments = useCallback(
    async (isCancelled?: () => boolean) => {
      if (!entityFqn) {
        return;
      }
      try {
        setIsLoading(true);
        const assetData = await listAssetsByFqn(entityFqn, AssetType.Inline);
        if (!isCancelled?.()) {
          setAttachments(
            assetData.data.map((asset) => ({
              id: asset.id,
              name: asset.fileName,
              size: asset.size ?? 0,
              fileType: asset?.extension?.replace('.', '') || '',
              downloadUrl: asset.url,
            }))
          );
        }
      } catch {
        if (!isCancelled?.()) {
          setAttachments([]);
        }
      } finally {
        if (!isCancelled?.()) {
          setIsLoading(false);
        }
      }
    },
    [entityFqn]
  );

  useEffect(() => {
    let isStale = false;
    fetchAttachments(() => isStale);

    return () => {
      isStale = true;
    };
  }, [fetchAttachments]);

  const handleDownload = async (file: AttachmentItem) => {
    try {
      if (!file.id) {
        throw new Error('Invalid attachment URL');
      }
      const blob = await downloadAsset(file.id);
      if (!blob) {
        throw new Error('Failed to fetch file');
      }
      downloadBlob(blob, file.name);
    } catch (error) {
      showErrorToast(error as AxiosError, t('server.unexpected-error'));
    }
  };

  const content = useMemo(() => {
    if (isLoading) {
      return (
        <Box direction="col" gap={2}>
          <Skeleton height="14px" variant="rounded" width="80%" />
          <Skeleton height="14px" variant="rounded" width="60%" />
        </Box>
      );
    }

    if (attachments.length === 0) {
      return null;
    }

    return (
      <div className="tw:flex tw:flex-col tw:gap-2">
        {attachments.map((item) => (
          <Card
            className="tw:flex tw:items-center tw:gap-3 tw:p-2"
            data-testid={`attachment-item-${item.id}`}
            key={item.id}>
            <FileIcon
              className="tw:h-6 tw:w-6 tw:shrink-0"
              type={item.fileType}
            />
            <div className="tw:min-w-0 tw:flex-1">
              <Typography ellipsis as="p" size="text-sm" weight="medium">
                {item.name}
              </Typography>
              <Typography as="p" className="tw:text-gray-500" size="text-xs">
                {getReadableFileSize(item.size)}
              </Typography>
            </div>
            <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-1">
              <ButtonUtility
                color="tertiary"
                data-testid={`download-attachment-${item.id}`}
                icon={<Download01 size={14} />}
                size="sm"
                tooltip={t('label.download')}
                onClick={() => handleDownload(item)}
              />
            </div>
          </Card>
        ))}
      </div>
    );
  }, [attachments, isLoading]);

  return (
    <WidgetCard
      dataTestId="attachment-widget"
      isExpandDisabled={false}
      title={t('label.attachment-plural')}>
      {content}
    </WidgetCard>
  );
};

export default AttachmentWidget;
