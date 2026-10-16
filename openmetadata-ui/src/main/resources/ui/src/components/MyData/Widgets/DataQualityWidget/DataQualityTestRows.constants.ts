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
  Check,
  SlashCircle01,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import type { FC } from 'react';
import { TestCaseStatus } from '../../../../generated/tests/testCase';
import { TestCaseResolutionStatusTypes } from '../../../../generated/tests/testCaseResolutionStatus';

export type StatusColor = 'success' | 'error' | 'warning';

export const TEST_STATUS: Partial<
  Record<
    TestCaseStatus,
    { color: StatusColor; icon: FC<{ className?: string }>; labelKey: string }
  >
> = {
  [TestCaseStatus.Failed]: {
    color: 'error',
    icon: XClose,
    labelKey: 'label.failed',
  },
  [TestCaseStatus.Aborted]: {
    color: 'warning',
    icon: SlashCircle01,
    labelKey: 'label.aborted',
  },
  [TestCaseStatus.Success]: {
    color: 'success',
    icon: Check,
    labelKey: 'label.passed',
  },
};

// `!` on the colours: Typography renders `.prose`, whose unlayered `color`
// rule is emitted after the Tailwind utilities.
export const COUNT_TEXT: Record<StatusColor, string> = {
  success: 'tw:text-utility-success-700!',
  error: 'tw:text-utility-error-700!',
  warning: 'tw:text-utility-warning-700!',
};

export const GROUP_COUNTS: {
  key: 'passed' | 'failed' | 'aborted';
  color: StatusColor;
  messageKey: string;
}[] = [
  { key: 'passed', color: 'success', messageKey: 'message.count-passed-test' },
  { key: 'failed', color: 'error', messageKey: 'message.count-failed-test' },
  {
    key: 'aborted',
    color: 'warning',
    messageKey: 'message.count-aborted-test',
  },
];

/** An incident's stage, coloured by how far along it is. */
export const INCIDENT_STATUS: Record<
  TestCaseResolutionStatusTypes,
  { labelKey: string; text: string }
> = {
  [TestCaseResolutionStatusTypes.New]: {
    labelKey: 'label.new',
    text: 'tw:text-utility-error-700',
  },
  [TestCaseResolutionStatusTypes.ACK]: {
    labelKey: 'label.ack',
    text: 'tw:text-utility-blue-700',
  },
  [TestCaseResolutionStatusTypes.Assigned]: {
    labelKey: 'label.assigned',
    text: 'tw:text-utility-warning-700',
  },
  [TestCaseResolutionStatusTypes.Resolved]: {
    labelKey: 'label.resolved',
    text: 'tw:text-utility-success-700',
  },
};
