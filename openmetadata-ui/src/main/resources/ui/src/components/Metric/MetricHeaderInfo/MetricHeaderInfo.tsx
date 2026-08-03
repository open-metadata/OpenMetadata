/*
 *  Copyright 2024 Collate.
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
import { Badge, Box, Typography } from '@openmetadata/ui-core-components';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Metric } from '../../../generated/entity/data/metric';
import { useMetricObservability } from '../../../hooks/useMetricObservability';
import {
  getMetricEnumLabel,
  getMetricTypeBadgeColor,
  METRIC_GRANULARITY_CLASS_NAME,
  METRIC_TYPE_BADGE_CLASS_NAME,
} from '../../../utils/MetricEntityUtils/MetricDisplayUtils';
import MetricHealthPill from '../MetricObservability/MetricHealthPill.component';

interface MetricHeaderInfoProps {
  metricDetails: Metric;
  status?: ReactNode;
}

const MetricHeaderInfo = ({ metricDetails, status }: MetricHeaderInfoProps) => {
  const { t } = useTranslation();
  const { observability, isPending: isHealthPending } = useMetricObservability(
    metricDetails.id
  );
  const metricType = metricDetails.metricType
    ? getMetricEnumLabel(t, metricDetails.metricType)
    : t('label.empty-dash');
  const granularity = metricDetails.granularity
    ? getMetricEnumLabel(t, metricDetails.granularity)
    : t('label.empty-dash');

  return (
    <Box
      inline
      align="center"
      aria-label={t('label.metric')}
      className="tw:min-w-0"
      data-testid="metric-header-info"
      gap={2}
      role="group"
      wrap="wrap">
      <Badge
        className={METRIC_TYPE_BADGE_CLASS_NAME}
        color={getMetricTypeBadgeColor(metricDetails.metricType)}
        data-testid="metric-type"
        size="xs"
        type="color">
        {metricType}
      </Badge>
      <Typography
        as="span"
        className={METRIC_GRANULARITY_CLASS_NAME}
        data-testid="granularity"
        size="text-xs"
        weight="semibold">
        {granularity}
      </Typography>
      {status}
      <MetricHealthPill
        data-testid="metric-header-health-pill"
        health={observability?.health}
        isLoading={isHealthPending}
        score={observability?.score}
      />
    </Box>
  );
};

export default MetricHeaderInfo;
