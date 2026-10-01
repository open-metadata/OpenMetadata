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
import { AlertTriangle } from '@openmetadata/ui-core-components/icons';
import { CheckCircle, Clock } from '@openmetadata/ui-core-components/icons';
import type { FC, SVGProps } from 'react';
import { TestCaseStatus } from '../../../../generated/tests/testCase';

/**
 * Per-status styling of the card. Tailwind only ships classes it can read in
 * the source, so every class is spelled out rather than built from the colour.
 */
export interface RunDetailsStatusStyle {
  barClassName: string;
  color: 'brand' | 'error' | 'success' | 'warning';
  note?: {
    icon: FC<SVGProps<SVGSVGElement>>;
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
    barClassName: 'tw:bg-fg-warning-primary',
    color: 'warning',
    valueClassName: 'tw:text-tertiary',
  },
  [TestCaseStatus.Failed]: {
    barClassName: 'tw:bg-fg-error-primary',
    color: 'error',
    note: {
      icon: AlertTriangle,
      iconClassName: 'tw:text-fg-error-primary',
      messageKey: 'message.run-details-failed-note',
    },
    valueClassName: 'tw:text-utility-error-700',
  },
  [TestCaseStatus.Queued]: {
    barClassName: 'tw:bg-fg-brand-primary',
    color: 'brand',
    note: {
      icon: Clock,
      iconClassName: 'tw:text-fg-brand-primary',
      messageKey: 'message.run-details-queued-note',
    },
    valueClassName: 'tw:text-tertiary',
  },
  [TestCaseStatus.Success]: {
    barClassName: 'tw:bg-fg-success-primary',
    color: 'success',
    note: {
      icon: CheckCircle,
      iconClassName: 'tw:text-fg-success-primary',
      messageKey: 'message.run-details-success-note',
    },
    valueClassName: 'tw:text-utility-success-700',
  },
};
