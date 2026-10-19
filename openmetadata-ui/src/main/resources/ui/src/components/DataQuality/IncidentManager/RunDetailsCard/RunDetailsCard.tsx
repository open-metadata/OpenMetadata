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
  ProgressBarBase,
  Typography,
} from '@openmetadata/ui-core-components';
import { Clock } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import type { TFunction } from 'i18next';
import { isUndefined, maxBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import {
  TestCase,
  TestCaseErrorDetails,
  TestCaseEvaluationScope,
  TestCaseStatus,
} from '../../../../generated/tests/testCase';
import { formatDateTime } from '../../../../utils/date-time/DateTimeUtils';
import {
  getRunScopeBadges,
  getRunThresholdData,
  RunThresholdData,
  ThresholdNoun,
  ThresholdSamplingKind,
  ThresholdTestSemantic,
  THRESHOLD_COUNT_NOUN_KEYS,
} from '../../../../utils/observability/data-quality/testCaseThreshold.utils';
import { formatThresholdAmount } from '../../../../utils/observability/data-quality/testCaseThresholdSentence.utils';
import { NO_VALUE } from '../../../Database/Profiler/TestSummary/TestSummary.constants';
import { formatNumber } from '../../../Database/Profiler/TestSummary/TestSummary.utils';
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

const quietWhenUnknown = (text: string, className: string) =>
  text === NO_VALUE ? 'tw:text-quaternary' : className;

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
          {/* Decorative: the numbers are already stated in text. */}
          <Box
            aria-hidden
            data-testid={`run-details-${kind}-bar`}
            direction="col">
            <ProgressBarBase
              className="tw:h-2.5 tw:rounded-full"
              progressClassName={classNames(
                'tw:rounded-full',
                kind === 'found' ? barClassName : 'tw:bg-fg-quaternary'
              )}
              value={width}
            />
          </Box>
        </Box>
      ))}
    </Box>
  );
};

interface DetailCell {
  className: string;
  labelKey: string;
  testId: string;
  value: string;
  weight?: 'medium' | 'semibold';
}

const DetailCells = ({ cells }: { cells: DetailCell[] }) => {
  const { t } = useTranslation();

  return (
    <>
      {cells.map(({ className, labelKey, testId, value, weight }) => (
        <Box className="tw:min-w-0" direction="col" gap={1} key={labelKey}>
          <Typography
            className="tw:text-quaternary"
            size="text-xs"
            weight="medium">
            {t(labelKey)}
          </Typography>
          <Typography
            className={classNames('tw:font-mono', className)}
            data-testid={testId}
            size="text-xs"
            weight={weight ?? 'semibold'}>
            {value}
          </Typography>
        </Box>
      ))}
    </>
  );
};

/**
 * Which rows the run read, when that was not the whole table. Read from the
 * run's own record, so an older run keeps the scope it actually had.
 */
const RunScopeBadges = ({ scope }: { scope?: TestCaseEvaluationScope }) => {
  const { t } = useTranslation();
  const badges = getRunScopeBadges(scope);

  if (!badges) {
    return null;
  }

  const { sample, isPartitioned, partitionColumn } = badges;
  let sampleLabel = t('label.sampled');
  if (sample && !isUndefined(sample.value)) {
    sampleLabel =
      sample.kind === ThresholdSamplingKind.StaticRows
        ? t('label.row-sample-of', { value: formatNumber(sample.value) })
        : t('label.percentage-sample-of', { value: sample.value });
  }

  return (
    <Box align="center" gap={2}>
      {sample && (
        <Badge
          color="blue"
          data-testid="run-details-sampled-badge"
          size="sm"
          type="pill-color">
          {sampleLabel}
        </Badge>
      )}
      {isPartitioned && (
        <Badge
          color="blue"
          data-testid="run-details-partitioned-badge"
          size="sm"
          type="pill-color">
          {partitionColumn
            ? t('label.partitioned-on', { column: partitionColumn })
            : t('label.partitioned')}
        </Badge>
      )}
    </Box>
  );
};

const PRIMARY_VALUE = 'tw:text-primary';

const knownOrQuiet = (
  labelKey: string,
  testId: string,
  value: string | undefined,
  className = PRIMARY_VALUE
): DetailCell => ({
  className: quietWhenUnknown(value ?? NO_VALUE, className),
  labelKey,
  testId,
  value: value ?? NO_VALUE,
});

/** "1.20% (120 row(s))", led by the threshold's own unit so the two read alike. */
const formatFailed = (
  { isPercentage, failedRows, failedPercentage }: RunThresholdData,
  countOf: (value: number) => string,
  t: TFunction
): string | undefined => {
  const share = isUndefined(failedPercentage)
    ? undefined
    : t('label.percentage-value', { value: failedPercentage.toFixed(2) });
  const count = isUndefined(failedRows) ? undefined : countOf(failedRows);
  const [lead, aside] = isPercentage ? [share, count] : [count, share];

  return lead && aside ? `${lead} (${aside})` : lead ?? aside;
};

