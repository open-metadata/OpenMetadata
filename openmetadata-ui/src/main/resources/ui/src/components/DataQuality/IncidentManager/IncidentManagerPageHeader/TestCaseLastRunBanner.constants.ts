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

import { Check, Clock, Minus, SlashCircle01, XClose } from '@untitledui/icons';
import {
  TestCaseResolutionStatusTypes,
  TestCaseStatus,
} from '../../../../generated/tests/testCase';

export const NO_RUN_BANNER_TEST_ID = 'test-case-last-run-banner-not-run-yet';

export const NO_RUN_CONFIG = {
  containerClassName: 'tw:border-utility-gray-200 tw:border-l-utility-gray-400',
  icon: Minus,
  iconColor: 'gray',
  statusClassName: 'tw:text-secondary',
  statusLabel: 'label.not-run-yet',
  summaryClassName: 'tw:bg-secondary',
  testId: NO_RUN_BANNER_TEST_ID,
} as const;

export const STATUS_CONFIG = {
  [TestCaseStatus.Aborted]: {
    containerClassName:
      'tw:border-utility-warning-200 tw:border-l-utility-warning-500',
    dividerClassName: 'tw:border-utility-warning-200',
    icon: SlashCircle01,
    iconColor: 'warning',
    incidentClassName: 'tw:bg-yellow-50',
    resultClassName: 'tw:text-warning-primary',
    statusClassName: 'tw:text-warning-primary',
    statusLabel: 'label.aborted',
    summaryClassName: 'tw:bg-yellow-50',
    testId: 'test-case-last-run-banner-aborted',
  },
  [TestCaseStatus.Failed]: {
    containerClassName:
      'tw:border-utility-error-200 tw:border-l-utility-error-500',
    dividerClassName: 'tw:border-utility-error-200',
    icon: XClose,
    iconColor: 'error',
    incidentClassName: 'tw:bg-error-50',
    resultClassName: 'tw:text-error-primary',
    statusClassName: 'tw:text-error-primary',
    statusLabel: 'label.failed',
    summaryClassName: 'tw:bg-error-50',
    testId: 'test-case-last-run-banner-failed',
  },
  [TestCaseStatus.Queued]: {
    containerClassName:
      'tw:border-utility-brand-200 tw:border-l-utility-brand-500',
    dividerClassName: 'tw:border-utility-brand-200',
    icon: Clock,
    iconColor: 'brand',
    incidentClassName: 'tw:bg-brand-primary',
    resultClassName: 'tw:text-brand-primary',
    statusClassName: 'tw:text-brand-primary',
    statusLabel: 'label.queued',
    summaryClassName: 'tw:bg-brand-primary',
    testId: 'test-case-last-run-banner-queued',
  },
  [TestCaseStatus.Success]: {
    containerClassName:
      'tw:border-utility-success-200 tw:border-l-utility-success-500',
    dividerClassName: 'tw:border-utility-success-200',
    icon: Check,
    iconColor: 'success',
    incidentClassName: 'tw:bg-success-primary',
    resultClassName: 'tw:text-success-primary',
    statusClassName: 'tw:text-success-primary',
    statusLabel: 'label.success',
    summaryClassName: 'tw:bg-success-primary',
    testId: 'test-case-last-run-banner-success',
  },
} as const;

export const INCIDENT_STATUS_CONFIG = {
  [TestCaseResolutionStatusTypes.ACK]: {
    color: 'brand',
    label: 'label.acknowledged',
  },
  [TestCaseResolutionStatusTypes.Assigned]: {
    color: 'warning',
    label: 'label.assigned',
  },
  [TestCaseResolutionStatusTypes.New]: {
    color: 'brand',
    label: 'label.new',
  },
  [TestCaseResolutionStatusTypes.Resolved]: {
    color: 'success',
    label: 'label.resolved',
  },
} as const;

export const INCIDENT_RUN_STATUSES = new Set([
  TestCaseStatus.Aborted,
  TestCaseStatus.Failed,
]);

export const METRIC_RUN_STATUSES = new Set([
  TestCaseStatus.Failed,
  TestCaseStatus.Success,
]);

export type IncidentStatusConfig =
  (typeof INCIDENT_STATUS_CONFIG)[keyof typeof INCIDENT_STATUS_CONFIG];
export type StatusConfig = (typeof STATUS_CONFIG)[keyof typeof STATUS_CONFIG];
export type BannerLayoutConfig =
  | typeof NO_RUN_CONFIG
  | Pick<
      StatusConfig,
      | 'containerClassName'
      | 'icon'
      | 'iconColor'
      | 'statusClassName'
      | 'statusLabel'
      | 'summaryClassName'
      | 'testId'
    >;
