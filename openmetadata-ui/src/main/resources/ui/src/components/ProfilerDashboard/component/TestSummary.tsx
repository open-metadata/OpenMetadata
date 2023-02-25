/*
 *  Copyright 2022 Collate.
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

import { Col, Row, Select, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { t } from 'i18next';
import { isEmpty } from 'lodash';
import React, { ReactElement, useEffect, useMemo, useState } from 'react';
import {
  Legend,
  Line,
  LineChart,
  LineProps,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getListTestCaseResults } from 'rest/testAPI';
import {
  COLORS,
  PROFILER_FILTER_RANGE,
} from '../../../constants/profiler.constant';
import { CSMode } from '../../../enums/codemirror.enum';
import { SIZE } from '../../../enums/common.enum';
import {
  TestCaseParameterValue,
  TestCaseResult,
  TestCaseStatus,
} from '../../../generated/tests/testCase';
import { axisTickFormatter } from '../../../utils/ChartUtils';
import { getEncodedFqn } from '../../../utils/StringsUtils';
import {
  getCurrentDateTimeStamp,
  getFormattedDateFromSeconds,
  getPastDatesTimeStampFromCurrentDate,
} from '../../../utils/TimeUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/error-with-placeholder/ErrorPlaceHolder';
import RichTextEditorPreviewer from '../../common/rich-text-editor/RichTextEditorPreviewer';
import Loader from '../../Loader/Loader';
import SchemaEditor from '../../schema-editor/SchemaEditor';
import { TestSummaryProps } from '../profilerDashboard.interface';

type ChartDataType = {
  information: { label: string; color: string }[];
  data: { [key: string]: string }[];
};

const TestSummary: React.FC<TestSummaryProps> = ({ data }) => {
  const [chartData, setChartData] = useState<ChartDataType>(
    {} as ChartDataType
  );
  const [results, setResults] = useState<TestCaseResult[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] =
    useState<keyof typeof PROFILER_FILTER_RANGE>('last3days');
  const [isLoading, setIsLoading] = useState(true);

  const timeRangeOption = useMemo(() => {
    return Object.entries(PROFILER_FILTER_RANGE).map(([key, value]) => ({
      label: value.title,
      value: key,
    }));
  }, []);

  const handleTimeRangeChange = (value: keyof typeof PROFILER_FILTER_RANGE) => {
    if (value !== selectedTimeRange) {
      setSelectedTimeRange(value);
    }
  };

  const generateChartData = (currentData: TestCaseResult[]) => {
    const chartData: { [key: string]: string }[] = [];
    currentData.forEach((result) => {
      const values = result.testResultValue?.reduce((acc, curr) => {
        return {
          ...acc,
          [curr.name || 'value']: parseInt(curr.value || '') || 0,
        };
      }, {});

      chartData.push({
        name: getFormattedDateFromSeconds(result.timestamp as number),
        status: result.testCaseStatus || '',
        ...values,
      });
    });
    setChartData({
      information:
        currentData[0]?.testResultValue?.map((info, i) => ({
          label: info.name || '',
          color: COLORS[i],
        })) || [],
      data: chartData.reverse(),
    });
  };

  const updatedDot: LineProps['dot'] = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    props: any
  ): ReactElement<SVGElement> => {
    const { cx = 0, cy = 0, payload } = props;
    const fill =
      payload.status === TestCaseStatus.Success
        ? '#28A745'
        : payload.status === TestCaseStatus.Failed
        ? '#CB2431'
        : '#EFAE2F';

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

  const fetchTestResults = async () => {
    if (isEmpty(data)) {
      return;
    }

    try {
      const startTs = getPastDatesTimeStampFromCurrentDate(
        PROFILER_FILTER_RANGE[selectedTimeRange].days
      );

      const endTs = getCurrentDateTimeStamp();

      const { data: chartData } = await getListTestCaseResults(
        getEncodedFqn(data.fullyQualifiedName || ''),
        {
          startTs,
          endTs,
        }
      );
      setResults(chartData);
      generateChartData(chartData);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTestResults();
  }, [selectedTimeRange]);

  const showParamsData = (param: TestCaseParameterValue) => {
    const isSqlQuery = param.name === 'sqlExpression';

    if (isSqlQuery) {
      return (
        <div key={param.name}>
          <Typography.Text>{`${param.name}:`} </Typography.Text>
          <SchemaEditor
            className="tw-w-11/12 tw-mt-1"
            editorClass="table-query-editor"
            mode={{ name: CSMode.SQL }}
            options={{
              styleActiveLine: false,
            }}
            value={param.value ?? ''}
          />
        </div>
      );
    }

    return (
      <div key={param.name}>
        <Typography.Text>{`${param.name}:`} </Typography.Text>
        <Typography.Text>{param.value}</Typography.Text>
      </div>
    );
  };

  const referenceArea = () => {
    const yValues = data.parameterValues?.reduce((acc, curr, i) => {
      return { ...acc, [`y${i + 1}`]: parseInt(curr.value || '') };
    }, {});

    return (
      <ReferenceArea
        fill="#28A74530"
        ifOverflow="extendDomain"
        stroke="#28A745"
        strokeDasharray="4"
        {...yValues}
      />
    );
  };

  return (
    <Row gutter={16}>
      <Col span={16}>
        {isLoading ? (
          <Loader />
        ) : (
          <div>
            <Space align="end" className="tw-w-full" direction="vertical">
              <Select
                className="tw-w-32 tw-mb-2"
                options={timeRangeOption}
                value={selectedTimeRange}
                onChange={handleTimeRangeChange}
              />
            </Space>

            {results.length ? (
              <ResponsiveContainer
                className="tw-bg-white"
                id={`${data.name}_graph`}
                minHeight={300}>
                <LineChart
                  data={chartData.data}
                  margin={{
                    top: 8,
                    bottom: 8,
                    right: 8,
                  }}>
                  <XAxis dataKey="name" padding={{ left: 8, right: 8 }} />
                  <YAxis
                    allowDataOverflow
                    padding={{ top: 8, bottom: 8 }}
                    tickFormatter={(value) => axisTickFormatter(value)}
                  />
                  <Tooltip />
                  <Legend />
                  {data.parameterValues?.length === 2 && referenceArea()}
                  {chartData?.information?.map((info, i) => (
                    <Line
                      dataKey={info.label}
                      dot={updatedDot}
                      key={i}
                      stroke={info.color}
                      type="monotone"
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ErrorPlaceHolder classes="tw-mt-0" size={SIZE.MEDIUM}>
                <Typography.Paragraph className="m-b-md">
                  {t('message.try-different-time-period-filtering')}
                </Typography.Paragraph>
              </ErrorPlaceHolder>
            )}
          </div>
        )}
      </Col>
      <Col span={8}>
        <Row gutter={[8, 8]}>
          <Col span={24}>
            <Typography.Text type="secondary">
              {`${t('label.name')}:`}
            </Typography.Text>
            <Typography.Text>{data.displayName || data.name}</Typography.Text>
          </Col>
          <Col span={24}>
            <Typography.Text type="secondary">
              {`${t('label.parameter')}:`}
            </Typography.Text>
          </Col>
          <Col offset={1} span={24}>
            {data.parameterValues && data.parameterValues.length > 0 ? (
              data.parameterValues.map(showParamsData)
            ) : (
              <Typography.Text type="secondary">
                {t('label.no-parameter-available')}
              </Typography.Text>
            )}
          </Col>

          <Col className="tw-flex tw-gap-2" span={24}>
            <Typography.Text type="secondary">
              {`${t('label.description')}:`}{' '}
            </Typography.Text>
            <RichTextEditorPreviewer markdown={data.description || ''} />
          </Col>
        </Row>
      </Col>
    </Row>
  );
};

export default TestSummary;
