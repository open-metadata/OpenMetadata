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
import isEmpty from 'lodash/isEmpty';
import isNumber from 'lodash/isNumber';
import isUndefined from 'lodash/isUndefined';
import omitBy from 'lodash/omitBy';
import round from 'lodash/round';
import { CartesianViewBox } from 'recharts/types/util/types';
import { TestCaseChartDataType } from '../../components/Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
import {
  BLUE_500,
  GREEN_3,
  RED_3,
  YELLOW_3,
} from '../../constants/Color.constants';
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

export const prepareChartData = ({
  testCaseParameterValue,
  testCaseResults,
  tasks = [],
}: PrepareChartDataType) => {
  // Bond will only be shown if params length is 2 and both values are present
  const params =
    testCaseParameterValue.length === 2 ? testCaseParameterValue : [];
  const dataPoints: TestCaseChartDataType['data'] = [];
  const yValues = params.reduce((acc, curr, i) => {
    const value = Number.parseInt(curr.value ?? '', 10);

    return { ...acc, [`y${i + 1}`]: Number.isNaN(value) ? undefined : value };
  }, {});
  let showAILearningBanner = false;
  testCaseResults.forEach((result) => {
    const values = result.testResultValue?.reduce((acc, curr) => {
      if (EXCLUDED_CHART_FIELDS.has(curr.name ?? '')) {
        return acc;
      }
      const value = round(Number.parseFloat(curr.value ?? ''), 2) || 0;

      return {
        ...acc,
        [curr.name ?? 'value']: value,
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
    // if minBound or maxBound is not present, will fallback to calculated yValues from params
    const y1 = result?.minBound ?? yValues.y1;
    const y2 = result?.maxBound ?? yValues.y2;

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

  return {
    information: filteredResultValues.map((info, i) => ({
      label: info.name ?? '',
      color: COLORS[i] ?? getRandomHexColor(),
    })),
    data: dataPoints,
    showAILearningBanner,
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

export interface ThresholdReference {
  y: number;
  labelKey: string;
  labelValue?: string;
}

const toFiniteNumber = (value?: string) => {
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

  const maxBounds = valuesOf((name) => MAX_BOUND_PARAMETER.test(name));
  const minBounds = valuesOf((name) => MIN_BOUND_PARAMETER.test(name));
  const [threshold] = valuesOf((name) => name === 'threshold');

  return {
    expected: valuesOf((name) => EXPECTED_VALUE_PARAMETERS.has(name))[0],
    max: isEmpty(maxBounds) ? undefined : Math.max(...maxBounds),
    min: isEmpty(minBounds) ? undefined : Math.min(...minBounds),
    threshold,
  };
};

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

/**
 * A run that produced no value carries no key for any series, so recharts drew
 * nothing at all for it and the run was missing from the chart. Aborted runs are
 * placed at the lowest value on the plot and queued runs on the expectation
 * line, on the series itself, so the line runs through them and the point is
 * not left floating off it. Which keys were placed is recorded on the point.
 */
export const applyStatusPlacements = (
  data: TestCaseChartDataType['data'],
  seriesLabels: string[],
  thresholdY?: number
): TestCaseChartDataType['data'] => {
  const plotted = data.flatMap((point) =>
    seriesLabels.map((label) => point[label]).filter(isNumber)
  );

  if (isEmpty(plotted) && isUndefined(thresholdY)) {
    return data;
  }

  const baseline = isEmpty(plotted) ? thresholdY : Math.min(...plotted);

  const placementByStatus: Partial<Record<TestCaseStatus, number | undefined>> =
    {
      [TestCaseStatus.Aborted]: baseline,
      [TestCaseStatus.Queued]: thresholdY ?? baseline,
    };

  return data.map((point) => {
    const placement = placementByStatus[point.status as TestCaseStatus];

    // A run that did record a value keeps it, whatever its status.
    const missing = seriesLabels.filter((label) => !isNumber(point[label]));

    if (isUndefined(placement) || isEmpty(missing)) {
      return point;
    }

    return {
      ...point,
      ...Object.fromEntries(missing.map((label) => [label, placement])),
      [PLACED_KEYS_FIELD]: missing,
    };
  });
};

// Aborted and Queued used to share one colour, which read as a single state:
// a run that produced no result and a run that has not happened yet.
export const getStatusDotColor = (status: TestCaseStatus): string => {
  if (status === TestCaseStatus.Success) {
    return GREEN_3;
  }

  if (status === TestCaseStatus.Failed) {
    return RED_3;
  }

  if (status === TestCaseStatus.Queued) {
    return BLUE_500;
  }

  return YELLOW_3;
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
 * Recharts types every view-box coordinate as optional, while overflow-aware
 * placement requires complete finite bounds. Invalid bounds intentionally fall
 * back to the dot-relative position instead of hiding the tooltip.
 */
export const isTestSummaryTooltipBoundary = (
  viewBox: CartesianViewBox
): viewBox is TooltipBoundary =>
  [viewBox.height, viewBox.width, viewBox.x, viewBox.y].every((value) =>
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
