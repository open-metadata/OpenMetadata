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
  ButtonUtility,
  Card,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { Download01 } from '@untitledui/icons';
import React, { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getFileTypeIcon } from '../../../utils/ContextCenterUtils';
import { UploadedDocumentCardProps } from './UploadedDocumentCard.interface';

const UploadedDocumentCard: FC<UploadedDocumentCardProps> = ({
  document,
  onClick,
  onDownload,
}) => {
  const { t } = useTranslation();
  const { name, fileType, sizeLabel } = document;

  const fileTypeIcon = useMemo(() => {
    return getFileTypeIcon(fileType);
  }, [fileType]);

  return (
    <Card
      isClickable
      className="tw:flex tw:flex-col tw:gap-3 tw:max-w-42"
      data-testid="uploaded-document-card"
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(document);
      }}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(document);
        }
      }}>
      <div className="tw:flex tw:items-center tw:justify-center tw:h-15 tw:bg-gray-50">
        {fileTypeIcon}
      </div>

      <div className="tw:flex tw:flex-col tw:p-3">
        <Typography
          ellipsis
          className="tw:m-0"
          size="text-xs"
          title={name}
          weight="medium">
          {name}
        </Typography>
        <div className="tw:flex tw:items-center tw:justify-between">
          <Typography className="tw:text-gray-400" size="text-xs">
            {sizeLabel}
          </Typography>
          {onDownload && <Tooltip title={t('label.download')}>
            <TooltipTrigger>
              <ButtonUtility
                color="tertiary"
                icon={
                  <Download01
                    className="tw:text-gray-500"
                    height={16}
                    width={16}
                  />
                }
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload?.(document);
                }}
              />
            </TooltipTrigger>
          </Tooltip>}
        </div>
      </div>
    </Card>
  );
};

export default UploadedDocumentCard;
