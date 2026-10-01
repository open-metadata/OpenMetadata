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

import { Box, EmptyPlaceholder } from '@openmetadata/ui-core-components';
import type {
  ChartLegendProps,
  ChartPixel,
  ChartReferenceLine,
  ChartSeries,
  ChartXAxisProps,
  ChartYAxisProps,
} from '@openmetadata/ui-core-components/charts';
import { ComposedChart } from '@openmetadata/ui-core-components/charts';
import { useQueries } from '@tanstack/react-query';
import { isEmpty, isNumber, isUndefined } from 'lodash';
import {
  FocusEvent,
  RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FilterOffIcon } from '../../../../assets/svg/ic-filter-off.svg';
import {
  TABLE_DATA_TO_BE_FRESH,
  TABLE_FRESHNESS_KEY,
} from '../../../../constants/TestSuite.constant';
import type { TestCaseResult } from '../../../../generated/tests/testCase';
import { TestCaseStatus } from '../../../../generated/tests/testCase';
import { getTaskById } from '../../../../rest/tasksAPI';
import {
  applyStatusPlacements,
  formatTestSummaryYAxis,
  getStatusChartStatus,
  getTestSummaryTooltipPosition,
  getThresholdReference,
  isSameTooltipPosition,
  isTestSummaryTooltipBoundary,
  prepareChartData,
  TooltipBoundary,
  TooltipPosition,
  TooltipSize,
} from '../../../../utils/DataQuality/TestSummaryGraphUtils';
import {
  DATE_TIME_12_HOUR_FORMAT,
  formatDateTimeLong,
} from '../../../../utils/date-time/DateTimeUtils';
import { useTestCaseStore } from '../../../DataQuality/IncidentManager/useTestCase.store';
import { TestCaseChartDataType } from '../ProfilerDashboard/profilerDashboard.interface';
import TestSummaryCustomTooltip from '../TestSummaryCustomTooltip/TestSummaryCustomTooltip.component';
import { TOOLTIP_CLOSE_DELAY, TOOLTIP_GAP } from './TestSummaryGraph.constants';
import { TestSummaryGraphProps } from './TestSummaryGraph.interface';
import TestSummaryRunList from './TestSummaryRunList';
import TestSummaryStatusKey from './TestSummaryStatusKey';

type PlottedPoint = TestCaseChartDataType['data'][number];

// The tooltip is the app's own React component, so ECharts draws none.
const MULTI_SERIES_EMPHASIS = { emphasis: { focus: 'series' as const } };
const TOOLTIP_OFF = { show: false };

// Aborted is drawn as a ring, matching the status key: a run that produced no
// value and one that has not run yet must differ by shape, not only by colour.
const POINT_STATUS_HOLLOW = TestCaseStatus.Aborted;

const hasArea = ({ height, width }: TooltipSize) => height > 0 && width > 0;

// Room past the newest and oldest runs, so their dots and the selection halo
// are not cut at the plot edge.
const X_AXIS_EDGE_GAP: [string, string] = ['2%', '2%'];
// Share of the data span left above and below the extremes, for the same
// reason; a flat series gets a fixed step instead.
const Y_AXIS_EDGE_SHARE = 0.04;
const FLAT_SERIES_PADDING = 1;

interface AxisExtent {
  min: number;
  max: number;
}

const yAxisPadding = ({ min, max }: AxisExtent) =>
  max === min ? FLAT_SERIES_PADDING : (max - min) * Y_AXIS_EDGE_SHARE;
const paddedYAxisMin = (extent: AxisExtent) =>
  extent.min - yAxisPadding(extent);
const paddedYAxisMax = (extent: AxisExtent) =>
  extent.max + yAxisPadding(extent);

interface ActiveTooltip {
  anchor: TooltipPosition;
  payload: Record<string, unknown>;
  position: TooltipPosition;
}

interface TestSummaryTooltipContentProps {
  activeTooltip: ActiveTooltip;
  boundaryRef: RefObject<HTMLDivElement>;
  onMeasure: (size: TooltipSize, boundary: TooltipBoundary) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const TestSummaryTooltipContent = ({
  activeTooltip,
  boundaryRef,
  onMeasure,
  onMouseEnter,
  onMouseLeave,
}: Readonly<TestSummaryTooltipContentProps>) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const { x: anchorX, y: anchorY } = activeTooltip.anchor;
  const { payload } = activeTooltip;

