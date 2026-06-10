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

import { Badge } from '@openmetadata/ui-core-components';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ProcessingStatus } from '../../../generated/entity/data/contextFile';
import { DocumentStatusBadgeProps } from './DocumentStatusBadge.interface';

type BadgeColor = 'gray' | 'blue' | 'indigo' | 'success' | 'error' | 'warning';

const STATUS_CONFIG: Record<
  ProcessingStatus,
  { color: BadgeColor; labelKey: string }
> = {
  [ProcessingStatus.Uploaded]: { color: 'gray', labelKey: 'label.uploaded' },
  [ProcessingStatus.Analyzing]: { color: 'blue', labelKey: 'label.analyzing' },
  [ProcessingStatus.ExtractingContext]: {
    color: 'indigo',
    labelKey: 'label.extracting-context',
  },
  [ProcessingStatus.Processed]: {
    color: 'success',
    labelKey: 'label.processed',
  },
  [ProcessingStatus.Failed]: { color: 'error', labelKey: 'label.failed' },
  [ProcessingStatus.Unsupported]: {
    color: 'warning',
    labelKey: 'label.unsupported',
  },
};

const DocumentStatusBadge: FC<DocumentStatusBadgeProps> = ({ status }) => {
  const { t } = useTranslation();

  if (!status) {
    return null;
  }

  const config = STATUS_CONFIG[status];

  return (
    <span className="tw:shrink-0" data-testid="document-status-badge">
      <Badge color={config.color} size="sm">
        {t(config.labelKey)}
      </Badge>
    </span>
  );
};

export default DocumentStatusBadge;
