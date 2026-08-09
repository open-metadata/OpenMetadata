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
import { Badge, BadgeColors } from '@openmetadata/ui-core-components';
import {
  Archive,
  Check,
  Clock,
  Edit03,
  Trash01,
  XClose,
} from '@untitledui/icons';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityStatus } from '../../../generated/entity/data/metric';

export interface MetricStatusPillProps {
  status?: EntityStatus;
  className?: string;
  'data-testid'?: string;
}

const STATUS_CONFIG: Record<
  string,
  { labelKey: string; color: BadgeColors; Icon: typeof Check }
> = {
  [EntityStatus.Approved]: {
    labelKey: 'label.approved',
    color: 'success',
    Icon: Check,
  },
  [EntityStatus.InReview]: {
    labelKey: 'label.in-review',
    color: 'warning',
    Icon: Clock,
  },
  [EntityStatus.Draft]: {
    labelKey: 'label.draft',
    color: 'gray',
    Icon: Edit03,
  },
  [EntityStatus.Rejected]: {
    labelKey: 'label.rejected',
    color: 'error',
    Icon: XClose,
  },
  [EntityStatus.Deprecated]: {
    labelKey: 'label.deprecated',
    color: 'gray',
    Icon: Trash01,
  },
  [EntityStatus.Archived]: {
    labelKey: 'label.archived',
    color: 'gray',
    Icon: Archive,
  },
  [EntityStatus.Unprocessed]: {
    labelKey: 'label.unprocessed',
    color: 'gray',
    Icon: Clock,
  },
};

/** Approval status of a metric, including transient and historical states. */
const MetricStatusPill: FC<MetricStatusPillProps> = ({
  status,
  className,
  'data-testid': dataTestId = 'metric-status-pill',
}) => {
  const { t } = useTranslation();

  if (!status) {
    return null;
  }

  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG[EntityStatus.Draft];
  const { Icon } = config;
  const label = t(config.labelKey);

  return (
    <span
      aria-label={label}
      className={className}
      data-testid={dataTestId}
      role="status">
      <Badge className="tw:gap-1" color={config.color} size="sm">
        <Icon aria-hidden="true" className="tw:size-3 tw:shrink-0" />
        {label}
      </Badge>
    </span>
  );
};

export default MetricStatusPill;
