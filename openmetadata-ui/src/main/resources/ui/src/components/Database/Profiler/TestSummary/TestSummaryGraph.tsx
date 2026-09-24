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
import { useQueries } from '@tanstack/react-query';
import { isEmpty, isUndefined } from 'lodash';
import {
  KeyboardEvent,
  ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  LegendProps,
  Line,
  LineProps,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Payload } from 'recharts/types/component/DefaultLegendContent';
import { CartesianViewBox, Coordinate } from 'recharts/types/util/types';
import { ReactComponent as FilterOffIcon } from '../../../../assets/svg/ic-filter-off.svg';
import {
  COLOR_GREY_400,
  GRAY_700,
  GREEN_3,
  GREEN_3_OPACITY,
  RED_3,
} from '../../../../constants/Color.constants';
import {
  DEFAULT_CHART_OPACITY,
  HOVER_CHART_OPACITY,
} from '../../../../constants/constants';
import {
  TABLE_DATA_TO_BE_FRESH,
  TABLE_FRESHNESS_KEY,
} from '../../../../constants/TestSuite.constant';
import type { TestCaseResult } from '../../../../generated/tests/testCase';
import { TestCaseStatus } from '../../../../generated/tests/testCase';
import { useChartColors } from '../../../../hooks/useChartColors';
import { useTestCaseStore } from '../../../../pages/IncidentManager/IncidentManagerDetailPage/useTestCase.store';
import { getTaskById } from '../../../../rest/tasksAPI';
import { updateActiveChartFilter } from '../../../../utils/ChartUtils';
import {
  applyStatusPlacements,
  formatTestSummaryYAxis,
  getStatusDotColor,
  getTestSummaryTooltipPosition,
  getThresholdReference,
  isSameTooltipPosition,
  isTestSummaryTooltipBoundary,
  prepareChartData,
  TooltipBoundary,
  TooltipSize,
} from '../../../../utils/DataQuality/TestSummaryGraphUtils';
import {
  DATE_TIME_12_HOUR_FORMAT,
  formatDateTimeLong,
} from '../../../../utils/date-time/DateTimeUtils';
import TestSummaryCustomTooltip from '../TestSummaryCustomTooltip/TestSummaryCustomTooltip.component';
import TestSummaryStatusKey from './TestSummaryStatusKey';
import {
  DOT_OUTLINE,
  EXPECTATION_LABEL_HALO,
  PLOT_BACKGROUND,
  PLOT_BACKGROUND_OPACITY,
  SELECTED_DOT_EDGE_PADDING,
  SELECTED_DOT_HALO,
  STATUS_DOT_RADIUS,
  STATUS_DOT_RING_WIDTH,
  STATUS_DOT_SIZE,
  TEST_SUMMARY_CHART_MARGIN,
  TOOLTIP_CLOSE_DELAY,
  TOOLTIP_GAP,
} from './TestSummaryGraph.constants';
import { TestSummaryGraphProps } from './TestSummaryGraph.interface';

interface ActiveTooltip {
  anchor: Coordinate;
  payload: Record<string, unknown>;
  position: Coordinate;
}

interface TestSummaryTooltipContentProps {
  activeTooltip?: ActiveTooltip;
  onMeasure: (size: TooltipSize, boundary: TooltipBoundary) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  viewBox?: CartesianViewBox;
}

