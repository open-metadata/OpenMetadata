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
import isUndefined from 'lodash/isUndefined';
import omitBy from 'lodash/omitBy';
import round from 'lodash/round';
import { CartesianViewBox } from 'recharts/types/util/types';
import { TestCaseChartDataType } from '../../components/Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
import { GREEN_3, RED_3, YELLOW_2 } from '../../constants/Color.constants';
import { COLORS } from '../../constants/profiler.constant';
import { Thread } from '../../generated/entity/feed/thread';
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
  getTaskDetailPath,
  getTaskDetailPathFromTask,
  getTaskDisplayId,
} from '../TaskNavigationUtils';

const EXCLUDED_CHART_FIELDS = new Set(['schemaTable1', 'schemaTable2']);

export type PrepareChartDataType = {
  testCaseParameterValue: TestCaseParameterValue[];
  testCaseResults: TestCaseResult[];
  entityThread: Thread[];
  tasks?: Task[];
};

function isThread(value: unknown): value is Thread {
  return typeof value === 'object' && value !== null && 'task' in value;
}

/**
 * Converts current tasks and legacy threads into the fields used by the
 * tooltip, keeping the display component independent of the incident API.
 */
export const getIncidentDetails = (task?: Task | Thread) => {
  if (!task) {
    return {};
  }

  if (isThread(task)) {
    return {
      incidentDisplayId: task.task?.id,
      incidentPath: getTaskDetailPath(task),
      incidentAssignees: task.task?.assignees,
    };
  }

  return {
    incidentDisplayId: getTaskDisplayId(task.taskId),
    incidentPath: getTaskDetailPathFromTask(task),
    incidentAssignees: task.assignees,
  };
};

/**
 * Results without an incident must not match a task or thread that is also
 * missing the identifier, otherwise every dimensional point — none of which
 * carry an incidentId — adopts the first unrelated thread as its incident.
 */
const findIncidentTask = (
  incidentId: string | undefined,
  tasks: Task[],
  entityThread: Thread[]
): Task | Thread | undefined => {
  if (!incidentId) {
    return undefined;
  }

  return (
    tasks.find((task) => task.id === incidentId) ??
    entityThread.find(
      (thread) => thread.task?.testCaseResolutionStatusId === incidentId
    )
  );
};

export const prepareChartData = ({
  testCaseParameterValue,
  testCaseResults,
  entityThread,
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
      task: findIncidentTask(result.incidentId, tasks, entityThread),
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

export const getStatusDotColor = (status: TestCaseStatus): string => {
  if (status === TestCaseStatus.Success) {
    return GREEN_3;
  }

  if (status === TestCaseStatus.Failed) {
    return RED_3;
  }

  return YELLOW_2;
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
