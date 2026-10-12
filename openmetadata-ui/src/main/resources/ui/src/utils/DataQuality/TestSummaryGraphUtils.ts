/*
 *  Copyright 2024 Collate.
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
import type { ChartStatus } from '@openmetadata/ui-core-components/charts';
import isEmpty from 'lodash/isEmpty';
import isNumber from 'lodash/isNumber';
import isUndefined from 'lodash/isUndefined';
import omitBy from 'lodash/omitBy';
import round from 'lodash/round';
import { TestCaseChartDataType } from '../../components/Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
import { COLORS } from '../../constants/profiler.constant';
import { Task } from '../../generated/entity/tasks/task';
import {
  TestCaseParameterValue,
  TestCaseResult,
  TestCaseStatus,
} from '../../generated/tests/testCase';
import { axisTickFormatter } from '../ChartUtils';
import { getRandomHexColor } from '../DataInsightPureUtils';
import { convertSecondsToHumanReadableFormat } from '../date-time/DateTimeUtils';
import { MIN_ROWS_PER_DIMENSION_PARAM } from '../observability/data-quality/testCaseThreshold.utils';
import {
  getTaskDetailPathFromTask,
  getTaskDisplayId,
} from '../TaskNavigationUtils';

const EXCLUDED_CHART_FIELDS = new Set(['schemaTable1', 'schemaTable2']);

export type PrepareChartDataType = {
  testCaseParameterValue: TestCaseParameterValue[];
  testCaseResults: TestCaseResult[];
  tasks?: Task[];
};

/**
 * Converts an incident task into the fields used by the tooltip, keeping the
 * display component independent of the incident API.
 */
export const getIncidentDetails = (task?: Task) => {
  if (!task) {
    return {};
  }

  return {
    incidentDisplayId: getTaskDisplayId(task.taskId),
    incidentPath: getTaskDetailPathFromTask(task),
    incidentAssignees: task.assignees,
  };
};

/**
 * Parameters on the `*ToEqual` tests that state the one value a run must hit.
 * Any other numeric parameter that is not a min or max bound - such as
 * rangeInterval, a time window, or radius, a distance - says nothing about
 * where the charted value should sit, so it never becomes the line.
 */
const EXPECTED_VALUE_PARAMETERS = new Set([
  'value',
  'columnCount',
  'missingCountValue',
]);
const MIN_BOUND_PARAMETER = /^min($|[A-Z])/;
const MAX_BOUND_PARAMETER = /^max($|[A-Z])/;
// Named like a bound but not one: `minRowsPerDimension` decides which
// dimension groups the roll-up counts, not where the charted value may sit.
const NOT_BOUND_PARAMETERS = new Set([MIN_ROWS_PER_DIMENSION_PARAM]);
const isBound = (pattern: RegExp, name: string) =>
  pattern.test(name) && !NOT_BOUND_PARAMETERS.has(name);

export const toFiniteNumber = (value?: string) => {
  // Number('') is 0, so a cleared parameter would otherwise draw a line at 0.
  if (isEmpty(value?.trim())) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
};

export interface ParameterBounds {
  expected?: number;
  min?: number;
  max?: number;
  threshold?: number;
}

/**
 * The numeric bounds a test's parameters state, read by name so a parameter
 * that is not a bound never passes for one. The chart's expectation line and
 * the card's caption both read the test through this.
 */
export const getParameterBounds = (
  testCaseParameterValue: TestCaseParameterValue[]
): ParameterBounds => {
  const valuesOf = (matches: (name: string) => boolean) =>
    testCaseParameterValue.reduce<number[]>((values, parameter) => {
      const value = toFiniteNumber(parameter.value);

      if (matches(parameter.name ?? '') && !isUndefined(value)) {
        values.push(value);
      }

      return values;
    }, []);

  const maxBounds = valuesOf((name) => isBound(MAX_BOUND_PARAMETER, name));
  const minBounds = valuesOf((name) => isBound(MIN_BOUND_PARAMETER, name));
  const [threshold] = valuesOf((name) => name === 'threshold');

  return {
    expected: valuesOf((name) => EXPECTED_VALUE_PARAMETERS.has(name))[0],
    max: isEmpty(maxBounds) ? undefined : Math.max(...maxBounds),
    min: isEmpty(minBounds) ? undefined : Math.min(...minBounds),
    threshold,
  };
};

const FALLBACK_SERIES_NAME = 'value';

