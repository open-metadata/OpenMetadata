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

import { Typography } from 'antd';
import { isEmpty } from 'lodash';
import { ReactElement, useCallback, useMemo, useRef, useState } from 'react';
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
import { CategoricalChartState } from 'recharts/types/chart/generateCategoricalChart';
import { Payload } from 'recharts/types/component/DefaultLegendContent';
import { ReactComponent as FilterPlaceHolderIcon } from '../../../../assets/svg/no-search-placeholder.svg';
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
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { useTestCaseStore } from '../../../../pages/IncidentManager/IncidentManagerDetailPage/useTestCase.store';
import { updateActiveChartFilter } from '../../../../utils/ChartUtils';
import {
  formatTestSummaryYAxis,
  getStatusDotColor,
  prepareChartData,
} from '../../../../utils/DataQuality/TestSummaryGraphUtils';
import {
  DATE_TIME_12_HOUR_FORMAT,
  formatDateTimeLong,
} from '../../../../utils/date-time/DateTimeUtils';
import { useActivityFeedProvider } from '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { LineChartRef } from '../ProfilerDashboard/profilerDashboard.interface';
import TestSummaryCustomTooltip from '../TestSummaryCustomTooltip/TestSummaryCustomTooltip.component';
import {
  STATUS_DOT_RADIUS,
  STATUS_DOT_SIZE,
  TEST_SUMMARY_CHART_MARGIN,
  TOOLTIP_EDGE_THRESHOLD,
  TOOLTIP_OFFSET_DEFAULT,
  TOOLTIP_OFFSET_NEAR_EDGE,
} from './TestSummaryGraph.constants';
import { TestSummaryGraphProps } from './TestSummaryGraph.interface';

function TestSummaryGraph({
  testCaseName,
  testCaseParameterValue,
  testCaseResults,
  selectedTimeRange,
  minHeight,
  testDefinitionName,
}: Readonly<TestSummaryGraphProps>) {
  const { t } = useTranslation();
  const { entityThread = [] } = useActivityFeedProvider();
  const { setShowAILearningBanner } = useTestCaseStore();
  const chartRef = useRef(null);
  const [chartMouseEvent, setChartMouseEvent] =
    useState<CategoricalChartState>();
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [activeMouseHoverKey, setActiveMouseHoverKey] = useState('');

  const tooltipOffset = useMemo(() => {
    const lineChartContainer = chartRef?.current as unknown as LineChartRef;
    const chartContainer =
      lineChartContainer?.container?.getBoundingClientRect();

    return chartMouseEvent?.chartX &&
      chartMouseEvent.chartX + TOOLTIP_EDGE_THRESHOLD >
        (chartContainer?.width ?? 0)
      ? TOOLTIP_OFFSET_NEAR_EDGE
      : TOOLTIP_OFFSET_DEFAULT;
  }, [chartMouseEvent]);

  const { chartData, isFreshnessTest } = useMemo(() => {
    const data = prepareChartData({
      testCaseParameterValue: testCaseParameterValue ?? [],
      testCaseResults,
      entityThread,
    });
    setShowAILearningBanner(data.showAILearningBanner);
    const isFreshnessTest = data.information.some(
      (value) => value.label === TABLE_FRESHNESS_KEY
    );

    return { chartData: data, isFreshnessTest };
  }, [testCaseResults, entityThread, testCaseParameterValue]);

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
    const { cx = 0, cy = 0, payload } = props;
    const fill = getStatusDotColor(payload.status);

    return (
      <svg
        fill="none"
        height={STATUS_DOT_SIZE}
        width={STATUS_DOT_SIZE}
        x={cx - STATUS_DOT_RADIUS}
        xmlns="http://www.w3.org/2000/svg"
        y={cy - STATUS_DOT_RADIUS}>
        <circle
          cx={STATUS_DOT_RADIUS}
          cy={STATUS_DOT_RADIUS}
          fill={fill}
          r={STATUS_DOT_RADIUS}
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
      <ErrorPlaceHolder
        className="m-t-0"
        icon={
          <FilterPlaceHolderIcon
            className="w-24"
            data-testid="no-search-image"
          />
        }
        type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
        <Typography.Paragraph style={{ marginBottom: '0' }}>
          {t('message.no-test-result-for-days', {
            days: selectedTimeRange,
          })}
        </Typography.Paragraph>
        <Typography.Paragraph>
          {t('message.try-extending-time-frame')}
        </Typography.Paragraph>
      </ErrorPlaceHolder>
    );
  }

  return (
    <ResponsiveContainer
      className="bg-white custom-test-summary-graph"
      id={`${testCaseName}_graph`}
      minHeight={minHeight ?? 400}>
      <ComposedChart
        data={chartData.data}
        margin={TEST_SUMMARY_CHART_MARGIN}
        ref={chartRef}
        onMouseMove={(e) => {
          setChartMouseEvent(e);
        }}>
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
          content={<TestSummaryCustomTooltip />}
          offset={tooltipOffset}
          position={{ y: 100 }}
          wrapperStyle={{ pointerEvents: 'auto' }}
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
