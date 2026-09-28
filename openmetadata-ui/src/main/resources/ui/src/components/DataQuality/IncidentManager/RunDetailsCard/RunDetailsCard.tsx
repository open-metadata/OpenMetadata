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
  Box,
  Typography,
} from '@openmetadata/ui-core-components';
import { Clock } from '@untitledui/icons';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { useTranslation } from 'react-i18next';
import {
  TestCase,
  TestCaseErrorDetails,
  TestCaseStatus,
} from '../../../../generated/tests/testCase';
import { useTestCaseStore } from '../../../../pages/IncidentManager/IncidentManagerDetailPage/useTestCase.store';
import { formatDateTime } from '../../../../utils/date-time/DateTimeUtils';
import { STATUS_CONFIG } from '../IncidentManagerPageHeader/TestCaseLastRunBanner.constants';
import RunExecutionError from '../RunExecutionError/RunExecutionError';
import {
  NO_VALUE,
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
  errorType,
}: {
  duration: number;
  errorType?: string;
}) => {
  const { t } = useTranslation();
  const text = formatRunDuration(duration);

  return (
    <Box
      align="center"
      className="tw:ml-auto tw:text-quaternary"
      data-testid="run-details-duration"
      gap={1}>
      <Clock aria-hidden className="tw:size-3.5" />
      <Typography as="span" size="text-xs">
        {isTimeoutError(errorType)
          ? t('label.duration-with-timeout', { duration: text })
          : text}
      </Typography>
    </Box>
  );
};

const ComparisonBars = ({
  bars,
  barClassName,
}: {
  bars: ComparisonBar[];
  barClassName: string;
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
            <Typography className="tw:text-tertiary" size="text-xs">
              {t(`label.${kind}`)}
            </Typography>
            <Typography
              className="tw:font-mono tw:text-secondary"
              size="text-xs">
              {value.toLocaleString()}
            </Typography>
          </Box>
          {/* Decorative: the numbers are already stated in text. */}
          <div
            aria-hidden
            className="tw:h-2.5 tw:overflow-hidden tw:rounded-full tw:bg-quaternary">
            <div
              className={classNames(
                'tw:h-full tw:rounded-full',
                kind === 'found' ? barClassName : 'tw:bg-fg-quaternary'
              )}
              style={{ width: `${width}%` }}
            />
          </div>
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
    <Box
      align="start"
      className={classNames(
        'tw:rounded-lg tw:border tw:px-3 tw:py-2.5',
        style.headerClassName,
        style.borderClassName
      )}
      data-testid="run-details-note"
      gap={2}>
      <Icon
        aria-hidden
        className={classNames('tw:mt-0.5 tw:size-4 tw:shrink-0', iconClassName)}
      />
      <Typography className="tw:text-secondary" size="text-sm">
        {t(messageKey)}
      </Typography>
    </Box>
  );
};

const RunDetailsCard = ({ results, testCase }: RunDetailsCardProps) => {
  const { t } = useTranslation();
  const selectedRunTimestamp = useTestCaseStore(
    (state) => state.selectedRunTimestamp
  );
  const result = getSelectedRun(results, selectedRunTimestamp);
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
      className: 'tw:font-medium tw:text-primary',
      labelKey: 'label.test-definition',
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
    <section
      aria-labelledby="run-details-title"
      className={classNames(
        'tw:overflow-hidden tw:rounded-xl tw:border',
        style.borderClassName
      )}
      data-status={status}
      data-testid="run-details-card">
      <Box
        align="center"
        className={classNames(
          'tw:border-b tw:px-4 tw:py-3',
          style.headerClassName,
          style.borderClassName
        )}
        gap={3}
        wrap="wrap">
        <BadgeWithDot color={style.badgeColor} size="sm" type="pill-color">
          {t(STATUS_CONFIG[status].statusLabel)}
        </BadgeWithDot>
        <h3
          className="tw:m-0 tw:text-sm tw:font-semibold tw:text-primary"
          id="run-details-title">
          {t('label.run-details')}
        </h3>
        <Typography className="tw:text-quaternary" size="text-sm">
          {formatDateTime(result.timestamp)}
        </Typography>
        {!isUndefined(duration) && (
          <RunDuration
            duration={duration}
            errorType={errorDetails?.errorType}
          />
        )}
      </Box>
      <Box className="tw:bg-surface tw:p-4" direction="col" gap={4}>
        <dl className="tw:m-0 tw:grid tw:grid-cols-2 tw:gap-x-8 tw:gap-y-3 tw:md:grid-cols-[max-content_repeat(3,minmax(0,1fr))]">
          {details.map(({ className, labelKey, testId, value }) => (
            <div className="tw:min-w-0" key={labelKey}>
              <dt className="tw:text-xs tw:text-quaternary">{t(labelKey)}</dt>
              <dd
                className={classNames(
                  'tw:m-0 tw:mt-1 tw:break-words tw:font-mono tw:text-sm',
                  className
                )}
                data-testid={testId}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
        {bars.length > 0 && (
          <ComparisonBars barClassName={style.barClassName} bars={bars} />
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
    </section>
  );
};

export default RunDetailsCard;
