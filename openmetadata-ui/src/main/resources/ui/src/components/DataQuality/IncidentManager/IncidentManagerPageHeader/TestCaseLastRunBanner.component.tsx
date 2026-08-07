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
  BadgeWithDot,
  Button,
  FeaturedIcon,
} from '@openmetadata/ui-core-components';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Clock,
  Minus,
  SlashCircle01,
  XClose,
} from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { TASK_ENTITY_TYPES } from '../../../../constants/Task.constant';
import {
  TestCaseResolutionStatusTypes,
  TestCaseStatus,
} from '../../../../generated/tests/testCase';
import {
  convertMillisecondsToHumanReadableFormat,
  customFormatDateTime,
} from '../../../../utils/date-time/DateTimeUtils';
import { getNameFromFQN } from '../../../../utils/FqnUtils';
import ExpandableBannerText from './ExpandableBannerText';
import type { TestCaseLastRunBannerProps } from './TestCaseLastRunBanner.interface';
import type { TaskLinkInfo } from './useTestCaseIncidentHeader';

const STATUS_CONFIG = {
  [TestCaseStatus.Aborted]: {
    containerClassName:
      'tw:border-utility-warning-200 tw:border-l-utility-warning-500',
    dividerClassName: 'tw:border-utility-warning-200',
    icon: SlashCircle01,
    iconColor: 'warning',
    incidentClassName: 'tw:bg-yellow-50',
    resultClassName: 'tw:text-warning-primary',
    statusClassName: 'tw:text-warning-primary',
    summaryClassName: 'tw:bg-yellow-50',
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
    summaryClassName: 'tw:bg-error-50',
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
    summaryClassName: 'tw:bg-brand-primary',
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
    summaryClassName: 'tw:bg-success-primary',
  },
} as const;

