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

import { FeaturedIcon } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { TASK_ENTITY_TYPES } from '../../../../constants/Task.constant';
import { TestCaseStatus } from '../../../../generated/tests/testCase';
import IncidentDetails from './IncidentDetails.component';
import LastRunTime from './LastRunTime.component';
import NoRunBanner from './NoRunBanner.component';
import ResultExpected from './ResultExpected.component';
import RunDescription from './RunDescription.component';
import { STATUS_CONFIG } from './TestCaseLastRunBanner.constants';
import type { TestCaseLastRunBannerProps } from './TestCaseLastRunBanner.interface';
import {
  getIncidentLink,
  getIncidentMetadata,
  getIncidentTitle,
  getMetricSummary,
  getRunDescription,
} from './TestCaseLastRunBanner.utils';

const TestCaseLastRunBanner = ({
  incidentTask,
  nextRunTimestamp,
  parameterValues,
  testCaseResult,
  testCaseStatus: authoritativeTestCaseStatus,
  testCaseStatusData,
  taskLinkInfo,
}: TestCaseLastRunBannerProps) => {
  const { t } = useTranslation();
  const testCaseStatus =
    authoritativeTestCaseStatus ?? testCaseResult?.testCaseStatus;

  if (!testCaseResult || !testCaseStatus) {
    return <NoRunBanner nextRunTimestamp={nextRunTimestamp} />;
  }

  const { result, testResultValue, timestamp } = testCaseResult;
  const config = STATUS_CONFIG[testCaseStatus];
  const statusLabel = {
    [TestCaseStatus.Aborted]: t('label.aborted'),
    [TestCaseStatus.Failed]: t('label.failed'),
    [TestCaseStatus.Queued]: t('label.queued'),
    [TestCaseStatus.Success]: t('label.success'),
  }[testCaseStatus];
  const description = getRunDescription(
    result,
    testCaseStatus,
    t('message.test-case-run-queued')
  );
  const incidentLink = getIncidentLink(taskLinkInfo, testCaseStatus);
  const metricSummary = getMetricSummary(
    parameterValues,
    testResultValue,
    testCaseStatus
  );
  const incidentTitle = incidentTask
    ? getIncidentTitle(
        incidentTask,
        t(TASK_ENTITY_TYPES[incidentTask.type] ?? 'label.task')
      )
    : undefined;
  const incidentMetadata = getIncidentMetadata(
    incidentTitle,
    testCaseStatusData,
    result,
    incidentLink
  );

  return (
    <div
      aria-live="polite"
      className={`tw:min-w-0 tw:overflow-hidden tw:rounded-xl tw:border tw:border-l-4 tw:font-sans ${config.containerClassName}`}
      data-testid={config.testId}
      role="status">
      <div
        className={`tw:flex tw:flex-col tw:gap-4 tw:px-5 tw:py-3.5 tw:lg:flex-row tw:lg:items-start ${config.summaryClassName}`}
        data-testid="test-case-last-run-summary">
        <div className="tw:flex tw:min-w-0 tw:flex-1 tw:items-start tw:gap-4">
          <FeaturedIcon
            outlined
            bgColor="white"
            className="tw:self-start"
            color={config.iconColor}
            data-testid="test-case-last-run-icon"
            icon={config.icon}
            radius="lg"
            shape="square"
            size="sm"
          />
          <div className="tw:min-w-0 tw:flex-1">
            <p className="tw:m-0 tw:text-sm tw:leading-snug">
              <span
                className="tw:text-sm tw:font-medium tw:text-primary"
                data-testid="test-case-last-run-prefix">
                {t('label.last-run')}
              </span>{' '}
              <span
                className={`tw:font-semibold ${config.statusClassName}`}
                data-testid="test-case-last-run-status">
                {statusLabel}
              </span>
            </p>
            <RunDescription description={description} />
          </div>
        </div>

        <div
          className="tw:flex tw:shrink-0 tw:items-stretch tw:gap-6 tw:lg:w-80"
          data-testid="test-case-last-run-right-section">
          <ResultExpected
            config={config}
            expectedValue={metricSummary.expectedValue}
            resultValue={metricSummary.resultValue}
            show={metricSummary.show}
          />
          <LastRunTime
            nextRunTimestamp={nextRunTimestamp}
            testCaseStatus={testCaseStatus}
            timestamp={timestamp}
          />
        </div>
      </div>

      <IncidentDetails
        config={config}
        description={incidentMetadata.description}
        incidentId={incidentMetadata.id}
        incidentLink={incidentLink}
        statusConfig={incidentMetadata.statusConfig}
      />
    </div>
  );
};

export default TestCaseLastRunBanner;
