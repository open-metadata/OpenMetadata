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
  Alert,
  Button,
  type AlertVariant,
} from '@openmetadata/ui-core-components';
import { Minus } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import { TestCaseStatus } from '../../../../generated/tests/testCase';
import { formatDateTime } from '../../../../utils/date-time/DateTimeUtils';
import type { TestCaseLastRunBannerProps } from './TestCaseLastRunBanner.interface';

const STATUS_VARIANTS: Record<TestCaseStatus, AlertVariant> = {
  [TestCaseStatus.Aborted]: 'warning',
  [TestCaseStatus.Failed]: 'error',
  [TestCaseStatus.Queued]: 'brand',
  [TestCaseStatus.Success]: 'success',
};

const TestCaseLastRunBanner = ({
  testCaseResult,
  taskLinkInfo,
}: TestCaseLastRunBannerProps) => {
  const { t } = useTranslation();

  if (!testCaseResult?.testCaseStatus) {
    return (
      <Alert
        className="tw:min-w-0"
        data-testid="test-case-last-run-banner"
        icon={Minus}
        rightContent={
          <div className="tw:flex tw:flex-col tw:items-end tw:gap-1 tw:text-tertiary">
            <span aria-hidden="true">—</span>
            <span className="tw:whitespace-nowrap tw:text-xs">
              {t('label.next')} · {t('label.not-scheduled')}
            </span>
          </div>
        }
        title={`${t('label.last-run')} ${t('label.not-run-yet')}`}
        variant="gray">
        <p className="tw:m-0 tw:break-words">
          {t('message.test-case-not-run-yet')}
        </p>
      </Alert>
    );
  }

  const { result, testCaseStatus, timestamp } = testCaseResult;

  const statusLabel = {
    [TestCaseStatus.Aborted]: t('label.aborted'),
    [TestCaseStatus.Failed]: t('label.failed'),
    [TestCaseStatus.Queued]: t('label.queued'),
    [TestCaseStatus.Success]: t('label.success'),
  }[testCaseStatus];
  const description =
    result ||
    (testCaseStatus === TestCaseStatus.Queued
      ? t('message.test-case-run-queued')
      : undefined);
  const incidentLink =
    taskLinkInfo &&
    (testCaseStatus === TestCaseStatus.Aborted ||
      testCaseStatus === TestCaseStatus.Failed)
      ? taskLinkInfo
      : null;

  return (
    <Alert
      className="tw:min-w-0"
      data-testid="test-case-last-run-banner"
      rightContent={
        incidentLink ? (
          <Button color="secondary" href={incidentLink.path} size="sm">
            {t('label.view-entity', { entity: t('label.incident') })}
          </Button>
        ) : undefined
      }
      title={`${t('label.last-run')} ${statusLabel}`}
      variant={STATUS_VARIANTS[testCaseStatus]}>
      <div className="tw:flex tw:flex-col tw:gap-1">
        {description && <p className="tw:m-0 tw:break-words">{description}</p>}
        <span className="tw:text-xs tw:text-tertiary">
          {t('message.last-run-time', { time: formatDateTime(timestamp) })}
        </span>
      </div>
    </Alert>
  );
};

export default TestCaseLastRunBanner;
