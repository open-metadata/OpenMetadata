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
  ButtonUtility,
  Card,
  FileIcon,
  getReadableFileSize,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { Copy06, Download01 } from '@untitledui/icons';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  WidgetEditButton,
  WidgetPlusButton,
} from '../../common/WidgetActionButton/WidgetActionButton';
import WidgetCard from '../../common/WidgetCard/WidgetCard';
import {
  AttachmentItem,
  AttachmentWidgetProps,
} from './AttachmentWidget.interface';

const AttachmentWidget: FC<AttachmentWidgetProps> = ({ hasPermission }) => {
  const { t } = useTranslation();

  const attachments: AttachmentItem[] = [];

  const handleCopy = (item: AttachmentItem) => {
    navigator.clipboard.writeText(item.downloadUrl ?? item.name);
  };

  const handleDownload = (item: AttachmentItem) => {
    if (item.downloadUrl) {
      window.open(item.downloadUrl, '_blank');
    }
  };

  const content = useMemo(() => {
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
              <Tooltip title={t('label.copy')}>
                <TooltipTrigger>
                  <ButtonUtility
                    color="tertiary"
                    data-testid={`copy-attachment-${item.id}`}
                    icon={<Copy06 size={12} />}
                    size="xs"
                    onClick={() => handleCopy(item)}
                  />
                </TooltipTrigger>
              </Tooltip>
              <Tooltip title={t('label.download')}>
                <TooltipTrigger>
                  <ButtonUtility
                    color="tertiary"
                    data-testid={`download-attachment-${item.id}`}
                    icon={<Download01 size={12} />}
                    size="xs"
                    onClick={() => handleDownload(item)}
                  />
                </TooltipTrigger>
              </Tooltip>
            </div>
          </Card>
        ))}
      </div>
    );
  }, [attachments, hasPermission]);

  const headerExtra = hasPermission ? (
    attachments.length === 0 ? (
      <WidgetPlusButton
        data-testid="add-attachment"
        title={t('label.add-entity', { entity: t('label.attachment-plural') })}
      />
    ) : (
      <WidgetEditButton
        data-testid="edit-attachment"
        title={t('label.edit-entity', {
          entity: t('label.attachment-plural'),
        })}
      />
    )
  ) : null;

  return (
    <WidgetCard
      dataTestId="attachment-widget"
      headerExtra={headerExtra}
      isExpandDisabled={attachments.length === 0}
      title={t('label.attachment-plural')}>
      {content}
    </WidgetCard>
  );
};

export default AttachmentWidget;
