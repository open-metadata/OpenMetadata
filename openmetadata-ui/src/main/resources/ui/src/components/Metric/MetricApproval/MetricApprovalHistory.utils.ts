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
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 */
import type { TFunction } from 'i18next';
import type { MetricApprovalHistoryItem } from './useMetricApprovalHistory';

const normalize = (value: string): string =>
  value.replace(/[\s_'"():-]/g, '').toLocaleLowerCase();

export const getMetricApprovalHistoryLabel = (
  t: TFunction,
  item: MetricApprovalHistoryItem
): string => {
  if (item.outcome === 'approved') {
    return t('label.approved');
  }
  if (item.outcome === 'rejected') {
    return t('label.rejected');
  }
  if (item.outcome === 'rollback') {
    return t('label.rolled-back');
  }

  const label = normalize(item.label);
  if (label.includes('approved') || label.includes('approve')) {
    return t('label.approved');
  }
  if (label.includes('rejected') || label.includes('reject')) {
    return t('label.rejected');
  }
  if (label.includes('rollback') || label.includes('rolledback')) {
    return t('label.rolled-back');
  }
  if (label.includes('draft')) {
    return t('label.draft');
  }
  if (label.includes('review') || label.includes('approval')) {
    return t('label.in-review');
  }
  if (label.includes('metriccreated') || label.includes('metricupdated')) {
    return `${t('label.metric')} · ${t('label.updated')}`;
  }

  return `${t('label.workflow')} · ${t('label.stage')}`;
};

export const getMetricApprovalHistoryStatusLabel = (
  t: TFunction,
  status: string
): string => {
  const normalizedStatus = normalize(status);
  if (normalizedStatus.includes('approved')) {
    return t('label.approved');
  }
  if (normalizedStatus.includes('rejected')) {
    return t('label.rejected');
  }
  if (normalizedStatus.includes('failed')) {
    return t('label.failed');
  }
  if (
    normalizedStatus.includes('finished') ||
    normalizedStatus.includes('completed')
  ) {
    return t('label.completed');
  }
  if (
    normalizedStatus.includes('running') ||
    normalizedStatus.includes('inprogress')
  ) {
    return t('label.running');
  }
  if (normalizedStatus.includes('open')) {
    return t('label.open');
  }
  if (normalizedStatus.includes('pending')) {
    return t('label.pending-task');
  }
  if (
    normalizedStatus.includes('cancelled') ||
    normalizedStatus.includes('revoked')
  ) {
    return t('label.cancelled');
  }

  return t('label.unknown');
};
