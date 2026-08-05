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
  Box,
  Card,
  EmptyPlaceholder,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { CheckCircle, Clock, RefreshCw01, XCircle } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import {
  getMetricApprovalHistoryLabel,
  getMetricApprovalHistoryStatusLabel,
} from './MetricApprovalHistory.utils';
import {
  MetricApprovalHistoryItem,
  useMetricApprovalHistory,
} from './useMetricApprovalHistory';

const getHistoryTone = (
  item: MetricApprovalHistoryItem
): {
  className: string;
  color: 'brand' | 'error' | 'gray' | 'success' | 'warning';
  icon: typeof CheckCircle;
} => {
  const status = item.status.toLocaleLowerCase();
  if (status.includes('reject') || status.includes('fail')) {
    return {
      className: 'tw:bg-utility-error-50 tw:text-fg-error-primary',
      color: 'error',
      icon: XCircle,
    };
  }
  if (status.includes('finish') || status.includes('approve')) {
    return {
      className: 'tw:bg-utility-success-50 tw:text-fg-success-primary',
      color: 'success',
      icon: CheckCircle,
    };
  }
  if (item.isAutomatic) {
    return {
      className: 'tw:bg-utility-brand-50 tw:text-fg-brand-primary',
      color: 'brand',
      icon: RefreshCw01,
    };
  }

  return {
    className: 'tw:bg-utility-warning-50 tw:text-fg-warning-primary',
    color: 'warning',
    icon: Clock,
  };
};

export interface MetricApprovalHistoryProps {
  metricFqn?: string;
}

const MetricApprovalHistory = ({ metricFqn }: MetricApprovalHistoryProps) => {
  const { t } = useTranslation();
  const history = useMetricApprovalHistory(metricFqn);

  return (
    <Card data-testid="metric-approval-history">
      <Card.Header
        extra={
          <Badge color="gray" size="sm">
            {history.data?.length ?? 0}
          </Badge>
        }
        title={t('label.workflow-history')}
      />
      <Card.Content className="tw:relative tw:min-h-64">
        {history.isPending ? (
          <Box direction="col" gap={3}>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton height={64} key={index} variant="rounded" />
            ))}
          </Box>
        ) : history.error ? (
          <EmptyPlaceholder
            actions={[
              {
                key: 'retry',
                label: t('label.try-again'),
                onClick: () => history.refetch(),
              },
            ]}
            description={t('message.temporary-error-try-reloading')}
            title={t('label.error')}
          />
        ) : (history.data?.length ?? 0) === 0 ? (
          <EmptyPlaceholder
            description={t('label.no-entity-available', {
              entity: t('label.workflow-history'),
            })}
            title={t('label.workflow-history')}
          />
        ) : (
          <ol className="tw:flex tw:flex-col">
            {history.data?.map((item, index) => {
              const tone = getHistoryTone(item);
              const Icon = tone.icon;

              return (
                <li
                  className="tw:grid tw:grid-cols-[32px_1fr] tw:gap-3"
                  data-testid={`metric-approval-history-${item.id}`}
                  key={item.id}>
                  <Box align="center" direction="col">
                    <Box
                      align="center"
                      className={`tw:size-8 tw:justify-center tw:rounded-full ${tone.className}`}>
                      <Icon aria-hidden="true" size={16} />
                    </Box>
                    {index < (history.data?.length ?? 0) - 1 && (
                      <span
                        aria-hidden="true"
                        className="tw:min-h-8 tw:w-px tw:flex-1 tw:bg-border-secondary"
                      />
                    )}
                  </Box>
                  <Box className="tw:pb-5" direction="col" gap={1}>
                    <Box align="center" className="tw:flex-wrap" gap={2}>
                      <Typography size="text-sm" weight="semibold">
                        {getMetricApprovalHistoryLabel(t, item)}
                      </Typography>
                      <Badge color={tone.color} size="xs">
                        {getMetricApprovalHistoryStatusLabel(t, item.status)}
                      </Badge>
                      {item.isAutomatic && (
                        <Badge color="brand" size="xs">
                          {t('label.automated')}
                        </Badge>
                      )}
                    </Box>
                    <Typography className="tw:text-tertiary" size="text-xs">
                      {item.actor ? `${item.actor} · ` : ''}
                      {formatDateTime(item.timestamp)}
                    </Typography>
                    {item.note && (
                      <Typography
                        className="tw:whitespace-pre-wrap tw:text-secondary"
                        size="text-sm">
                        {item.note}
                      </Typography>
                    )}
                  </Box>
                </li>
              );
            })}
          </ol>
        )}
      </Card.Content>
    </Card>
  );
};

export default MetricApprovalHistory;
