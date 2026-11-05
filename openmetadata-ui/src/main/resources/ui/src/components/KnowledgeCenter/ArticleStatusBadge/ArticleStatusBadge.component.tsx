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
  Badge,
  Tooltip,
  TooltipTrigger,
} from '@openmetadata/ui-core-components';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { PageProcessingStatus } from '../../../generated/entity/data/page';
import { ArticleStatusBadgeProps } from './ArticleStatusBadge.interface';

type BadgeColor = 'gray' | 'blue' | 'success' | 'error';

const STATUS_CONFIG: Record<
  PageProcessingStatus,
  { color: BadgeColor; labelKey: string }
> = {
  [PageProcessingStatus.Queued]: { color: 'gray', labelKey: 'label.queued' },
  [PageProcessingStatus.Processing]: {
    color: 'blue',
    labelKey: 'label.processing',
  },
  [PageProcessingStatus.Processed]: {
    color: 'success',
    labelKey: 'label.processed',
  },
  [PageProcessingStatus.Failed]: { color: 'error', labelKey: 'label.failed' },
};

const ArticleStatusBadge: FC<ArticleStatusBadgeProps> = ({ error, status }) => {
  const { t } = useTranslation();

  if (!status) {
    return null;
  }

  // A backend newer than this UI can report a status we don't know yet
  const config: { color: BadgeColor; labelKey: string } | undefined =
    STATUS_CONFIG[status];

  if (!config) {
    return null;
  }

  const tooltipTitle =
    status === PageProcessingStatus.Failed && error ? error : undefined;

  const badge = (
    <Badge color={config.color} size="sm">
      {t(config.labelKey)}
    </Badge>
  );

  return (
    <span className="tw:shrink-0" data-testid="article-status-badge">
      {tooltipTitle ? (
        <Tooltip title={tooltipTitle}>
          <TooltipTrigger data-testid="article-status-tooltip-trigger">
            {badge}
          </TooltipTrigger>
        </Tooltip>
      ) : (
        badge
      )}
    </span>
  );
};

export default ArticleStatusBadge;
