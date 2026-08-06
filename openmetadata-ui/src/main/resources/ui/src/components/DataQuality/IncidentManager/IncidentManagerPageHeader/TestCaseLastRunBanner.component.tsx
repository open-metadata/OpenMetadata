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
import {
  TestCaseResolutionStatusTypes,
  TestCaseStatus,
} from '../../../../generated/tests/testCase';
import { customFormatDateTime } from '../../../../utils/date-time/DateTimeUtils';
import type { TestCaseLastRunBannerProps } from './TestCaseLastRunBanner.interface';

const STATUS_CONFIG = {
  [TestCaseStatus.Aborted]: {
    containerClassName:
      'tw:border-utility-warning-200 tw:border-l-utility-warning-500 tw:bg-warning-primary',
    dividerClassName: 'tw:border-utility-warning-200',
    icon: SlashCircle01,
    iconColor: 'warning',
    resultClassName: 'tw:text-warning-primary',
    statusClassName: 'tw:text-warning-primary',
  },
  [TestCaseStatus.Failed]: {
    containerClassName:
      'tw:border-utility-error-200 tw:border-l-utility-error-500 tw:bg-error-primary',
    dividerClassName: 'tw:border-utility-error-200',
    icon: XClose,
    iconColor: 'error',
    resultClassName: 'tw:text-error-primary',
    statusClassName: 'tw:text-error-primary',
  },
  [TestCaseStatus.Queued]: {
    containerClassName:
      'tw:border-utility-brand-200 tw:border-l-utility-brand-500 tw:bg-brand-primary',
    dividerClassName: 'tw:border-utility-brand-200',
    icon: Clock,
    iconColor: 'brand',
    resultClassName: 'tw:text-brand-primary',
    statusClassName: 'tw:text-brand-primary',
  },
  [TestCaseStatus.Success]: {
    containerClassName:
      'tw:border-utility-success-200 tw:border-l-utility-success-500 tw:bg-success-primary',
    dividerClassName: 'tw:border-utility-success-200',
    icon: Check,
    iconColor: 'success',
    resultClassName: 'tw:text-success-primary',
    statusClassName: 'tw:text-success-primary',
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

const TestCaseLastRunBanner = ({
  incidentTask,
  parameterValues,
  testCaseResult,
  testCaseStatusData,
  taskLinkInfo,
}: TestCaseLastRunBannerProps) => {
  const { t } = useTranslation();

  if (!testCaseResult?.testCaseStatus) {
    return (
      <div
        aria-live="polite"
        className="tw:min-w-0 tw:overflow-hidden tw:rounded-xl tw:border tw:border-l-4 tw:border-utility-gray-200 tw:border-l-utility-gray-400 tw:bg-secondary"
        data-testid="test-case-last-run-banner"
        role="status">
        <div className="tw:flex tw:flex-col tw:gap-4 tw:px-5 tw:py-4 tw:lg:flex-row tw:lg:items-center">
          <div className="tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:gap-4">
            <FeaturedIcon
              outlined
              bgColor="white"
              color="gray"
              data-testid="test-case-last-run-icon"
              icon={Minus}
              radius="xl"
              shape="square"
              size="lg"
            />
            <div className="tw:min-w-0 tw:flex-1">
              <p className="tw:m-0 tw:text-lg tw:leading-snug">
                <span
                  className="tw:font-medium tw:text-primary"
                  data-testid="test-case-last-run-prefix">
                  {t('label.last-run')}
                </span>{' '}
                <span
                  className="tw:font-semibold tw:text-secondary"
                  data-testid="test-case-last-run-status">
                  {t('label.not-run-yet')}
                </span>
              </p>
              <p className="tw:mt-1 tw:mb-0 tw:break-words tw:text-sm tw:leading-normal tw:text-secondary">
                {t('message.test-case-not-run-yet')}
              </p>
            </div>
          </div>
          <div className="tw:flex tw:min-w-36 tw:shrink-0 tw:flex-col tw:items-start tw:lg:items-end">
            <span
              aria-hidden="true"
              className="tw:text-sm tw:font-semibold tw:text-primary">
              —
            </span>
            <span
              className="tw:mt-1 tw:whitespace-nowrap tw:text-xs tw:text-secondary"
              data-testid="test-case-next-run">
              {t('label.next')} · {t('label.not-scheduled')}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const { result, testCaseStatus, testResultValue, timestamp } = testCaseResult;
  const config = STATUS_CONFIG[testCaseStatus];
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
  const resultValue = formatMetricValue(testResultValue?.[0]?.value);
  const expectedValue = formatMetricValue(
    testResultValue?.[0]?.predictedValue ?? parameterValues?.[0]?.value
  );
  const showResultExpected =
    (testCaseStatus === TestCaseStatus.Failed ||
      testCaseStatus === TestCaseStatus.Success) &&
    resultValue !== undefined &&
    expectedValue !== undefined;
  const incidentStatus = testCaseStatusData?.testCaseResolutionStatusType;
  const incidentStatusConfig = incidentStatus
    ? INCIDENT_STATUS_CONFIG[incidentStatus]
    : undefined;
  const incidentDescription =
    incidentTask?.description ?? testCaseStatusData?.failureSummary ?? result;
  const incidentId = incidentLink
    ? `INC–${incidentLink.label.replace(/^#/, '')}`
    : undefined;

  return (
    <div
      aria-live="polite"
      className={`tw:min-w-0 tw:overflow-hidden tw:rounded-xl tw:border tw:border-l-4 ${config.containerClassName}`}
      data-testid="test-case-last-run-banner"
      role="status">
      <div className="tw:flex tw:flex-col tw:gap-4 tw:px-5 tw:py-4 tw:lg:flex-row tw:lg:items-center">
        <div className="tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:gap-4">
          <FeaturedIcon
            outlined
            bgColor="white"
            color={config.iconColor}
            data-testid="test-case-last-run-icon"
            icon={config.icon}
            radius="xl"
            shape="square"
            size="lg"
          />
          <div className="tw:min-w-0 tw:flex-1">
            <p className="tw:m-0 tw:text-lg tw:leading-snug">
              <span
                className="tw:font-medium tw:text-primary"
                data-testid="test-case-last-run-prefix">
                {t('label.last-run')}
              </span>{' '}
              <span
                className={`tw:font-semibold ${config.statusClassName}`}
                data-testid="test-case-last-run-status">
                {statusLabel}
              </span>
            </p>
            {description && (
              <p className="tw:mt-1 tw:mb-0 tw:break-words tw:text-sm tw:leading-normal tw:text-secondary">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="tw:flex tw:shrink-0 tw:items-stretch tw:gap-6">
          {showResultExpected && (
            <div
              className="tw:flex tw:min-w-32 tw:flex-col tw:items-end tw:justify-center tw:text-right"
              data-testid="test-case-result-expected">
              <span className="tw:text-xs tw:font-medium tw:tracking-wide tw:text-tertiary tw:uppercase">
                {t('label.result')} / {t('label.expected')}
              </span>
              <span
                className="tw:mt-1 tw:whitespace-nowrap tw:text-md tw:font-semibold"
                data-testid="test-case-result-value">
                <span className={config.resultClassName}>{resultValue}</span>
                <span className="tw:text-tertiary"> / {expectedValue}</span>
              </span>
            </div>
          )}
          {showResultExpected && (
            <span
              aria-hidden="true"
              className={`tw:border-l ${config.dividerClassName}`}
            />
          )}
          <div className="tw:flex tw:min-w-36 tw:flex-col tw:items-end tw:justify-center tw:text-right">
            <span
              className="tw:whitespace-nowrap tw:text-sm tw:font-semibold tw:text-primary"
              data-testid="test-case-last-run-time">
              {customFormatDateTime(timestamp, 'MMM d, yyyy, h:mm a')}
            </span>
            <span
              className="tw:mt-1 tw:whitespace-nowrap tw:text-xs tw:text-secondary"
              data-testid="test-case-next-run">
              {t('label.next')} ·{' '}
              {testCaseStatus === TestCaseStatus.Queued
                ? t('label.running-now')
                : t('label.not-scheduled')}
            </span>
          </div>
        </div>
      </div>

      {incidentLink && (
        <div
          className={`tw:flex tw:flex-wrap tw:items-center tw:gap-3 tw:border-t tw:px-5 tw:py-3 ${config.dividerClassName}`}
          data-testid="test-case-last-run-incident">
          <AlertTriangle
            aria-hidden="true"
            className={config.statusClassName}
            size={20}
          />
          <span className="tw:shrink-0 tw:text-sm tw:font-semibold tw:text-primary">
            {incidentId}
          </span>
          {incidentDescription && (
            <span className="tw:min-w-0 tw:text-sm tw:text-secondary">
              {incidentDescription}
            </span>
          )}
          {incidentStatusConfig && (
            <BadgeWithDot
              color={incidentStatusConfig.color}
              size="sm"
              type="pill-color">
              {t(incidentStatusConfig.label)}
            </BadgeWithDot>
          )}
          <Button
            className="tw:ml-auto"
            color="primary"
            data-testid="view-incident-button"
            href={incidentLink.path}
            iconTrailing={ArrowUpRight}
            size="sm">
            {t('label.view-entity', { entity: t('label.incident') })}
          </Button>
        </div>
      )}
    </div>
  );
};

export default TestCaseLastRunBanner;
