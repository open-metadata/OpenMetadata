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
import {
  ComposedChart,
  hexToRgba,
  useChartPalette,
} from '@openmetadata/ui-core-components/charts';
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
  placedSeriesKey,
  prepareChartData,
  TooltipBoundary,
  TooltipPosition,
  TooltipSize,
} from '../../../../utils/DataQuality/TestSummaryGraphUtils';
import { formatDateTimeLong } from '../../../../utils/date-time/DateTimeUtils';
import { useTestCaseStore } from '../../../DataQuality/IncidentManager/useTestCase.store';
import { TestCaseChartDataType } from '../ProfilerDashboard/profilerDashboard.interface';
import TestSummaryCustomTooltip from '../TestSummaryCustomTooltip/TestSummaryCustomTooltip.component';
import { RUN_TIME_FORMAT } from './TestSummary.constants';
import { TOOLTIP_CLOSE_DELAY, TOOLTIP_GAP } from './TestSummaryGraph.constants';
import { TestSummaryGraphProps } from './TestSummaryGraph.interface';
import TestSummaryRunList from './TestSummaryRunList';
import TestSummaryStatusKey from './TestSummaryStatusKey';

type PlottedPoint = TestCaseChartDataType['data'][number];

// The tooltip is the app's own React component, so ECharts draws none.
const MULTI_SERIES_EMPHASIS = { emphasis: { focus: 'series' as const } };
const TOOLTIP_OFF = { show: false };
// ECharts centres its legend; the status key under it starts at the edge.
const LEGEND_AT_EDGE = { legend: { left: 0 } };

// Aborted is drawn as a ring, matching the status key: a run that produced no
// value and one that has not run yet must differ by shape, not only by colour.
const POINT_STATUS_HOLLOW = TestCaseStatus.Aborted;

const hasArea = ({ height, width }: TooltipSize) => height > 0 && width > 0;

// Room past the newest and oldest runs, so their dots and the selection ring
// are not cut at the plot edge.
const X_AXIS_EDGE_GAP: [string, string] = ['2%', '2%'];
// Runs at a single instant have no span, and ECharts stretches the time axis
// to two years around them; a day centred on them keeps the axis readable.
const SINGLE_INSTANT_X_PADDING = 12 * 60 * 60 * 1000;
// Share of the data span left above and below the extremes, for the same
// reason. A flat series has no span, so it gets a share of its value instead:
// a fixed step of 1 on 10,000 made every compact tick read "10K".
const Y_AXIS_EDGE_SHARE = 0.04;
const FLAT_SERIES_SHARE = 0.1;
const FLAT_SERIES_MIN_PADDING = 1;
// The mock's chart type: both axes at 11px, the values in Geist Mono.
const AXIS_LABEL_FONT_SIZE = 11;
const CHART_MONO_FONT = 'Geist Mono, ui-monospace, monospace';
// The padded extremes are padding, not data: a label there printed values like
// "10.58K" on top of the "10K" tick.
const Y_AXIS_LABEL = {
  showMinLabel: false,
  showMaxLabel: false,
  fontFamily: CHART_MONO_FONT,
  fontSize: AXIS_LABEL_FONT_SIZE,
  fontWeight: 500,
};
// The mock's dots: r3.4 in a 1.6px ring, the newest run's r5.4 in a 2.4px
// one, an aborted run's ring 1.5px.
const POINT_SIZE = 6.8;
const POINT_RING_WIDTH = 1.6;
const NEWEST_POINT_SIZE = 10.8;
const NEWEST_POINT_RING_WIDTH = 2.4;
const HOLLOW_POINT_RING_WIDTH = 1.5;
// The mock's guide to the selected run, drawn in the run's status colour.
const SELECTION_GUIDE = { lineType: 'solid', width: 1.5 } as const;
// The mock's expectation line and its label.
const EXPECTATION_LINE: Pick<
  ChartReferenceLine,
  'lineType' | 'width' | 'labelStyle'
