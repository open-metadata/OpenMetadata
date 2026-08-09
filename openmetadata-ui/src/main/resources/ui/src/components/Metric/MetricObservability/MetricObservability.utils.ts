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
import { isAxiosError } from 'axios';
import type { TFunction } from 'i18next';
import {
  EntityReference,
  ReasonCode,
} from '../../../generated/api/data/metricObservability';

const DIMENSION_LABEL_KEYS: Record<string, string> = {
  accuracy: 'label.accuracy',
  completeness: 'label.completeness',
  consistency: 'label.consistency',
  integrity: 'label.integrity',
  nodimension: 'label.no-dimension',
  sql: 'label.sql-uppercase',
  uniqueness: 'label.uniqueness',
  validity: 'label.validity',
};

const REASON_LABEL_KEYS: Record<ReasonCode, string> = {
  [ReasonCode.NoLinkedAssets]: 'label.no-assets-linked-yet',
  [ReasonCode.NoUpstreamTables]: 'message.only-upstream-assets-scored',
  [ReasonCode.NoTerminalResults]:
    'message.metric-observability-reason-no-terminal-results',
  [ReasonCode.Healthy]: 'label.healthy',
  [ReasonCode.AtRisk]: 'label.at-risk',
  [ReasonCode.Degraded]: 'label.degraded',
  [ReasonCode.Unavailable]: 'message.metric-health-unavailable',
  [ReasonCode.PartialDetails]: 'label.partial-coverage',
};

const RESULT_LABEL_KEYS: Record<string, string> = {
  ack: 'label.acknowledged',
  aborted: 'label.aborted',
  closed: 'label.closed',
  critical: 'label.critical',
  failed: 'label.failed',
  assigned: 'label.assigned',
  missing: 'label.missing',
  new: 'label.new',
  open: 'label.open',
  passed: 'label.passed',
  queued: 'label.queued',
  resolved: 'label.resolved',
  success: 'label.success',
  warning: 'label.warning',
};

export const getMetricDimensionLabelKey = (
  dimension: string
): string | undefined =>
  DIMENSION_LABEL_KEYS[dimension.replace(/[\s_-]/g, '').toLocaleLowerCase()];

export const getMetricObservabilityReasonLabelKey = (
  reasonCode?: ReasonCode
): string | undefined =>
  reasonCode ? REASON_LABEL_KEYS[reasonCode] : undefined;

export const getMetricResultLabelKey = (status?: string): string | undefined =>
  status ? RESULT_LABEL_KEYS[status.toLocaleLowerCase()] : undefined;

export const getMetricIncidentSeverityLabel = (
  t: TFunction,
  severity?: string
): string => {
  const match = /^severity([1-5])$/i.exec(severity ?? '');

  return match ? `${t('label.severity')} ${match[1]}` : t('label.unknown');
};

export const isMetricObservabilityPermissionError = (error: unknown): boolean =>
  isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0);

export const isRedactedMetricAsset = (asset: EntityReference): boolean =>
  !asset.name && !asset.displayName && !asset.fullyQualifiedName;

export const getMetricResultBadgeColor = (
  status?: string
): 'error' | 'gray' | 'success' | 'warning' => {
  switch (status?.toLocaleLowerCase()) {
    case 'success':
    case 'passed':
      return 'success';
    case 'failed':
    case 'aborted':
      return 'error';
    case 'warning':
      return 'warning';
    default:
      return 'gray';
  }
};