  useLayoutEffect(() => {
    if (!contentRef.current || !boundaryRef.current) {
      return;
    }

    const { height, width } = contentRef.current.getBoundingClientRect();
    const plot = boundaryRef.current.getBoundingClientRect();
    // Anchors are relative to the chart's top-left, so the boundary is too.
    const boundary = { height: plot.height, width: plot.width, x: 0, y: 0 };

    if (
      hasArea({ height, width }) &&
      isTestSummaryTooltipBoundary(boundary) &&
      hasArea(boundary)
    ) {
      // Resolve collision before paint so the incident link never visibly
      // moves away from a pointer approaching the tooltip.
      onMeasure({ height, width }, boundary);
    }
  }, [anchorX, anchorY, payload, boundaryRef, onMeasure]);

  return (
    <div ref={contentRef}>
      <TestSummaryCustomTooltip
        active
        payload={[{ payload }]}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
    </div>
  );
};

function TestSummaryGraph({
  testCaseName,
  testCaseParameterValue,
  testCaseResults,
  selectedTimeRange,
  minHeight,
  testDefinitionName,
}: Readonly<TestSummaryGraphProps>) {
  const { t } = useTranslation();
  const {
    setShowAILearningBanner,
    selectedRunTimestamp,
    setSelectedRunTimestamp,
  } = useTestCaseStore();
  const plotRef = useRef<HTMLDivElement>(null);
  const tooltipCloseTimer = useRef<ReturnType<typeof setTimeout>>();
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltip>();

  const cancelTooltipClose = useCallback(() => {
    if (tooltipCloseTimer.current) {
      clearTimeout(tooltipCloseTimer.current);
      tooltipCloseTimer.current = undefined;
    }
  }, []);

  const handleTooltipOpen = useCallback(
    (x: number, y: number, payload: Record<string, unknown>) => {
      cancelTooltipClose();
      setActiveTooltip({
        anchor: { x, y },
        payload,
        position: { x: x + TOOLTIP_GAP, y: y + TOOLTIP_GAP },
      });
    },
    [cancelTooltipClose]
  );

  const handleTooltipMeasure = useCallback(
    (tooltipSize: TooltipSize, boundary: TooltipBoundary) => {
      setActiveTooltip((currentTooltip) => {
        if (!currentTooltip) {
          return currentTooltip;
        }

        const position = getTestSummaryTooltipPosition({
          anchor: currentTooltip.anchor,
          boundary,
          gap: TOOLTIP_GAP,
          tooltipSize,
        });

        if (isSameTooltipPosition(currentTooltip.position, position)) {
          return currentTooltip;
        }

        return { ...currentTooltip, position };
      });
    },
    []
  );

  const handleTooltipClose = useCallback(() => {
    cancelTooltipClose();
    // Delay closing the point-triggered tooltip so the pointer can cross the
    // gap and reach its incident link.
    tooltipCloseTimer.current = setTimeout(() => {
      setActiveTooltip(undefined);
      tooltipCloseTimer.current = undefined;
    }, TOOLTIP_CLOSE_DELAY);
  }, [cancelTooltipClose]);

  // Focus moving between the tooltip's own elements keeps it open; leaving it
  // closes it like the pointer does.
  const handleTooltipBlur = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      const next = event.relatedTarget;
      if (!(next instanceof Node && event.currentTarget.contains(next))) {
        handleTooltipClose();
      }
    },
    [handleTooltipClose]
  );

  useEffect(() => cancelTooltipClose, [cancelTooltipClose]);

  const incidentIds = useMemo(
    () => [
      ...new Set(
        testCaseResults
          .map((result) =>
            'incidentId' in result ? result.incidentId : undefined
          )
          .filter((id): id is string => Boolean(id))
      ),
    ],
    [testCaseResults]
  );

  // Fetch incident tasks independently so one unavailable task does not hide
  // metadata already resolved for the other chart points.
  const tasks = useQueries({
    queries: incidentIds.map((incidentId) => ({
      queryKey: ['test-summary', 'incident-task', incidentId],
      queryFn: async () =>
        (await getTaskById(incidentId, { fields: 'about,assignees' })).data,
    })),
    combine: (results) =>
      results.flatMap((result) => (result.data ? [result.data] : [])),
  });

  const { chartData, isFreshnessTest } = useMemo(() => {
    const data = prepareChartData({
      testCaseParameterValue: testCaseParameterValue ?? [],
      testCaseResults,
      tasks,
    });
    const isFreshnessTest = data.information.some(
      (value) => value.label === TABLE_FRESHNESS_KEY
    );

    return { chartData: data, isFreshnessTest };
  }, [testCaseResults, tasks, testCaseParameterValue]);

  // A store write during render (inside the memo above) triggers React
  // update-depth loops; it must stay in an effect.
  useEffect(() => {
    setShowAILearningBanner(chartData.showAILearningBanner);
  }, [chartData.showAILearningBanner, setShowAILearningBanner]);

  const isSingleSeries = chartData.information.length === 1;

  const useFreshnessFormat =
    testDefinitionName === TABLE_DATA_TO_BE_FRESH || isFreshnessTest;
  const formatYAxis = useCallback(
    (value: number) => formatTestSummaryYAxis(value, useFreshnessFormat),
    [useFreshnessFormat]
  );

  const thresholdReference = useMemo(
    () =>
      getThresholdReference(
        testCaseParameterValue ?? [],
        // Dimension results carry no learned bound, so the fallback simply
        // finds nothing for them.
        testCaseResults[0] as Pick<TestCaseResult, 'maxBound'> | undefined
      ),
    [testCaseParameterValue, testCaseResults]
  );

  const plottedStatuses = useMemo(
    () =>
      chartData.data
        .map((point) => point.status)
        .filter((status): status is TestCaseStatus => Boolean(status)),
    [chartData.data]
  );

  const plottedData = useMemo(
    () =>
      applyStatusPlacements(
        chartData.data,
        chartData.information.map((info) => info.label),
        thresholdReference?.y
      ),
    [chartData, thresholdReference]
  );

  const seriesLabels = useMemo(
    () => chartData.information.map((info) => info.label),
    [chartData.information]
  );

  // Until the user picks a run, the card beside the chart opens on the newest
  // one. The store outlives a date-range or dimension change, so a selection
  // the refetched data no longer holds falls back to the newest run as well.
  // A point's `name` is typed as the union of every field the tooltip reads,
  // so it is narrowed back to its timestamp.
  const activeRunTimestamp = useMemo(() => {
    if (
      !isUndefined(selectedRunTimestamp) &&
      plottedData.some((point) => point.name === selectedRunTimestamp)
    ) {
      return selectedRunTimestamp;
    }

    const latestPointName = plottedData[plottedData.length - 1]?.name;

    return isNumber(latestPointName) ? latestPointName : undefined;
  }, [plottedData, selectedRunTimestamp]);

  const handleRunSelect = useCallback(
    (timestamp: number) => setSelectedRunTimestamp(timestamp),
    [setSelectedRunTimestamp]
  );

  const series = useMemo<ChartSeries[]>(() => {
    const hasBand = plottedData.some((point) => !isUndefined(point.boundArea));
    const band: ChartSeries[] = hasBand
      ? [
          {
            key: 'boundArea',
            name: t('label.range'),
            type: 'band',
            status: 'success',
          },
        ]
      : [];
    const lines = seriesLabels.map<ChartSeries>((label) => ({
      key: label,
      name: label,
      // One series reads as data and keeps a grey wash under it; several
      // need the palette to be told apart. Muted, not neutral: neutral is a
      // track colour, too pale for a line.
      type: isSingleSeries ? 'area' : 'line',
      status: isSingleSeries ? 'muted' : undefined,
      smooth: false,
      // A row this series holds no value for - a run that produced nothing,
      // or one placed on another series - draws no dot.
      pointStyle: (point) =>
        isUndefined(point[label])
          ? undefined
          : {
              status: getStatusChartStatus(point.status as TestCaseStatus),
              hollow: point.status === POINT_STATUS_HOLLOW,
              selected: point.name === activeRunTimestamp,
            },
      // Focusing the hovered series fades the others, and with them the band
      // and the expectation label; only worth it when there are others.
      seriesOption: isSingleSeries ? undefined : MULTI_SERIES_EMPHASIS,
    }));

    return [...band, ...lines];
  }, [plottedData, seriesLabels, isSingleSeries, activeRunTimestamp, t]);

  const referenceLines = useMemo<ChartReferenceLine[]>(
    () => [
      ...(thresholdReference
        ? [
            {
              axis: 'y' as const,
              value: thresholdReference.y,
              label: t(thresholdReference.labelKey, {
                value: thresholdReference.labelValue,
              }),
            },
          ]
        : []),
      // The default (neutral) line: a red guide would read as a failed run.
      ...(isUndefined(activeRunTimestamp)
        ? []
        : [{ axis: 'x' as const, value: activeRunTimestamp }]),
    ],
    [thresholdReference, activeRunTimestamp, t]
  );

  const xAxis = useMemo<ChartXAxisProps>(
    () => ({
      type: 'time',
      formatter: (value) =>
        formatDateTimeLong(Number(value), DATE_TIME_12_HOUR_FORMAT),
      axisLabel: { rotate: 45 },
      boundaryGap: X_AXIS_EDGE_GAP,
    }),
    []
  );

  const yAxis = useMemo<ChartYAxisProps>(
    () => ({
      min: paddedYAxisMin,
      max: paddedYAxisMax,
      formatter: (value) => formatYAxis(Number(value)),
    }),
    [formatYAxis]
  );

  // With one series there is nothing to tell apart.
  const legend = useMemo<ChartLegendProps>(
    () => ({ show: !isSingleSeries }),
    [isSingleSeries]
  );

  const handlePointHover = useCallback(
    (point: PlottedPoint, _seriesKey: string, { x, y }: ChartPixel) =>
      handleTooltipOpen(x, y, point),
    [handleTooltipOpen]
  );

  const handlePointClick = useCallback(
    (point: PlottedPoint) => {
      if (isNumber(point.name)) {
        handleRunSelect(point.name);
      }
    },
    [handleRunSelect]
  );

  const pointAriaLabel = useCallback(
    (point: PlottedPoint) =>
      `${formatDateTimeLong(
        Number(point.name),
        DATE_TIME_12_HOUR_FORMAT
      )}: ${String(point.status ?? '')}`,
    []
  );

  if (isEmpty(testCaseResults)) {
    return (
      <Box className="tw:relative tw:min-h-80 tw:w-full">
        <EmptyPlaceholder
          description={t('message.try-extending-time-frame')}
          icon={<FilterOffIcon className="tw:text-fg-quaternary" />}
          title={t('message.no-test-result-for-days', {
            days: selectedTimeRange,
          })}
          variant="blank"
        />
      </Box>
    );
  }

  return (
    <Box className="tw:bg-primary" direction="col">
      <div className="tw:relative" id={`${testCaseName}_graph`} ref={plotRef}>
        <ComposedChart
          keyboardNavigation
          ariaLabel={t('label.test-case-result')}
          data={plottedData}
          height={minHeight ?? 400}
          legend={legend}
          pointAriaLabel={pointAriaLabel}
          referenceLines={referenceLines}
          series={series}
          tooltip={TOOLTIP_OFF}
          xAxis={xAxis}
          xKey="name"
          yAxis={yAxis}
          onPointClick={handlePointClick}
          onPointHover={handlePointHover}
          onPointLeave={handleTooltipClose}
        />
        {activeTooltip && (
          // Placed by transform from the top-left corner, so the tooltip lays
          // out at its natural width wherever it sits and measures true.
          // Tab from the chart lands on the incident link; the chart's blur
          // must not close the tooltip from under the focus.
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- only tracks focus inside the tooltip
          <div
            className="tw:absolute tw:top-0 tw:left-0 tw:z-10"
            style={{
              transform: `translate(${activeTooltip.position.x}px, ${activeTooltip.position.y}px)`,
            }}
            onBlur={handleTooltipBlur}
            onFocus={cancelTooltipClose}>
            <TestSummaryTooltipContent
              activeTooltip={activeTooltip}
              boundaryRef={plotRef}
              onMeasure={handleTooltipMeasure}
              onMouseEnter={cancelTooltipClose}
              onMouseLeave={handleTooltipClose}
            />
          </div>
        )}
      </div>
      <TestSummaryRunList
        getLabel={pointAriaLabel}
        points={plottedData}
        seriesLabels={seriesLabels}
      />
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:px-4 tw:pb-2">
        <TestSummaryStatusKey statuses={plottedStatuses} />
      </div>
    </Box>
  );
}

export default TestSummaryGraph;
