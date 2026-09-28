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
import { AlertTriangle, CheckCircle, Clock } from '@untitledui/icons';
import { TestCaseStatus } from '../../../../generated/tests/testCase';

export const NO_VALUE = '—';

/**
 * Per-status styling of the card. Tailwind only ships classes it can read in
 * the source, so every class is spelled out rather than built from the colour.
 */
export interface RunDetailsStatusStyle {
  badgeColor: 'brand' | 'error' | 'success' | 'warning';
  barClassName: string;
  borderClassName: string;
  headerClassName: string;
  note?: {
    icon: typeof Clock;
    iconClassName: string;
    messageKey: string;
  };
  valueClassName: string;
}

export const RUN_DETAILS_STATUS_STYLE: Record<
  TestCaseStatus,
  RunDetailsStatusStyle
> = {
  [TestCaseStatus.Aborted]: {
    badgeColor: 'warning',
    barClassName: 'tw:bg-fg-warning-primary',
    borderClassName: 'tw:border-utility-warning-200',
    headerClassName: 'tw:bg-utility-warning-50',
    valueClassName: 'tw:text-tertiary',
  },
  [TestCaseStatus.Failed]: {
    badgeColor: 'error',
    barClassName: 'tw:bg-fg-error-primary',
    borderClassName: 'tw:border-utility-error-200',
    headerClassName: 'tw:bg-utility-error-50',
    note: {
      icon: AlertTriangle,
      iconClassName: 'tw:text-fg-error-primary',
      messageKey: 'message.run-details-failed-note',
    },
    valueClassName: 'tw:text-utility-error-700',
  },
  [TestCaseStatus.Queued]: {
    badgeColor: 'brand',
    barClassName: 'tw:bg-fg-brand-primary',
    borderClassName: 'tw:border-utility-brand-200',
    headerClassName: 'tw:bg-utility-brand-50',
    note: {
      icon: Clock,
      iconClassName: 'tw:text-fg-brand-primary',
      messageKey: 'message.run-details-queued-note',
    },
    valueClassName: 'tw:text-tertiary',
  },
  [TestCaseStatus.Success]: {
    badgeColor: 'success',
    barClassName: 'tw:bg-fg-success-primary',
    borderClassName: 'tw:border-utility-success-200',
    headerClassName: 'tw:bg-utility-success-50',
    note: {
      icon: CheckCircle,
      iconClassName: 'tw:text-fg-success-primary',
      messageKey: 'message.run-details-success-note',
    },
    valueClassName: 'tw:text-utility-success-700',
  },
};
