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
import type { TFunction } from 'i18next';
import type { MetricApprovalHistoryItem } from './useMetricApprovalHistory';

const normalize = (value: string): string =>
  value.replace(/[\s_'"():-]/g, '').toLocaleLowerCase();

const OUTCOME_LABELS: Partial<
  Record<NonNullable<MetricApprovalHistoryItem['outcome']>, string>
> = {
  approved: 'label.approved',
  rejected: 'label.rejected',
  rollback: 'label.rolled-back',
};

const HISTORY_LABEL_RULES = [
  { labels: ['approved', 'approve'], key: 'label.approved' },
  { labels: ['rejected', 'reject'], key: 'label.rejected' },
  { labels: ['rollback', 'rolledback'], key: 'label.rolled-back' },
  { labels: ['draft'], key: 'label.draft' },
  { labels: ['review', 'approval'], key: 'label.in-review' },
];

const STATUS_LABEL_RULES = [
  { labels: ['approved'], key: 'label.approved' },
  { labels: ['rejected'], key: 'label.rejected' },
  { labels: ['failed'], key: 'label.failed' },
  { labels: ['finished', 'completed'], key: 'label.completed' },
  { labels: ['running', 'inprogress'], key: 'label.running' },
  { labels: ['open'], key: 'label.open' },
  { labels: ['pending'], key: 'label.pending-task' },
  { labels: ['cancelled', 'revoked'], key: 'label.cancelled' },
];

const findLabelKey = (
  normalizedValue: string,
  rules: Array<{ key: string; labels: string[] }>
) =>
  rules.find(({ labels }) =>
    labels.some((label) => normalizedValue.includes(label))
  )?.key;

export const getMetricApprovalHistoryLabel = (
  t: TFunction,
  item: MetricApprovalHistoryItem
): string => {
  const outcomeLabel = item.outcome && OUTCOME_LABELS[item.outcome];
  if (outcomeLabel) {
    return t(outcomeLabel);
  }

  const label = normalize(item.label);
  const historyLabel = findLabelKey(label, HISTORY_LABEL_RULES);
  if (historyLabel) {
    return t(historyLabel);
  }
  const isMetricChange = ['metriccreated', 'metricupdated'].some((value) =>
    label.includes(value)
  );
  if (isMetricChange) {
    return `${t('label.metric')} · ${t('label.updated')}`;
  }

  return `${t('label.workflow')} · ${t('label.stage')}`;
};

export const getMetricApprovalHistoryStatusLabel = (
  t: TFunction,
  status: string
): string => {
  const normalizedStatus = normalize(status);
  const labelKey = findLabelKey(normalizedStatus, STATUS_LABEL_RULES);

  return t(labelKey ?? 'label.unknown');
};
