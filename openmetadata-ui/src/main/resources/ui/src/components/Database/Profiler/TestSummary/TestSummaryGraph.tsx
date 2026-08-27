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
import { isEmpty } from 'lodash';
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
  GREEN_3,
  GREEN_3_OPACITY,
} from '../../../../constants/Color.constants';
import {
  DEFAULT_CHART_OPACITY,
  GRAPH_BACKGROUND_COLOR,
  HOVER_CHART_OPACITY,
} from '../../../../constants/constants';
import {
  TABLE_DATA_TO_BE_FRESH,
  TABLE_FRESHNESS_KEY,
} from '../../../../constants/TestSuite.constant';
import { useTestCaseStore } from '../../../../pages/IncidentManager/IncidentManagerDetailPage/useTestCase.store';
import { getTaskById } from '../../../../rest/tasksAPI';
import { updateActiveChartFilter } from '../../../../utils/ChartUtils';
import {
  formatTestSummaryYAxis,
  getStatusDotColor,
  getTestSummaryTooltipPosition,
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
import {
  STATUS_DOT_RADIUS,
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
  const { setShowAILearningBanner } = useTestCaseStore();
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

  const customLegendPayLoad = useMemo(() => {
    const legendPayload: Payload[] = chartData?.information.map((info) => ({
      value: info.label,
      dataKey: info.label,
      type: 'line',
      color: info.color,
      inactive: !(activeKeys.length === 0 || activeKeys.includes(info.label)),
    }));

    return legendPayload;
  }, [chartData?.information, activeKeys]);

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

  const renderStatusDot: LineProps['dot'] = (
    props
  ): ReactElement<SVGElement> => {
    const { cx = 0, cy = 0, dataKey, payload } = props;
    const fill = getStatusDotColor(payload.status);
    const pointKey = String(dataKey);

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
        <circle
          aria-label={`${formatDateTimeLong(
            payload.name,
            DATE_TIME_12_HOUR_FORMAT
          )}: ${String(payload.status ?? '')}`}
          className="test-summary-point"
          cx={STATUS_DOT_RADIUS}
          cy={STATUS_DOT_RADIUS}
          data-testid={`test-summary-point-${pointKey}`}
          fill={fill}
          r={STATUS_DOT_RADIUS}
          role="img"
          tabIndex={0}
          onBlur={handleTooltipClose}
          onFocus={() => handleTooltipOpen(cx, cy, payload)}
          onKeyDown={handleTooltipKeyDown}
          onMouseEnter={() => handleTooltipOpen(cx, cy, payload)}
          onMouseLeave={handleTooltipClose}
        />
      </svg>
    );
  };

  const referenceArea = useMemo(() => {
    const params = testCaseParameterValue ?? [];

    if (params.length === 1) {
      return (
        <ReferenceLine
          label={params[0].name}
          stroke={GREEN_3}
          strokeDasharray="4"
        />
      );
    }

    return <></>;
  }, [testCaseParameterValue]);

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
    <ResponsiveContainer
      className="bg-white custom-test-summary-graph"
      id={`${testCaseName}_graph`}
      minHeight={minHeight ?? 400}>
      <ComposedChart data={chartData.data} margin={TEST_SUMMARY_CHART_MARGIN}>
        <CartesianGrid stroke={GRAPH_BACKGROUND_COLOR} />
        <XAxis
          angle={-45}
          dataKey="name"
          domain={['auto', 'auto']}
          padding={{ left: 8, right: 8 }}
          scale="time"
          textAnchor="end"
          tick={{ fontSize: 12 }}
          tickFormatter={(date) =>
            formatDateTimeLong(date, DATE_TIME_12_HOUR_FORMAT)
          }
          type="number"
        />
        <YAxis
          allowDataOverflow
          domain={['min', 'max']}
          padding={{ top: 8, bottom: 8 }}
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
            stroke={info.color}
            strokeOpacity={
              isEmpty(activeMouseHoverKey) || info.label === activeMouseHoverKey
                ? DEFAULT_CHART_OPACITY
                : HOVER_CHART_OPACITY
            }
            type="monotone"
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export default TestSummaryGraph;
