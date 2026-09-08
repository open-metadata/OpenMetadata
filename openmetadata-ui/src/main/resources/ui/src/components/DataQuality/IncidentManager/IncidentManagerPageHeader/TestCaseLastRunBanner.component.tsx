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
import { TASK_ENTITY_TYPES } from '../../../../constants/Task.constant';
import IncidentDetails from './IncidentDetails.component';
import LastRunBannerLayout from './LastRunBannerLayout.component';
import LastRunTime from './LastRunTime.component';
import ResultExpected from './ResultExpected.component';
import RunDescription from './RunDescription.component';
import {
  NO_RUN_CONFIG,
  STATUS_CONFIG,
} from './TestCaseLastRunBanner.constants';
import type { TestCaseLastRunBannerProps } from './TestCaseLastRunBanner.interface';
import {
  getIncidentLink,
  getIncidentMetadata,
  getIncidentTitle,
  getMetricSummary,
  getNextRunLabel,
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
    return (
      <LastRunBannerLayout
        config={NO_RUN_CONFIG}
        description={
          <p className="tw:mt-1 tw:mb-0 tw:break-words tw:text-xs tw:leading-normal tw:text-secondary">
            {t('message.test-case-not-run-yet')}
          </p>
        }
        rightSection={
          <div className="tw:flex tw:min-w-36 tw:shrink-0 tw:flex-col tw:items-start tw:lg:items-end">
            <span
              aria-hidden="true"
              className="tw:text-sm tw:font-normal tw:text-primary">
              —
            </span>
            <span
              className="tw:mt-1 tw:whitespace-nowrap tw:text-xs tw:text-secondary"
              data-testid="test-case-next-run">
              {t('label.next')} ·{' '}
              {getNextRunLabel(
                nextRunTimestamp,
                t('label.in-lowercase'),
                t('label.not-scheduled')
              )}
            </span>
          </div>
        }
      />
    );
  }

  const { result, testResultValue, timestamp } = testCaseResult;
  const config = STATUS_CONFIG[testCaseStatus];
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
    <LastRunBannerLayout
      config={config}
      description={<RunDescription description={description} />}
      footer={
        <IncidentDetails
          config={config}
          description={incidentMetadata.description}
          incidentId={incidentMetadata.id}
          incidentLink={incidentLink}
          statusConfig={incidentMetadata.statusConfig}
        />
      }
      rightSection={
        <div
          className="tw:flex tw:shrink-0 tw:items-stretch tw:justify-end tw:gap-6 tw:lg:w-80"
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
      }
    />
  );
};

export default TestCaseLastRunBanner;