> = {
  lineType: [5, 4],
  width: 1.5,
  labelStyle: { fontSize: 10.5, fontWeight: 600 },
};
// One series reads as data under a 2px line and a faint brand wash.
const SINGLE_SERIES_LINE_WIDTH = 2;
const SINGLE_SERIES_WASH = 0.05;

const pointRingWidth = (isHollow: boolean, isNewest: boolean) => {
  if (isHollow) {
    return HOLLOW_POINT_RING_WIDTH;
  }

  return isNewest ? NEWEST_POINT_RING_WIDTH : POINT_RING_WIDTH;
};

interface AxisExtent {
  min: number;
  max: number;
}

const yAxisPadding = ({ min, max }: AxisExtent) =>
  max === min
    ? Math.max(Math.abs(max) * FLAT_SERIES_SHARE, FLAT_SERIES_MIN_PADDING)
    : (max - min) * Y_AXIS_EDGE_SHARE;
const paddedYAxisMin = (extent: AxisExtent) =>
  extent.min - yAxisPadding(extent);
const paddedYAxisMax = (extent: AxisExtent) =>
  extent.max + yAxisPadding(extent);

// ECharts does not draw a reference line outside the axis range, and a failing
// run can sit far from its expectation (110 rows against 10,000), so the
// extent takes the expectation in.
const includeInExtent = (extent: AxisExtent, value?: number): AxisExtent =>
  isUndefined(value)
    ? extent
    : { min: Math.min(extent.min, value), max: Math.max(extent.max, value) };

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
  const palette = useChartPalette();
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
  const newestRunTimestamp = useMemo(() => {
    const latestPointName = plottedData[plottedData.length - 1]?.name;

    return isNumber(latestPointName) ? latestPointName : undefined;
  }, [plottedData]);

  const activeRunTimestamp = useMemo(
    () =>
      !isUndefined(selectedRunTimestamp) &&
      plottedData.some((point) => point.name === selectedRunTimestamp)
        ? selectedRunTimestamp
        : newestRunTimestamp,
    [plottedData, selectedRunTimestamp, newestRunTimestamp]
  );

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
    // A row a series holds no value for - a run that produced nothing, or one
    // whose value was placed off the line - draws no dot.
    const pointStyleOf = (key: string) => (point: Record<string, unknown>) => {
      if (isUndefined(point[key])) {
        return undefined;
      }
      const isHollow = point.status === POINT_STATUS_HOLLOW;
      const isNewest = point.name === newestRunTimestamp;

      return {
        status: getStatusChartStatus(point.status as TestCaseStatus),
        hollow: isHollow,
        selected: point.name === activeRunTimestamp,
        size: isNewest ? NEWEST_POINT_SIZE : POINT_SIZE,
        ringWidth: pointRingWidth(isHollow, isNewest),
      };
    };
    const lines = seriesLabels.map<ChartSeries>((label) => ({
      key: label,
      name: label,
      // One series reads as data and keeps a grey wash under it; several
      // need the palette to be told apart. Muted, not neutral: neutral is a
      // track colour, too pale for a line.
      type: isSingleSeries ? 'area' : 'line',
      status: isSingleSeries ? 'muted' : undefined,
      smooth: false,
      pointStyle: pointStyleOf(label),
      seriesOption: {
        // The line bridges the runs placed off it, so it joins measured
        // runs only.
        connectNulls: true,
        // Focusing the hovered series fades the others, and with them the
        // band and the expectation label; only worth it when there are others.
        ...(isSingleSeries
          ? {
              areaStyle: {
                color: hexToRgba(palette.status.info, SINGLE_SERIES_WASH),
              },
              lineStyle: { width: SINGLE_SERIES_LINE_WIDTH },
            }
          : MULTI_SERIES_EMPHASIS),
      },
    }));
    // Aborted and queued runs as dots alone, after the lines so no line's
    // palette colour shifts. Named like their line, so the legend lists and
    // toggles the two once.
    const placed = seriesLabels.reduce<ChartSeries[]>((series, label) => {
      const key = placedSeriesKey(label);

      if (plottedData.some((point) => !isUndefined(point[key]))) {
        series.push({
          key,
          name: label,
          type: 'line',
          pointStyle: pointStyleOf(key),
          seriesOption: { lineStyle: { opacity: 0 } },
        });
      }

      return series;
    }, []);

    return [...band, ...lines, ...placed];
  }, [
    plottedData,
    seriesLabels,
    isSingleSeries,
    activeRunTimestamp,
    newestRunTimestamp,
    palette,
    t,
  ]);

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
              // The selection guide opens on the newest run, at the right end.
              labelPosition: 'start' as const,
              ...EXPECTATION_LINE,
            },
          ]
        : []),
      ...(isUndefined(activeRunTimestamp)
        ? []
        : [
            {
              axis: 'x' as const,
              value: activeRunTimestamp,
              status: getStatusChartStatus(
                plottedData.find((point) => point.name === activeRunTimestamp)
                  ?.status as TestCaseStatus
              ),
              ...SELECTION_GUIDE,
            },
          ]),
    ],
    [thresholdReference, activeRunTimestamp, plottedData, t]
  );

  const xAxis = useMemo<ChartXAxisProps>(() => {
    const instants = [
      ...new Set(plottedData.map((point) => Number(point.name))),
    ].sort((a, b) => a - b);
    const formatRunTime = (value: number) =>
      formatDateTimeLong(value, RUN_TIME_FORMAT);
    // Ticks at the runs themselves, one per label: ECharts' own ticks landed
    // on midnight for daily runs ("12:00 AM"), and repeated a minute's label
    // for runs a few seconds apart.
    const tickValues = instants.filter(
      (instant, index) =>
        index === 0 ||
        formatRunTime(instant) !== formatRunTime(instants[index - 1])
    );

    return {
      type: 'time',
      formatter: (value) => formatRunTime(Number(value)),
      axisLabel: {
        rotate: 45,
        customValues: tickValues,
        fontSize: AXIS_LABEL_FONT_SIZE,
      },
      // ECharts' own axis grey does not follow the theme.
      axisLine: { lineStyle: { color: palette.status.neutral } },
      boundaryGap: X_AXIS_EDGE_GAP,
      ...(instants.length === 1 && {
        min: instants[0] - SINGLE_INSTANT_X_PADDING,
        max: instants[0] + SINGLE_INSTANT_X_PADDING,
      }),
    };
  }, [plottedData, palette]);

  const yAxis = useMemo<ChartYAxisProps>(
    () => ({
      min: (extent: AxisExtent) =>
        paddedYAxisMin(includeInExtent(extent, thresholdReference?.y)),
      max: (extent: AxisExtent) =>
        paddedYAxisMax(includeInExtent(extent, thresholdReference?.y)),
      axisLabel: Y_AXIS_LABEL,
      formatter: (value) => formatYAxis(Number(value)),
    }),
    [formatYAxis, thresholdReference]
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
      `${formatDateTimeLong(Number(point.name), RUN_TIME_FORMAT)}: ${String(
        point.status ?? ''
      )}`,
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
    <Box direction="col">
      <div className="tw:relative" id={`${testCaseName}_graph`} ref={plotRef}>
        <ComposedChart
          keyboardNavigation
          ariaLabel={t('label.test-case-result')}
          data={plottedData}
          height={minHeight ?? 400}
          legend={legend}
          option={LEGEND_AT_EDGE}
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
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:pb-2">
        <TestSummaryStatusKey statuses={plottedStatuses} />
        <span className="tw:ml-auto tw:text-xs tw:text-quaternary">
          {t('message.click-a-point-for-run-details')}
        </span>
      </div>
    </Box>
  );
}

export default TestSummaryGraph;
