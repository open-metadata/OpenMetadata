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

import { Card, Typography } from '@openmetadata/ui-core-components';
import { FC, useMemo } from 'react';
import { getFileTypeIcon } from 'utils/ContextCenterUtils';
import {
  DocumentFileType,
  UploadedDocumentCardProps,
} from './UploadedDocumentCard.interface';
const FILE_TYPE_STYLES: Record<
  DocumentFileType,
  { label: string; labelBg: string; labelText: string }
> = {
  doc: {
    label: 'DOC',
    labelBg: 'tw:bg-blue-600',
    labelText: 'tw:text-white',
  },
  pdf: {
    label: 'PDF',
    labelBg: 'tw:bg-red-600',
    labelText: 'tw:text-white',
  },
  xls: {
    label: 'XLS',
    labelBg: 'tw:bg-green-600',
    labelText: 'tw:text-white',
  },
  image: {
    label: 'IMG',
    labelBg: 'tw:bg-gray-400',
    labelText: 'tw:text-white',
  },
  other: {
    label: 'FILE',
    labelBg: 'tw:bg-gray-500',
    labelText: 'tw:text-white',
  },
};

const UploadedDocumentCard: FC<UploadedDocumentCardProps> = ({
  document,
  onClick,
}) => {
  const { name, fileType, sizeLabel } = document;

  const fileTypeIcon = useMemo(() => {
    return getFileTypeIcon(fileType);
  }, [fileType]);

  return (
    <Card
      className="tw:flex tw:flex-col tw:gap-3 tw:max-w-42"
      data-testid="uploaded-document-card"
      onClick={() => onClick?.(document)}>
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
        <Typography className="tw:text-gray-400" size="text-xs">
          {sizeLabel}
        </Typography>
      </div>
    </Card>
  );
};

export default UploadedDocumentCard;
