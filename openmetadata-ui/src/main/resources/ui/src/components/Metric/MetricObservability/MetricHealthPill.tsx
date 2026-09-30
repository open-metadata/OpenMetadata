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
import { Badge, Skeleton } from '@openmetadata/ui-core-components';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Health } from '../../../generated/api/data/metricObservability';

export interface MetricHealthPillProps {
  health?: Health;
  score?: number;
  isLoading?: boolean;
  'data-testid'?: string;
}

const HEALTH_LABEL_KEYS: Record<Health, string> = {
  [Health.Healthy]: 'label.healthy',
  [Health.AtRisk]: 'label.at-risk',
  [Health.Degraded]: 'label.degraded',
  [Health.Unknown]: 'label.unknown',
};

const HEALTH_COLORS: Record<Health, 'error' | 'gray' | 'success' | 'warning'> =
  {
    [Health.Healthy]: 'success',
    [Health.AtRisk]: 'warning',
    [Health.Degraded]: 'error',
    [Health.Unknown]: 'gray',
  };

const HEALTH_DOT_CLASSES: Record<Health, string> = {
  [Health.Healthy]: 'tw:bg-utility-success-500',
  [Health.AtRisk]: 'tw:bg-utility-warning-500',
  [Health.Degraded]: 'tw:bg-utility-error-500',
  [Health.Unknown]: 'tw:bg-utility-gray-500',
};

const MetricHealthPill: FC<MetricHealthPillProps> = ({
  health,
  score,
  isLoading,
  'data-testid': dataTestId = 'metric-health-pill',
}) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <span data-testid={`${dataTestId}-loading`}>
        <Skeleton height={22} variant="rounded" width={104} />
      </span>
    );
  }

  const effectiveHealth = health ?? Health.Unknown;
  const label = t(HEALTH_LABEL_KEYS[effectiveHealth]);
  const scoreLabel = score === undefined ? '' : String(Math.round(score));

  return (
    <span
      aria-label={`${label} ${scoreLabel}`.trim()}
      data-testid={dataTestId}
      role="status">
      <Badge
        className="tw:gap-1.5"
        color={HEALTH_COLORS[effectiveHealth]}
        size="sm">
        <span
          aria-hidden="true"
          className={`tw:size-1.5 tw:rounded-full ${HEALTH_DOT_CLASSES[effectiveHealth]}`}
        />
        {scoreLabel && (
          <span className="tw:tabular-nums" data-testid={`${dataTestId}-score`}>
            {scoreLabel}
          </span>
        )}
        {label}
      </Badge>
    </span>
  );
};

export default MetricHealthPill;
