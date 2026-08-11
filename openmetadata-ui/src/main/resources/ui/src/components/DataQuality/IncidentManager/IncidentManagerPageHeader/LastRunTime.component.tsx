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

import { useTranslation } from 'react-i18next';
import { TestCaseStatus } from '../../../../generated/tests/testCase';
import { customFormatDateTime } from '../../../../utils/date-time/DateTimeUtils';
import type { LastRunTimeProps } from './TestCaseLastRunBanner.interface';
import { getNextRunLabel } from './TestCaseLastRunBanner.utils';

const LastRunTime = ({
  nextRunTimestamp,
  testCaseStatus,
  timestamp,
}: LastRunTimeProps) => {
  const { t } = useTranslation();

  return (
    <div className="tw:flex tw:min-w-36 tw:flex-col tw:items-end tw:justify-center tw:text-right">
      <span
        className="tw:whitespace-nowrap tw:text-xs tw:font-normal tw:text-primary"
        data-testid="test-case-last-run-time">
        {customFormatDateTime(timestamp, 'MMM d, yyyy, h:mm a')}
      </span>
      <span
        className="tw:mt-1 tw:whitespace-nowrap tw:text-xs tw:text-secondary"
        data-testid="test-case-next-run">
        {t('label.next')} ·{' '}
        {testCaseStatus === TestCaseStatus.Queued
          ? t('label.running-now')
          : getNextRunLabel(
              nextRunTimestamp,
              t('label.in-lowercase'),
              t('label.not-scheduled')
            )}
      </span>
    </div>
  );
};

export default LastRunTime;
