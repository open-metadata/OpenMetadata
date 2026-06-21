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
import { OntologyProcessingStatus } from '../../../generated/entity/context/contextMemory';
import { OntologyStatusBadgeProps } from './OntologyStatusBadge.interface';

type BadgeColor = 'gray' | 'blue' | 'success' | 'error';

const STATUS_CONFIG: Record<
  OntologyProcessingStatus,
  { color: BadgeColor; labelKey: string }
> = {
  [OntologyProcessingStatus.Queued]: {
    color: 'gray',
    labelKey: 'label.queued',
  },
  [OntologyProcessingStatus.Processing]: {
    color: 'blue',
    labelKey: 'label.processing',
  },
  [OntologyProcessingStatus.Processed]: {
    color: 'success',
    labelKey: 'label.processed',
  },
  [OntologyProcessingStatus.Failed]: {
    color: 'error',
    labelKey: 'label.failed',
  },
};

const OntologyStatusBadge: FC<OntologyStatusBadgeProps> = ({
  error,
  status,
}) => {
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
    status === OntologyProcessingStatus.Failed && error ? error : undefined;

  const badge = (
    <Badge color={config.color} size="sm">
      {t('label.ontology')}
      {': '}
      {t(config.labelKey)}
    </Badge>
  );

  return (
    <span className="tw:shrink-0" data-testid="ontology-status-badge">
      {tooltipTitle ? (
        <Tooltip title={tooltipTitle}>
          <TooltipTrigger data-testid="ontology-status-tooltip-trigger">
            {badge}
          </TooltipTrigger>
        </Tooltip>
      ) : (
        badge
      )}
    </span>
  );
};

export default OntologyStatusBadge;
