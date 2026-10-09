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

import { Box, Typography } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { TestCaseStatus } from '../../../../generated/tests/testCase';
import { formatDateTime } from '../../../../utils/date-time/DateTimeUtils';
import type { LastRunTimeProps } from './TestCaseLastRunBanner.interface';
import { getNextRunLabel } from './TestCaseLastRunBanner.utils';

const LastRunTime = ({
  nextRunTimestamp,
  testCaseStatus,
  timestamp,
}: LastRunTimeProps) => {
  const { t } = useTranslation();

  return (
    <Box
      align="end"
      className="tw:min-w-36 tw:text-right"
      direction="col"
      justify="center">
      <Typography
        className="tw:whitespace-nowrap tw:text-primary"
        data-testid="test-case-last-run-time"
        size="text-xs"
        weight="regular">
        {formatDateTime(timestamp)}
      </Typography>
      <Typography
        className="tw:mt-1 tw:whitespace-nowrap tw:text-secondary"
        data-testid="test-case-next-run"
        size="text-xs">
        {t('label.next')} ·{' '}
        {testCaseStatus === TestCaseStatus.Queued
          ? t('label.running-now')
          : getNextRunLabel(
              nextRunTimestamp,
              t('label.in-lowercase'),
              t('label.not-scheduled')
            )}
      </Typography>
    </Box>
  );
};

export default LastRunTime;