export const prepareChartData = ({
  testCaseParameterValue,
  testCaseResults,
  tasks = [],
}: PrepareChartDataType) => {
  // Read by name: a test's parameters can also hold a threshold or an expected
  // value, and neither bounds a range.
  const { min: minParameter, max: maxParameter } = getParameterBounds(
    testCaseParameterValue
  );
  const dataPoints: TestCaseChartDataType['data'] = [];
  let showAILearningBanner = false;
  testCaseResults.forEach((result) => {
    const values = result.testResultValue?.reduce((acc, curr) => {
      if (EXCLUDED_CHART_FIELDS.has(curr.name ?? '')) {
        return acc;
      }
      const value = round(Number.parseFloat(curr.value ?? ''), 2) || 0;

      return {
        ...acc,
        [curr.name ?? FALLBACK_SERIES_NAME]: value,
      };
    }, {});
    const metric = {
      passedRows: result.passedRows,
      failedRows: result.failedRows,
      passedRowsPercentage: isUndefined(result.passedRowsPercentage)
        ? undefined
        : `${round(result.passedRowsPercentage, 2)}%`,
      failedRowsPercentage: isUndefined(result.failedRowsPercentage)
        ? undefined
        : `${round(result.failedRowsPercentage, 2)}%`,
    };
    // A dynamic assertion's learned bounds, when the run has them, win over the
    // range the parameters state.
    const y1 = result?.minBound ?? minParameter;
    const y2 = result?.maxBound ?? maxParameter;

    // if one of y1 or y2 is undefined, will not show the bound area
    const boundArea = isUndefined(y1) || isUndefined(y2) ? undefined : [y1, y2];

    if (isUndefined(boundArea)) {
      showAILearningBanner = true;
    }

    dataPoints.push({
      name: result.timestamp,
      status: result.testCaseStatus,
      ...values,
      ...omitBy(metric, isUndefined),
      boundArea,
      incidentId: result.incidentId,
      task: tasks.find((task) => task.id === result.incidentId),
    });
  });

  dataPoints.reverse();

  const testCaseResultParams = testCaseResults.find(
    (result) => result.testResultValue?.length
  );

  const filteredResultValues =
    testCaseResultParams?.testResultValue?.filter(
      (info) => !EXCLUDED_CHART_FIELDS.has(info.name ?? '')
    ) ?? [];

  // A run that aborted before measuring records no values, so a test whose
  // every run did so names no series; one stands in so its runs still get a point.
  const measuredSeries = filteredResultValues.map((info) => info.name ?? '');
  const seriesNames =
    isEmpty(measuredSeries) && !isEmpty(dataPoints)
      ? [FALLBACK_SERIES_NAME]
      : measuredSeries;

  return {
    information: seriesNames.map((label, i) => ({
      label,
      color: COLORS[i] ?? getRandomHexColor(),
    })),
    data: dataPoints,
    showAILearningBanner,
  };
};

export interface ThresholdReference {
  y: number;
  labelKey: string;
  labelValue?: string;
}

/**
 * The value the chart draws its expectation line at, with the label the mock
 * puts beside it. Returns nothing when the test states no numeric expectation,
 * so the caller renders no line rather than one at zero.
 */
export const getThresholdReference = (
  testCaseParameterValue: TestCaseParameterValue[],
  latestResult?: Pick<TestCaseResult, 'maxBound'>
): ThresholdReference | undefined => {
  const { expected, max, min, threshold } = getParameterBounds(
    testCaseParameterValue
  );

  if (!isUndefined(expected)) {
    return {
      y: expected,
      labelKey: 'label.expected-value',
      labelValue: expected.toLocaleString(),
    };
  }

  // Both bounds are optional on the `*ToBeBetween` tests, so a range may be
  // one-sided. The line sits at the upper bound when there is one.
  if (!isUndefined(max)) {
    return { y: max, labelKey: 'label.allowed-max' };
  }

  if (!isUndefined(min)) {
    return { y: min, labelKey: 'label.allowed-min' };
  }

  // `threshold` is a tolerance on most tests but the assertion itself on
  // tableCustomSQLQuery, so it is read only once nothing else supplies the line.
  if (!isUndefined(threshold)) {
    return {
      y: threshold,
      labelKey: 'label.threshold-value',
      labelValue: threshold.toLocaleString(),
    };
  }

  return isUndefined(latestResult?.maxBound)
    ? undefined
    : { y: latestResult.maxBound, labelKey: 'label.learned-baseline' };
};

/**
 * Keys on a point whose values were placed rather than measured. The tooltip
 * lists a point's series values, and must not report a placed one as a result.
 */
export const PLACED_KEYS_FIELD = 'placedKeys';

const PLACED_SERIES_SUFFIX = '__placed';

/** The key a series' placed values are drawn under, apart from its line. */
export const placedSeriesKey = (seriesKey: string) =>
  `${seriesKey}${PLACED_SERIES_SUFFIX}`;

/**
 * A run that produced no value carries no key for any series, so it would be
 * missing from the chart. Aborted runs are placed at the lowest value on the
 * plot (or the expectation line, or zero, when nothing was plotted) and queued
 * runs on the expectation line. The placed value goes under `placedSeriesKey`,
 * not the series' own key, so the line joins measured runs only: drawn through
 * a placed value, an aborted run read as a measured drop. Which keys were
 * placed is recorded on the point.
 */