const INCIDENT_STATUS_CONFIG = {
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

const formatMetricValue = (value?: string) => {
  if (!value) {
    return undefined;
  }

  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue.toLocaleString() : value;
};

type StatusConfig = (typeof STATUS_CONFIG)[keyof typeof STATUS_CONFIG];
type IncidentStatusConfig =
  (typeof INCIDENT_STATUS_CONFIG)[keyof typeof INCIDENT_STATUS_CONFIG];
type TestResultValues = NonNullable<
  TestCaseLastRunBannerProps['testCaseResult']
>['testResultValue'];

const INCIDENT_RUN_STATUSES = new Set([
  TestCaseStatus.Aborted,
  TestCaseStatus.Failed,
]);
const METRIC_RUN_STATUSES = new Set([
  TestCaseStatus.Failed,
  TestCaseStatus.Success,
]);

const getRunDescription = (
  result: string | undefined,
  testCaseStatus: TestCaseStatus,
  queuedDescription: string
) =>
  result ||
  (testCaseStatus === TestCaseStatus.Queued ? queuedDescription : undefined);

const getIncidentLink = (
  taskLinkInfo: TaskLinkInfo | null,
  testCaseStatus: TestCaseStatus
) => (INCIDENT_RUN_STATUSES.has(testCaseStatus) ? taskLinkInfo : null);

const getMetricSummary = (
  parameterValues: TestCaseLastRunBannerProps['parameterValues'],
  testResultValue: TestResultValues,
  testCaseStatus: TestCaseStatus
) => {
  const metric = testResultValue?.[0];
  const resultValue = formatMetricValue(metric?.value);
  const matchingParameter = parameterValues?.find(
    ({ name }) => name === metric?.name
  );
  const expectedValue = formatMetricValue(
    metric?.predictedValue ?? matchingParameter?.value
  );

  return {
    expectedValue,
    resultValue,
    show:
      METRIC_RUN_STATUSES.has(testCaseStatus) &&
      resultValue !== undefined &&
      expectedValue !== undefined,
  };
};

const getIncidentMetadata = (
  incidentTitle: string | undefined,
  testCaseStatusData: TestCaseLastRunBannerProps['testCaseStatusData'],
  result: string | undefined,
  incidentLink: TaskLinkInfo | null
) => {
  const incidentStatus = testCaseStatusData?.testCaseResolutionStatusType;

  return {
    description: incidentTitle ?? testCaseStatusData?.failureSummary ?? result,
    id: incidentLink
      ? `INC–${incidentLink.label.replace(/^#/, '')}`
      : undefined,
    statusConfig: incidentStatus
      ? INCIDENT_STATUS_CONFIG[incidentStatus]
      : undefined,
  };
};

const getIncidentTitle = (
  incidentTask: NonNullable<TestCaseLastRunBannerProps['incidentTask']>,
  taskTypeLabel: string
) => {
  const entityFQN = incidentTask.about?.fullyQualifiedName;
  const entityName = entityFQN
    ? getNameFromFQN(entityFQN)
    : incidentTask.about?.name;
  const entityType = incidentTask.about?.type;

  return [taskTypeLabel, entityName, entityType ? `(${entityType})` : undefined]
    .filter(Boolean)
    .join(' ')
    .trim();
};

const RunDescription = ({ description }: { description?: string }) =>
  description ? (
    <ExpandableBannerText
      className="tw:!mt-1"
      dataTestId="test-case-run-description"
      text={description}
    />
  ) : null;

const getNextRunLabel = (
  nextRunTimestamp: number | undefined,
  inLabel: string,
  notScheduledLabel: string
) => {
  if (!nextRunTimestamp) {
    return notScheduledLabel;
  }

  const millisecondsUntilNextRun =
    Math.ceil((nextRunTimestamp - Date.now()) / 60_000) * 60_000;

  return `${inLabel} ${convertMillisecondsToHumanReadableFormat(
    millisecondsUntilNextRun,
    2
  )}`;
};

const NoRunBanner = ({
  nextRunTimestamp,
}: Pick<TestCaseLastRunBannerProps, 'nextRunTimestamp'>) => {
  const { t } = useTranslation();

  return (
    <div
      aria-live="polite"
      className="tw:min-w-0 tw:overflow-hidden tw:rounded-xl tw:border tw:border-l-4 tw:border-utility-gray-200 tw:border-l-utility-gray-400 tw:font-sans"
      data-testid="test-case-last-run-banner"
      role="status">
      <div
        className="tw:flex tw:flex-col tw:gap-4 tw:bg-secondary tw:px-5 tw:py-3.5 tw:lg:flex-row tw:lg:items-center"
        data-testid="test-case-last-run-summary">
        <div className="tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:gap-4">
          <FeaturedIcon
            outlined
            bgColor="white"
            color="gray"
            data-testid="test-case-last-run-icon"
            icon={Minus}
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
                className="tw:font-semibold tw:text-secondary"
                data-testid="test-case-last-run-status">
                {t('label.not-run-yet')}
              </span>
            </p>
            <p className="tw:mt-1 tw:mb-0 tw:break-words tw:text-xs tw:leading-normal tw:text-secondary">
              {t('message.test-case-not-run-yet')}
            </p>
          </div>
        </div>
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
      </div>
    </div>
  );
};

const ResultExpected = ({
  config,
  expectedValue,
  resultValue,
  show,
}: {
  config: StatusConfig;
  expectedValue?: string;
  resultValue?: string;
  show: boolean;
}) => {
  const { t } = useTranslation();

  if (!show) {
    return null;
  }

  return (
    <>
      <div
        className="tw:flex tw:min-w-32 tw:flex-col tw:items-end tw:justify-center tw:text-right"
        data-testid="test-case-result-expected">
        <span className="tw:text-xs tw:font-medium tw:tracking-wide tw:text-secondary tw:uppercase">
          {t('label.result')} / {t('label.expected')}
        </span>
        <span
          className="tw:mt-1 tw:whitespace-nowrap tw:text-xs tw:font-semibold"
          data-testid="test-case-result-value">
          <span className={config.resultClassName}>{resultValue}</span>
          <span className="tw:text-secondary"> / {expectedValue}</span>
        </span>
      </div>
      <span
        aria-hidden="true"
        className={`tw:border-l ${config.dividerClassName}`}
      />
    </>
  );
};

const LastRunTime = ({
  nextRunTimestamp,
  testCaseStatus,
  timestamp,
}: {
  nextRunTimestamp?: number;
  testCaseStatus: TestCaseStatus;
  timestamp?: number;
}) => {
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

const IncidentDetails = ({
  config,
  description,
  incidentId,
  incidentLink,
  statusConfig,
}: {
  config: StatusConfig;
  description?: string;
  incidentId?: string;
  incidentLink: TaskLinkInfo | null;
  statusConfig?: IncidentStatusConfig;
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!incidentLink) {
    return null;
  }

  return (
    <div
      className={`tw:flex tw:flex-wrap tw:items-center tw:gap-3 tw:border-t tw:px-5 tw:py-3 ${config.dividerClassName} ${config.incidentClassName}`}
      data-testid="test-case-last-run-incident">
      <AlertTriangle
        aria-hidden="true"
        className={config.statusClassName}
        size={20}
      />
      <span className="tw:shrink-0 tw:text-xs tw:font-semibold tw:text-primary">
        {incidentId}
      </span>
      {description && (
        <ExpandableBannerText
          className="tw:flex-1"
          dataTestId="test-case-incident-description"
          text={description}
        />
      )}
      {statusConfig && (
        <BadgeWithDot
          className="tw:bg-white"
          color={statusConfig.color}
          size="sm"
          type="pill-color">
          {t(statusConfig.label)}
        </BadgeWithDot>
      )}
      <Button
        className="tw:ml-auto"
        color="primary"
        data-testid="view-incident-button"
        iconTrailing={ArrowUpRight}
        size="xs"
        onClick={() => navigate(incidentLink.path)}>
        {t('label.view-entity', { entity: t('label.incident') })}
      </Button>
    </div>
  );
};

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
      data-testid="test-case-last-run-banner"
      role="status">
      <div
        className={`tw:flex tw:flex-col tw:gap-4 tw:px-5 tw:py-3.5 tw:lg:flex-row tw:lg:items-center ${config.summaryClassName}`}
        data-testid="test-case-last-run-summary">
        <div className="tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:gap-4">
          <FeaturedIcon
            outlined
            bgColor="white"
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

        <div className="tw:flex tw:shrink-0 tw:items-stretch tw:gap-6">
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