const TestSummaryTooltipContent = ({
  activeTooltip,
  onMeasure,
  onMouseEnter,
  onMouseLeave,
  viewBox,
}: Readonly<TestSummaryTooltipContentProps>) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const activeTooltipAnchorX = activeTooltip?.anchor.x;
  const activeTooltipAnchorY = activeTooltip?.anchor.y;
  const activeTooltipPayload = activeTooltip?.payload;
  const viewBoxHeight = viewBox?.height;
  const viewBoxWidth = viewBox?.width;
  const viewBoxX = viewBox?.x;
  const viewBoxY = viewBox?.y;
  const tooltipBoundary = useMemo(() => {
    const boundary: CartesianViewBox = {
      height: viewBoxHeight,
      width: viewBoxWidth,
      x: viewBoxX,
      y: viewBoxY,
    };

    return isTestSummaryTooltipBoundary(boundary) ? boundary : undefined;
  }, [viewBoxHeight, viewBoxWidth, viewBoxX, viewBoxY]);

  useLayoutEffect(() => {
    if (!activeTooltipPayload || !tooltipBoundary || !contentRef.current) {
      return;
    }

    const { height, width } = contentRef.current.getBoundingClientRect();

    if (
      height > 0 &&
      width > 0 &&
      tooltipBoundary.height > 0 &&
      tooltipBoundary.width > 0
    ) {
      // Resolve collision before paint so the incident link never visibly
      // moves away from a pointer approaching the tooltip.
      onMeasure({ height, width }, tooltipBoundary);
    }
  }, [
    activeTooltipAnchorX,
    activeTooltipAnchorY,
    activeTooltipPayload,
    onMeasure,
    tooltipBoundary,
  ]);

  return (
    <div ref={contentRef}>
      <TestSummaryCustomTooltip
        active={Boolean(activeTooltip)}
        payload={
          activeTooltip ? [{ payload: activeTooltip.payload }] : undefined
        }
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
  const { axis, grid } = useChartColors();
  const {
    setShowAILearningBanner,
    selectedRunTimestamp,
    setSelectedRunTimestamp,
  } = useTestCaseStore();
  const tooltipCloseTimer = useRef<ReturnType<typeof setTimeout>>();
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltip>();
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [activeMouseHoverKey, setActiveMouseHoverKey] = useState('');

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
    // Delay closing the dot-triggered tooltip so the pointer can cross the
    // chart gap and reach its incident link.
    tooltipCloseTimer.current = setTimeout(() => {
      setActiveTooltip(undefined);
      tooltipCloseTimer.current = undefined;
    }, TOOLTIP_CLOSE_DELAY);
  }, [cancelTooltipClose]);

  const handleTooltipKeyDown = useCallback(
    (event: KeyboardEvent<SVGElement>) => {
      if (event.key === 'Escape') {
        cancelTooltipClose();
        setActiveTooltip(undefined);
      }
    },
    [cancelTooltipClose]
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

  // One series reads as data, not as a category, so it takes the neutral the
  // mock draws it in. Several need the palette to be told apart.
  const isSingleSeries = chartData.information.length === 1;
  const getSeriesColor = useCallback(
    (color: string) => (isSingleSeries ? COLOR_GREY_400 : color),
    [isSingleSeries]
  );

  const customLegendPayLoad = useMemo(() => {
    const legendPayload: Payload[] = chartData?.information.map((info) => ({
      value: info.label,
      dataKey: info.label,
      type: 'line',
      color: getSeriesColor(info.color),
      inactive: !(activeKeys.length === 0 || activeKeys.includes(info.label)),
    }));

    return legendPayload;
  }, [chartData?.information, activeKeys, getSeriesColor]);

  const handleLegendClick: LegendProps['onClick'] = (event) => {
    setActiveKeys((prevActiveKeys) =>
      updateActiveChartFilter(event.dataKey, prevActiveKeys)
    );
  };

  const handleLegendMouseEnter: LegendProps['onMouseEnter'] = (event) => {
    setActiveMouseHoverKey(event.dataKey);
  };
  const handleLegendMouseLeave: LegendProps['onMouseLeave'] = () => {
    setActiveMouseHoverKey('');
  };

  const useFreshnessFormat =
    testDefinitionName === TABLE_DATA_TO_BE_FRESH || isFreshnessTest;
  const formatYAxis = useCallback(
    (value: number) => formatTestSummaryYAxis(value, useFreshnessFormat),
    [useFreshnessFormat]
  );

  // Nothing is selected until the user picks a run, so the card beside the
  // chart opens on the newest one. A point's `name` is typed as the union of
  // every field the tooltip reads, so it is narrowed back to its timestamp.
  const latestPointName = chartData.data[chartData.data.length - 1]?.name;
  const activeRunTimestamp =
    selectedRunTimestamp ??
    (typeof latestPointName === 'number' ? latestPointName : undefined);

  const handleRunSelect = useCallback(
    (timestamp: number) => setSelectedRunTimestamp(timestamp),
    [setSelectedRunTimestamp]
  );

  const renderStatusDot: LineProps['dot'] = (
    props
  ): ReactElement<SVGElement> => {
    const { cx = 0, cy = 0, dataKey, payload } = props;
    const pointValue = payload[String(dataKey)];

    // Recharts calls the dot renderer for every row of the chart, including
    // the ones this series holds no value for - a run that produced nothing on
    // the value line, and every ordinary run on the two placement series.
    if (isUndefined(pointValue)) {
      return <g />;
    }

    const fill = getStatusDotColor(payload.status);
    const pointKey = String(dataKey);
    // Aborted is drawn as a ring, matching the status key: a run that produced
    // no value and one that has not run yet must differ by shape, not only by
    // colour. The stroke sits inside the radius so the dot keeps its size.
    const isHollow = payload.status === TestCaseStatus.Aborted;
    const isSelected = payload.name === activeRunTimestamp;

    return (
      // The focus ring extends outside the dot's SVG bounds, so overflow must
      // remain visible for keyboard users.
      <svg
        fill="none"
        height={STATUS_DOT_SIZE}
        overflow="visible"
        width={STATUS_DOT_SIZE}
        x={cx - STATUS_DOT_RADIUS}
        xmlns="http://www.w3.org/2000/svg"
        y={cy - STATUS_DOT_RADIUS}>
        {isSelected && (
          // Marks the run the details card is showing, so the selection reads
          // from the point itself rather than only from the guide line.
          <circle
            aria-hidden="true"
            cx={STATUS_DOT_RADIUS}
            cy={STATUS_DOT_RADIUS}
            data-testid="selected-point-halo"
            fill={fill}
            fillOpacity={SELECTED_DOT_HALO.opacity}
            pointerEvents="none"
            r={STATUS_DOT_RADIUS + SELECTED_DOT_HALO.spread}
          />
        )}
        <circle
          aria-label={`${formatDateTimeLong(
            payload.name,
            DATE_TIME_12_HOUR_FORMAT
          )}: ${String(payload.status ?? '')}`}
          className="test-summary-point"
          cx={STATUS_DOT_RADIUS}
          cy={STATUS_DOT_RADIUS}
          data-status={payload.status}
          data-testid={`test-summary-point-${pointKey}`}
          fill={isHollow ? 'none' : fill}
          // A hollow circle only hit-tests its stroke; keep the whole disc
          // clickable so the ring is as easy to select as a filled dot.
          pointerEvents="all"
          r={
            isHollow
              ? STATUS_DOT_RADIUS - STATUS_DOT_RING_WIDTH / 2
              : STATUS_DOT_RADIUS
          }
          role="img"
          // Filled dots take an outline in the surface colour, which lifts them
          // off the line they sit on; the ring's own stroke is its colour.
          stroke={isHollow ? fill : DOT_OUTLINE}
          strokeWidth={isHollow ? STATUS_DOT_RING_WIDTH : 1}
          tabIndex={0}
          onBlur={handleTooltipClose}
          onClick={() => handleRunSelect(payload.name)}
          onFocus={() => handleTooltipOpen(cx, cy, payload)}
          onKeyDown={handleTooltipKeyDown}
          onMouseEnter={() => handleTooltipOpen(cx, cy, payload)}
          onMouseLeave={handleTooltipClose}
        />
      </svg>
    );
  };

  // A ReferenceLine with no `y` draws nothing, so the expectation line was
  // absent for every test: the parameter name was passed as its label and the
  // value it should sit at was never supplied.
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

  const referenceArea = useMemo(() => {
    if (!thresholdReference) {
      return <></>;
    }

    return (
      <ReferenceLine
        stroke={GRAY_700}
        strokeDasharray="4"
        y={thresholdReference.y}
      />
    );
  }, [thresholdReference]);

  // The label is a second, strokeless line drawn after the series. Recharts
  // paints in child order, so a label attached to the line underneath would
  // have every run near the expected value drawn straight through it. The
  // surface-coloured halo then clears the dots and path behind the text.
  const expectationLabel = useMemo(() => {
    if (!thresholdReference) {
      return <></>;
    }

    return (
      <ReferenceLine
        data-testid="expectation-label"
        label={{
          fill: GRAY_700,
          fontSize: 12,
          fontWeight: 600,
          paintOrder: 'stroke',
          position: 'insideBottomRight',
          stroke: DOT_OUTLINE,
          strokeLinejoin: 'round',
          strokeWidth: EXPECTATION_LABEL_HALO,
          value: t(thresholdReference.labelKey, {
            value: thresholdReference.labelValue,
          }),
        }}
        stroke="none"
        y={thresholdReference.y}
      />
    );
  }, [thresholdReference, t]);

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
      <ResponsiveContainer
        className="custom-test-summary-graph"
        id={`${testCaseName}_graph`}
        minHeight={minHeight ?? 400}>
        <ComposedChart data={plottedData} margin={TEST_SUMMARY_CHART_MARGIN}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis
            angle={-45}
            dataKey="name"
            domain={['auto', 'auto']}
            // The newest run is selected by default and sits at the right edge;
            // its halo needs room there or the plot clips it.
            padding={{
              left: SELECTED_DOT_EDGE_PADDING,
              right: SELECTED_DOT_EDGE_PADDING,
            }}
            scale="time"
            textAnchor="end"
            tick={{ fill: axis, fontSize: 12 }}
            tickFormatter={(date) =>
              formatDateTimeLong(date, DATE_TIME_12_HOUR_FORMAT)
            }
            type="number"
          />
          <YAxis
            allowDataOverflow
            axisLine={false}
            domain={['min', 'max']}
            padding={{ top: 8, bottom: 8 }}
            tick={{ fill: axis, fontSize: 12 }}
            tickFormatter={formatYAxis}
            width={80}
          />
          <Tooltip
            active={Boolean(activeTooltip)}
            content={
              <TestSummaryTooltipContent
                activeTooltip={activeTooltip}
                onMeasure={handleTooltipMeasure}
                onMouseEnter={cancelTooltipClose}
                onMouseLeave={handleTooltipClose}
              />
            }
            cursor={false}
            isAnimationActive={false}
            // Recharts otherwise flips the tooltip after measuring its content,
            // moving the incident link away from a pointer already over it.
            // ComposedChart replaces Tooltip.coordinate with the live pointer;
            // position keeps interactive content anchored to its triggering dot.
            position={activeTooltip?.position}
            wrapperStyle={{
              pointerEvents: 'auto',
              visibility: activeTooltip ? 'visible' : 'hidden',
              // Recharts exposes the active wrapper before measuring its content.
              // Seed its transform so the first frame does not render at the origin.
              transform: activeTooltip
                ? `translate(${activeTooltip.position.x}px, ${activeTooltip.position.y}px)`
                : undefined,
            }}
          />
          {referenceArea}
          {!isUndefined(activeRunTimestamp) && (
            <ReferenceLine
              data-testid="run-selection-guide"
              stroke={RED_3}
              x={activeRunTimestamp}
            />
          )}
          <Legend
            payload={customLegendPayLoad}
            wrapperStyle={{ bottom: 2 }}
            onClick={handleLegendClick}
            onMouseEnter={handleLegendMouseEnter}
            onMouseLeave={handleLegendMouseLeave}
          />
          <Area
            connectNulls
            activeDot={false}
            dataKey="boundArea"
            dot={false}
            fill={GREEN_3_OPACITY}
            stroke={GREEN_3}
            strokeDasharray="4"
            type="monotone"
          />
          {isSingleSeries &&
            chartData.information.map((info) => (
              // The mock shades the area under the line, not a fixed band:
              // the wash follows each run down and leaves the plot above the
              // line clear. Only a single series gets it; under several they
              // would overlap and the shading would stop meaning anything.
              <Area
                activeDot={false}
                data-testid="series-area"
                dataKey={info.label}
                dot={false}
                fill={PLOT_BACKGROUND}
                // Translucent, as in the mock, so the grid reads through it.
                fillOpacity={PLOT_BACKGROUND_OPACITY}
                isAnimationActive={false}
                key={`${info.label}-area`}
                legendType="none"
                stroke="none"
                type="linear"
              />
            ))}
          {chartData?.information?.map((info) => (
            <Line
              activeDot={false}
              dataKey={info.label}
              dot={renderStatusDot}
              hide={
                activeKeys.length && info.label !== activeMouseHoverKey
                  ? !activeKeys.includes(info.label)
                  : false
              }
              key={info.label}
              stroke={getSeriesColor(info.color)}
              strokeOpacity={
                isEmpty(activeMouseHoverKey) ||
                info.label === activeMouseHoverKey
                  ? DEFAULT_CHART_OPACITY
                  : HOVER_CHART_OPACITY
              }
              type="linear"
            />
          ))}
          {expectationLabel}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2 tw:px-4 tw:pb-2">
        <TestSummaryStatusKey statuses={plottedStatuses} />
        <span
          className="tw:text-xs tw:text-tertiary"
          data-testid="run-selection-hint">
          {t('message.click-a-point-for-run-details')}
        </span>
      </div>
    </Box>
  );
}

export default TestSummaryGraph;