export const applyStatusPlacements = (
  data: TestCaseChartDataType['data'],
  seriesLabels: string[],
  thresholdY?: number
): TestCaseChartDataType['data'] => {
  const plotted = data.flatMap((point) =>
    seriesLabels.map((label) => point[label]).filter(isNumber)
  );

  // With no value and no line there is no scale to sit on, so the zero line
  // stands in; otherwise every run of an always-aborting test would be invisible.
  const baseline = isEmpty(plotted) ? thresholdY ?? 0 : Math.min(...plotted);

  const placementByStatus: Partial<Record<TestCaseStatus, number | undefined>> =
    {
      [TestCaseStatus.Aborted]: baseline,
      [TestCaseStatus.Queued]: thresholdY ?? baseline,
    };

  return data.map((point) => {
    const placement = placementByStatus[point.status as TestCaseStatus];

    // A run that did record a value keeps it, whatever its status.
    const placedKeys = seriesLabels.reduce<string[]>((keys, label) => {
      if (!isNumber(point[label])) {
        keys.push(placedSeriesKey(label));
      }

      return keys;
    }, []);

    if (isUndefined(placement) || isEmpty(placedKeys)) {
      return point;
    }

    return {
      ...point,
      ...Object.fromEntries(placedKeys.map((key) => [key, placement])),
      [PLACED_KEYS_FIELD]: placedKeys,
    };
  });
};

export const getStatusChartStatus = (status?: TestCaseStatus): ChartStatus => {
  if (status === TestCaseStatus.Success) {
    return 'success';
  }

  if (status === TestCaseStatus.Failed) {
    return 'failed';
  }

  if (status === TestCaseStatus.Queued) {
    return 'info';
  }

  return 'warning';
};

export const formatTestSummaryYAxis = (
  value: number,
  useFreshnessFormat: boolean
): string =>
  useFreshnessFormat
    ? convertSecondsToHumanReadableFormat(value, 2)
    : axisTickFormatter(value);

export interface TooltipSize {
  height: number;
  width: number;
}

export interface TooltipPosition {
  x: number;
  y: number;
}

export interface TooltipBoundary extends TooltipSize, TooltipPosition {}

interface TooltipPositionOptions {
  anchor: TooltipPosition;
  boundary: TooltipBoundary;
  gap: number;
  tooltipSize: TooltipSize;
}

/**
 * Browsers report fractional, layout-dependent sizes for the same tooltip, and
 * the flipped placement derives the position from that size. Comparing exactly
 * would let sub-pixel noise feed a new position back into state indefinitely.
 */
const TOOLTIP_POSITION_EPSILON = 0.5;

export const isSameTooltipPosition = (
  current: TooltipPosition,
  next: TooltipPosition
): boolean =>
  Math.abs(current.x - next.x) < TOOLTIP_POSITION_EPSILON &&
  Math.abs(current.y - next.y) < TOOLTIP_POSITION_EPSILON;

/**
 * Chart view boxes may carry any coordinate as undefined, while overflow-aware
 * placement requires complete finite bounds. Invalid bounds intentionally fall
 * back to the dot-relative position instead of hiding the tooltip.
 */
export const isTestSummaryTooltipBoundary = (
  box: Partial<TooltipBoundary>
): box is TooltipBoundary =>
  [box.height, box.width, box.x, box.y].every((value) =>
    Number.isFinite(value)
  );

const getTooltipAxisPosition = (
  anchor: number,
  tooltipDimension: number,
  boundaryStart: number,
  boundaryDimension: number,
  gap: number
) => {
  if (tooltipDimension >= boundaryDimension) {
    return boundaryStart;
  }

  const positivePosition = anchor + gap;
  const negativePosition = anchor - tooltipDimension - gap;
  const boundaryEnd = boundaryStart + boundaryDimension;
  const preferredPosition =
    positivePosition + tooltipDimension <= boundaryEnd
      ? positivePosition
      : negativePosition;

  return Math.min(
    Math.max(preferredPosition, boundaryStart),
    boundaryEnd - tooltipDimension
  );
};

// A fixed Recharts position bypasses its collision detection. Resolve each
// axis independently so the tooltip remains anchored to the triggering dot.
export const getTestSummaryTooltipPosition = ({
  anchor,
  boundary,
  gap,
  tooltipSize,
}: TooltipPositionOptions): TooltipPosition => ({
  x: getTooltipAxisPosition(
    anchor.x,
    tooltipSize.width,
    boundary.x,
    boundary.width,
    gap
  ),
  y: getTooltipAxisPosition(
    anchor.y,
    tooltipSize.height,
    boundary.y,
    boundary.height,
    gap
  ),
});