const getRowCountableCells = (
  data: RunThresholdData,
  valueClassName: string,
  t: TFunction
): DetailCell[] => {
  const { evaluatedRows, populationNoun = ThresholdNoun.Rows } = data;
  const countOf = (value: number) =>
    t('message.threshold-amount-absolute', {
      value: formatNumber(value),
      noun: t(THRESHOLD_COUNT_NOUN_KEYS[populationNoun]),
    });

  return [
    knownOrQuiet(
      'label.failed',
      'run-details-failed',
      formatFailed(data, countOf, t),
      valueClassName
    ),
    knownOrQuiet(
      'label.evaluated',
      'run-details-evaluated',
      isUndefined(evaluatedRows) ? undefined : countOf(evaluatedRows)
    ),
  ];
};

const getStatisticalCells = ({
  threshold,
  configuredRange,
  effectiveRange,
}: RunThresholdData): DetailCell[] => {
  const cells = [
    knownOrQuiet(
      'label.configured-range',
      'run-details-configured-range',
      configuredRange
    ),
  ];
  // Without a tolerance the effective range is the configured one.
  if (threshold > 0) {
    cells.push(
      knownOrQuiet(
        'label.effective-range',
        'run-details-effective-range',
        effectiveRange
      )
    );
  }

  return cells;
};

/**
 * The threshold the run was judged by, beside what it measured against it:
 * the failing share and the population for a row tolerance, the configured
 * and widened bound for a deviation. Nothing for a test that reads no
 * tolerance, or a run that computed no verdict.
 */
const RunThreshold = ({
  testCase,
  result,
  valueClassName,
}: {
  testCase: TestCase;
  result: RunResult;
  valueClassName: string;
}) => {
  const { t } = useTranslation();
  const data = getRunThresholdData(testCase, result);

  if (!data) {
    return null;
  }

  const { semantic, threshold, isPercentage, noun } = data;
  const cells: DetailCell[] = [
    {
      className: PRIMARY_VALUE,
      labelKey: 'label.threshold',
      testId: 'run-details-threshold',
      value:
        threshold > 0
          ? formatThresholdAmount(threshold, isPercentage, noun, t)
          : t('label.no-tolerance'),
    },
    ...(semantic === ThresholdTestSemantic.RowCountable
      ? getRowCountableCells(data, valueClassName, t)
      : getStatisticalCells(data)),
  ];

  return (
    <div
      className="tw:grid tw:grid-cols-2 tw:gap-x-3 tw:gap-y-3.5 tw:border-t tw:border-secondary tw:pt-4 tw:@lg:grid-cols-4"
      data-testid="run-details-threshold-section">
      <DetailCells cells={cells} />
    </div>
  );
};

/** A sampled verdict says so in words, not only in the header's badge. */
const RunSampleNote = ({ scope }: { scope?: TestCaseEvaluationScope }) => {
  const { t } = useTranslation();

  return scope?.sampled ? (
    <Typography
      className="tw:text-tertiary"
      data-testid="run-details-sample-note"
      size="text-xs">
      {t('message.run-evaluated-on-sample')}
    </Typography>
  ) : null;
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
    quietWhenUnknown(text, style.valueClassName);

  const details: DetailCell[] = [
    {
      // A camel-case name may break anywhere; numbers below only between words.
      className: 'tw:break-words tw:font-medium tw:text-primary',
      weight: 'medium',
      labelKey: 'label.test-definition-sentence',
      testId: 'run-details-definition',
      value: testCase.testDefinition?.name ?? NO_VALUE,
    },
    {
      className: quietWhenUnknown(expectedText, PRIMARY_VALUE),
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
        <Typography
          className="tw:text-tertiary"
          data-testid="run-details-date"
          size="text-sm">
          {formatDateTime(result.timestamp)}
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
        <RunScopeBadges scope={result.evaluationScope} />
        <RunDuration duration={duration} errorDetails={errorDetails} />
      </Box>
      <Box
        className="tw:@container tw:bg-surface tw:p-4"
        direction="col"
        gap={4}>
        {/* Four columns, as the mock sets them, but the definition's never
            narrower than its name, or a camel-case name breaks mid-word.
            Two in a narrow card. */}
        <div className="tw:grid tw:grid-cols-2 tw:gap-x-3 tw:gap-y-3.5 tw:@lg:grid-cols-[minmax(max-content,1fr)_repeat(3,minmax(0,1fr))]">
          <DetailCells cells={details} />
        </div>
        <RunThreshold
          result={result}
          testCase={testCase}
          valueClassName={style.valueClassName}
        />
        <RunSampleNote scope={result.evaluationScope} />
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
