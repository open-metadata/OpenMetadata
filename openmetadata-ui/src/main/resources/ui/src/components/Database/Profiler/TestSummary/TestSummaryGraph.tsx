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
import { first, isEmpty, isUndefined } from 'lodash';
import { ReactElement, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  LegendProps,
  Line,
  LineProps,
  ReferenceArea,
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
  RED_3,
  RED_3_OPACITY,
  YELLOW_2,
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
import {
  Thread,
  ThreadTaskStatus,
} from '../../../../generated/entity/feed/thread';
import { TestCaseStatus } from '../../../../generated/tests/testCase';
import { useTestCaseStore } from '../../../../pages/IncidentManager/IncidentManagerDetailPage/useTestCase.store';
import {
  axisTickFormatter,
  updateActiveChartFilter,
} from '../../../../utils/ChartUtils';
import { prepareChartData } from '../../../../utils/DataQuality/TestSummaryGraphUtils';
import {
  convertMillisecondsToHumanReadableFormat,
  formatDateTime,
} from '../../../../utils/date-time/DateTimeUtils';
import { useActivityFeedProvider } from '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { LineChartRef } from '../ProfilerDashboard/profilerDashboard.interface';
import TestSummaryCustomTooltip from '../TestSummaryCustomTooltip/TestSummaryCustomTooltip.component';
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

    // if tooltip is near the right edge of the chart, reduce edge offset
    return chartMouseEvent?.chartX &&
      chartMouseEvent.chartX + 200 > chartContainer?.width
      ? -20
      : -200;
  }, [chartRef, chartMouseEvent]);

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

  const incidentData = useMemo(() => {
    const data = chartData.data ?? [];

    const issueData = entityThread.map((task) => {
      const failedRows = data.filter(
        (chart) => task.task?.testCaseResolutionStatusId === chart.incidentId
      );
      const x2 =
        task.task?.status === ThreadTaskStatus.Closed
          ? task.task?.closedAt
          : undefined;

      return {
        x1: first(failedRows)?.name,
        x2,
        task,
      };
    });

    return issueData as {
      x1?: string | number;
      x2?: string | number;
      task: Thread;
    }[];
  }, [entityThread, chartData]);

  const customLegendPayLoad = useMemo(() => {
    const legendPayload: Payload[] = chartData?.information.map((info) => ({
      value: info.label,
      dataKey: info.label,
      type: 'line',
      color: info.color,
      inactive: !(activeKeys.length === 0 || activeKeys.includes(info.label)),
    }));

    legendPayload.push({
      value: 'Incident',
      dataKey: 'Incident',
      type: 'rect',
      color: RED_3,
    } as Payload);

    return legendPayload;
  }, [chartData?.information, activeKeys]);

  const handleLegendClick: LegendProps['onClick'] = (event) => {
    if (event.dataKey === 'Incident') {
      return;
    }

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

  // Todo: need to find better approach to create dynamic scale for graph, need to work with @TeddyCr for the same!
  const formatYAxis = (value: number) => {
    return testDefinitionName === TABLE_DATA_TO_BE_FRESH || isFreshnessTest
      ? // table freshness will always have output value in seconds, so we need to convert it to milliseconds
        convertMillisecondsToHumanReadableFormat(value * 1000, 2)
      : axisTickFormatter(value);
  };

  const updatedDot: LineProps['dot'] = (props): ReactElement<SVGElement> => {
    const { cx = 0, cy = 0, payload } = props;
    let fill = payload.status === TestCaseStatus.Success ? GREEN_3 : undefined;

    if (isUndefined(fill)) {
      fill = payload.status === TestCaseStatus.Failed ? RED_3 : YELLOW_2;
    }

    return (
      <svg
        fill="none"
        height={8}
        width={8}
        x={cx - 4}
        xmlns="http://www.w3.org/2000/svg"
        y={cy - 4}>
        <circle cx={4} cy={4} fill={fill} r={4} />
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
        margin={{
          top: 16,
          bottom: 16,
          right: 40,
        }}
        ref={chartRef}
        onMouseMove={(e) => {
          setChartMouseEvent(e);
        }}>
        <CartesianGrid stroke={GRAPH_BACKGROUND_COLOR} />
        <XAxis
          dataKey="name"
          domain={['auto', 'auto']}
          padding={{ left: 8, right: 8 }}
          scale="time"
          tickFormatter={formatDateTime}
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
            dot={updatedDot}
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

        {incidentData.length > 0 &&
          incidentData.map((data) => (
            <ReferenceArea
              fill={RED_3_OPACITY}
              ifOverflow="extendDomain"
              key={data.task.id}
              x1={data.x1}
              x2={data.x2}
            />
          ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export default TestSummaryGraph;
