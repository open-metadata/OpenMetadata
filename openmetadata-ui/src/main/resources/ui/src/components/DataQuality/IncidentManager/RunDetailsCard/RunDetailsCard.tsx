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
  Badge,
  BadgeWithDot,
  Box,
  Button,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import { Clock } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { isUndefined, maxBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import {
  TestCase,
  TestCaseErrorDetails,
  TestCaseStatus,
} from '../../../../generated/tests/testCase';
import { customFormatDateTime } from '../../../../utils/date-time/DateTimeUtils';
import { NO_VALUE } from '../../../Database/Profiler/TestSummary/TestSummary.constants';
import { STATUS_CONFIG } from '../IncidentManagerPageHeader/TestCaseLastRunBanner.constants';
import RunExecutionError from '../RunExecutionError/RunExecutionError';
import { useTestCaseStore } from '../useTestCase.store';
import {
  RunDetailsStatusStyle,
  RUN_DETAILS_STATUS_STYLE,
} from './RunDetailsCard.constants';
import {
  ComparisonBar,
  formatRunDuration,
  getRunDetails,
  getSelectedRun,
  isTimeoutError,
  RunResult,
} from './RunDetailsCard.utils';

interface RunDetailsCardProps {
  results: RunResult[];
  testCase: TestCase;
}

const RunDuration = ({
  duration,
  errorDetails,
}: {
  duration?: number;
  errorDetails?: TestCaseErrorDetails;
}) => {
  const { t } = useTranslation();
  // The slot stays for a run with no duration yet, a queued one, as in the mock.
  const text = isUndefined(duration) ? NO_VALUE : formatRunDuration(duration);

  return (
    <Box
      align="center"
      className="tw:ml-auto tw:text-tertiary"
      data-testid="run-details-duration"
      gap={1}>
      <Clock aria-hidden className="tw:size-3.5" />
      <Typography size="text-xs">
        {isTimeoutError(errorDetails?.errorType, errorDetails?.message)
          ? t('label.duration-with-timeout', { duration: text })
          : text}
      </Typography>
    </Box>
  );
};

const ComparisonBars = ({
  bars,
  barClassName,
  valueClassName,
}: {
  bars: ComparisonBar[];
  barClassName: string;
  valueClassName: string;
}) => {
  const { t } = useTranslation();

  return (
    <Box
      className="tw:border-t tw:border-secondary tw:pt-4"
      data-testid="run-details-comparison"
      direction="col"
      gap={3}>
      {bars.map(({ kind, value, width }) => (
        <Box direction="col" gap={1} key={kind}>
          <Box justify="between">
            <Typography color="secondary" size="text-xs">
              {t(`label.${kind}`)}
            </Typography>
            <Typography
              className={classNames(
                'tw:font-mono',
                kind === 'found' ? valueClassName : 'tw:text-secondary'
              )}
              data-testid={`run-details-${kind}-value`}
              size="text-xs">
              {value.toLocaleString()}
            </Typography>
          </Box>
          {/* Decorative: the numbers are already stated in text. The found
              value fills its track; the expected one marks its place on it. */}
          {kind === 'found' ? (
            <div
              aria-hidden
              className="tw:h-2.5 tw:overflow-hidden tw:rounded-full tw:bg-quaternary">
              <div
                className={classNames(
                  'tw:h-full tw:rounded-full',
                  barClassName
                )}
                style={{ width: `${width}%` }}
              />
            </div>
          ) : (
            <div
              aria-hidden
              className="tw:relative tw:h-2.5 tw:rounded-full tw:bg-quaternary">
              <div
                className="tw:absolute tw:-inset-y-0.5 tw:w-0.5 tw:-translate-x-1/2 tw:rounded-full tw:bg-fg-tertiary"
                data-testid="run-details-expected-marker"
                style={{ left: `${width}%` }}
              />
            </div>
          )}
        </Box>
      ))}
    </Box>
  );
};

const RunNote = ({ style }: { style: RunDetailsStatusStyle }) => {
  const { t } = useTranslation();

  if (!style.note) {
    return null;
  }

  const { icon: Icon, iconClassName, messageKey } = style.note;

  return (
    <Card
      className="tw:rounded-lg"
      color={style.color}
      data-testid="run-details-note">
      <Box align="start" className="tw:px-3 tw:py-2.5" gap={2}>
        <Icon
          aria-hidden
          className={classNames(
            'tw:mt-0.5 tw:size-4 tw:shrink-0',
            iconClassName
          )}
        />
        <Typography className="tw:text-secondary" size="text-sm">
          {t(messageKey)}
        </Typography>
      </Box>
    </Card>
  );
};

const RunDetailsCard = ({ results, testCase }: RunDetailsCardProps) => {
  const { t } = useTranslation();
  const selectedRunTimestamp = useTestCaseStore(
    (state) => state.selectedRunTimestamp
  );
  const setSelectedRunTimestamp = useTestCaseStore(
    (state) => state.setSelectedRunTimestamp
  );
  const result = getSelectedRun(results, selectedRunTimestamp);
  // A run picked on the chart that is not the newest says so, with the way back.
  const isOlderRunSelected =
    !isUndefined(result) &&
    result.timestamp !== maxBy(results, 'timestamp')?.timestamp;
  const status = result?.testCaseStatus;

  if (!result || !status) {
    return null;
  }

  const style = RUN_DETAILS_STATUS_STYLE[status];
  const errorDetails: TestCaseErrorDetails | undefined =
    'errorDetails' in result ? result.errorDetails : undefined;
  const duration = 'duration' in result ? result.duration : undefined;
  const { bars, differenceText, expectedText, foundText } = getRunDetails(
    testCase,
    result
  );
  const valueClassName = (text: string) =>
    text === NO_VALUE ? 'tw:text-quaternary' : style.valueClassName;

  const details = [
    {
      // A camel-case name may break anywhere; numbers below only between words.
      className: 'tw:break-words tw:font-medium tw:text-primary',
      weight: 'medium' as const,
      labelKey: 'label.test-definition-sentence',
      testId: 'run-details-definition',
      value: testCase.testDefinition?.name ?? NO_VALUE,
    },
    {
      className: 'tw:text-primary',
      labelKey: 'label.expected',
      testId: 'run-details-expected',
      value: expectedText,
    },
    {
      className: valueClassName(foundText),
      labelKey: 'label.found',
      testId: 'run-details-found',
      value: foundText,
    },
    {
      className: valueClassName(differenceText),
      labelKey: 'label.difference',
      testId: 'run-details-difference',
      value: differenceText,
    },
  ];

  return (
    <Card
      // The dark-mode border is translucent; keep the tint from showing through it.
      className="tw:bg-clip-padding"
      color={style.color}
      data-status={status}
      data-testid="run-details-card">
      <Box
        align="center"
        className="tw:border-b tw:border-inherit tw:px-4 tw:py-4"
        gap={3}
        wrap="wrap">
        {/* White on the tinted header, as in the mock; text, border and dot keep the status colour. */}
        <BadgeWithDot
          className="tw:bg-surface tw:font-bold"
          color={style.color}
          size="sm"
          type="pill-color">
          {t(STATUS_CONFIG[status].statusLabel)}
        </BadgeWithDot>
        {/* not-prose: Typography wraps a heading in .prose, whose h3 style
            (20px, margins) would otherwise outrank the size classes. */}
        <Typography
          as="h3"
          className="not-prose tw:m-0 tw:text-primary"
          size="text-sm"
          weight="semibold">
          {t('label.run-details')}
        </Typography>
        {/* The banner's format: the zone and the padded day differed between the two. */}
        <Typography
          className="tw:text-tertiary"
          data-testid="run-details-date"
          size="text-sm">
          {customFormatDateTime(result.timestamp, 'MMM d, yyyy, h:mm a')}
        </Typography>
        {isOlderRunSelected && (
          <Box align="center" gap={2}>
            <Badge
              color="gray"
              data-testid="run-details-selected"
              size="sm"
              type="pill-color">
              {t('label.selected-run')}
            </Badge>
            <Button
              color="link-color"
              data-testid="run-details-back-to-latest"
              size="sm"
              onPress={() => setSelectedRunTimestamp(undefined)}>
              {t('label.back-to-latest')}
            </Button>
          </Box>
        )}
        <RunDuration duration={duration} errorDetails={errorDetails} />
      </Box>
      <Box
        className="tw:@container tw:bg-surface tw:p-4"
        direction="col"
        gap={4}>
        {/* Four equal columns, as the mock sets them; two in a narrow card. */}
        <div className="tw:grid tw:grid-cols-2 tw:gap-x-3 tw:gap-y-3.5 tw:@lg:grid-cols-4">
          {details.map(({ className, labelKey, testId, value, weight }) => (
            <Box className="tw:min-w-0" direction="col" gap={1} key={labelKey}>
              <Typography
                className="tw:text-quaternary"
                size="text-xs"
                weight="medium">
                {t(labelKey)}
              </Typography>
              <Typography
                className={classNames('tw:font-mono tw:text-[13px]', className)}
                data-testid={testId}
                weight={weight ?? 'semibold'}>
                {value}
              </Typography>
            </Box>
          ))}
        </div>
        {bars.length > 0 && (
          <ComparisonBars
            barClassName={style.barClassName}
            bars={bars}
            valueClassName={style.valueClassName}
          />
        )}
        {status === TestCaseStatus.Aborted ? (
          <RunExecutionError
            errorDetails={errorDetails}
            result={result.result}
            testCase={testCase}
          />
        ) : (
          <RunNote style={style} />
        )}
      </Box>
    </Card>
  );
};

export default RunDetailsCard;
