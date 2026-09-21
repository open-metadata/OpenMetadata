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

// The banner carries the status tint, so the incident strip washes it back with
// translucent white to sit a shade lighter than the summary row above it.
const INCIDENT_STRIP_CLASS = 'tw:bg-primary/55';

export const NO_RUN_CONFIG = {
  containerClassName:
    'tw:border-utility-gray-200 tw:border-l-utility-gray-400 tw:bg-secondary',
  icon: Minus,
  iconColor: 'gray',
  statusClassName: 'tw:text-secondary',
  statusLabel: 'label.not-run-yet',
  testId: NO_RUN_BANNER_TEST_ID,
} as const;

export const STATUS_CONFIG = {
  [TestCaseStatus.Aborted]: {
    actionBorderClassName: 'tw:after:outline-utility-warning-200!',
    containerClassName:
      'tw:border-utility-warning-200 tw:border-l-utility-warning-600 tw:bg-warning-primary',
    dividerClassName: 'tw:border-utility-warning-200',
    icon: SlashCircle01,
    iconColor: 'warning',
    incidentClassName: INCIDENT_STRIP_CLASS,
    resultClassName: 'tw:text-warning-primary',
    statusClassName: 'tw:text-warning-primary',
    statusLabel: 'label.aborted',
    testId: 'test-case-last-run-banner-aborted',
  },
  [TestCaseStatus.Failed]: {
    actionBorderClassName: 'tw:after:outline-utility-error-200!',
    containerClassName:
      'tw:border-utility-error-200 tw:border-l-utility-error-600 tw:bg-error-primary',
    dividerClassName: 'tw:border-utility-error-200',
    icon: XClose,
    iconColor: 'error',
    incidentClassName: INCIDENT_STRIP_CLASS,
    resultClassName: 'tw:text-error-primary',
    statusClassName: 'tw:text-error-primary',
    statusLabel: 'label.failed',
    testId: 'test-case-last-run-banner-failed',
  },
  [TestCaseStatus.Queued]: {
    actionBorderClassName: 'tw:after:outline-utility-brand-200!',
    containerClassName:
      'tw:border-utility-brand-200 tw:border-l-utility-brand-600 tw:bg-brand-primary',
    dividerClassName: 'tw:border-utility-brand-200',
    icon: Clock,
    iconColor: 'brand',
    incidentClassName: INCIDENT_STRIP_CLASS,
    resultClassName: 'tw:text-brand-primary',
    statusClassName: 'tw:text-brand-primary',
    statusLabel: 'label.queued',
    testId: 'test-case-last-run-banner-queued',
  },
  [TestCaseStatus.Success]: {
    actionBorderClassName: 'tw:after:outline-utility-success-200!',
    containerClassName:
      'tw:border-utility-success-200 tw:border-l-utility-success-600 tw:bg-success-primary',
    dividerClassName: 'tw:border-utility-success-200',
    icon: Check,
    iconColor: 'success',
    incidentClassName: INCIDENT_STRIP_CLASS,
    resultClassName: 'tw:text-success-primary',
    statusClassName: 'tw:text-success-primary',
    statusLabel: 'label.success',
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
    color: 'error',
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
      | 'testId'
    >;
