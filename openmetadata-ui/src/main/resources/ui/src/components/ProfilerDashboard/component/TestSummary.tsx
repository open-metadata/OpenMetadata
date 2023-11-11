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

import { Button, Col, Row, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { t } from 'i18next';
import { isEmpty, isEqual, isUndefined, round, uniqueId } from 'lodash';
import Qs from 'qs';
import React, { ReactElement, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
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
import { ReactComponent as ExitFullScreen } from '../../../assets/svg/exit-full-screen.svg';
import { ReactComponent as FullScreen } from '../../../assets/svg/full-screen.svg';
import {
  GREEN_3,
  GREEN_3_OPACITY,
  RED_3,
  YELLOW_2,
} from '../../../constants/Color.constants';
import {
  COLORS,
  DEFAULT_RANGE_DATA,
} from '../../../constants/profiler.constant';
import { CSMode } from '../../../enums/codemirror.enum';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import {
  TestCaseParameterValue,
  TestCaseResult,
  TestCaseStatus,
} from '../../../generated/tests/testCase';
import { getListTestCaseResults } from '../../../rest/testAPI';
import { axisTickFormatter } from '../../../utils/ChartUtils';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { getTestCaseDetailsPath } from '../../../utils/RouterUtils';
import { getEncodedFqn } from '../../../utils/StringsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import RichTextEditorPreviewer from '../../common/RichTextEditor/RichTextEditorPreviewer';
import DatePickerMenu from '../../DatePickerMenu/DatePickerMenu.component';
import Loader from '../../Loader/Loader';
import SchemaEditor from '../../SchemaEditor/SchemaEditor';
import { TestSummaryProps } from '../profilerDashboard.interface';
import './test-summary.less';

type ChartDataType = {
  information: { label: string; color: string }[];
  data: { [key: string]: string }[];
};

export interface DateRangeObject {
  startTs: number;
  endTs: number;
}

const TestSummary: React.FC<TestSummaryProps> = ({
  data,
  showExpandIcon = true,
}) => {
  const history = useHistory();
  const [chartData, setChartData] = useState<ChartDataType>(
    {} as ChartDataType
  );
  const [results, setResults] = useState<TestCaseResult[]>([]);
  const [dateRangeObject, setDateRangeObject] =
    useState<DateRangeObject>(DEFAULT_RANGE_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [isGraphLoading, setIsGraphLoading] = useState(true);

  const handleDateRangeChange = (value: DateRangeObject) => {
    if (!isEqual(value, dateRangeObject)) {
      setDateRangeObject(value);
    }
  };

  const generateChartData = (currentData: TestCaseResult[]) => {
    const chartData: { [key: string]: string }[] = [];
    currentData.forEach((result) => {
      const values = result.testResultValue?.reduce((acc, curr) => {
        return {
          ...acc,
          [curr.name ?? 'value']: round(parseFloat(curr.value ?? ''), 2) || 0,
        };
      }, {});

      chartData.push({
        name: formatDateTime(result.timestamp),
        status: result.testCaseStatus ?? '',
        ...values,
      });
    });
    chartData.reverse();
    setChartData({
      information:
        currentData[0]?.testResultValue?.map((info, i) => ({
          label: info.name ?? '',
          color: COLORS[i],
        })) ?? [],
      data: chartData,
    });
  };

  const updatedDot: LineProps['dot'] = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    props: any
  ): ReactElement<SVGElement> => {
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

  const fetchTestResults = async (dateRangeObj: DateRangeObject) => {
    if (isEmpty(data)) {
      return;
    }
    setIsGraphLoading(true);
    try {
      const { data: chartData } = await getListTestCaseResults(
        getEncodedFqn(data.fullyQualifiedName || ''),
        dateRangeObj
      );
      setResults(chartData);
      generateChartData(chartData);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
      setIsGraphLoading(false);
    }
  };

  const referenceArea = () => {
    const yValues = data.parameterValues?.reduce((acc, curr, i) => {
      return { ...acc, [`y${i + 1}`]: parseInt(curr.value || '') };
    }, {});

    return (
      <ReferenceArea
        fill={GREEN_3_OPACITY}
        ifOverflow="extendDomain"
        stroke={GREEN_3}
        strokeDasharray="4"
        {...yValues}
      />
    );
  };

  const getGraph = () => {
    if (isGraphLoading) {
      return <Loader />;
    }

    return results.length ? (
      <ResponsiveContainer
        className="bg-white"
        id={`${data.name}_graph`}
        minHeight={400}>
        <LineChart
          data={chartData.data}
          margin={{
            top: 16,
            bottom: 16,
            right: 40,
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
          {chartData?.information?.map((info) => (
            <Line
              dataKey={info.label}
              dot={updatedDot}
              key={uniqueId(info.label)}
              stroke={info.color}
              type="monotone"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    ) : (
      <ErrorPlaceHolder
        className="m-t-0"
        size={SIZE.MEDIUM}
        type={ERROR_PLACEHOLDER_TYPE.FILTER}
      />
    );
  };

  useEffect(() => {
    if (dateRangeObject) {
      fetchTestResults(dateRangeObject);
    }
  }, [dateRangeObject]);

  const parameterValuesWithSqlExpression = useMemo(
    () =>
      data.parameterValues && data.parameterValues.length > 0
        ? data.parameterValues.filter((param) => param.name === 'sqlExpression')
        : undefined,
    [data.parameterValues]
  );

  const parameterValuesWithoutSqlExpression = useMemo(
    () =>
      data.parameterValues && data.parameterValues.length > 0
        ? data.parameterValues.filter((param) => param.name !== 'sqlExpression')
        : undefined,
    [data.parameterValues]
  );

  const showParamsData = (param: TestCaseParameterValue) => {
    const isSqlQuery = param.name === 'sqlExpression';

    if (isSqlQuery) {
      return (
        <Row
          className="sql-expression-container"
          gutter={[8, 8]}
          key={param.name}>
          <Col span={24}>
            <Typography.Text className="text-grey-muted">
              {`${param.name}:`}
            </Typography.Text>
          </Col>
          <Col span={24}>
            <SchemaEditor
              editorClass="table-query-editor"
              mode={{ name: CSMode.SQL }}
              options={{
                styleActiveLine: false,
              }}
              value={param.value ?? ''}
            />
          </Col>
        </Row>
      );
    } else {
      return (
        <Col data-testid="parameter-value" key={param.name} span={24}>
          <Typography.Text className="text-grey-muted">
            {`${param.name}:`}{' '}
          </Typography.Text>
          <Typography.Text>{param.value}</Typography.Text>
        </Col>
      );
    }
  };

  const handleExpandClick = () => {
    if (data.fullyQualifiedName) {
      if (showExpandIcon) {
        history.push({
          search: Qs.stringify({ testCaseData: data }),
          pathname: getTestCaseDetailsPath(data.fullyQualifiedName),
        });
      } else {
        history.goBack();
      }
    }
  };

  const showParameters = useMemo(
    () =>
      !isUndefined(parameterValuesWithoutSqlExpression) &&
      !isEmpty(parameterValuesWithoutSqlExpression) &&
      showExpandIcon,
    [
      parameterValuesWithSqlExpression,
      parameterValuesWithoutSqlExpression,
      showExpandIcon,
    ]
  );

  return (
    <Row data-testid="test-summary-container" gutter={[0, 16]}>
      <Col span={24}>
        {isLoading ? (
          <Loader />
        ) : (
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Row gutter={16} justify="end">
                <Col>
                  <DatePickerMenu
                    showSelectedCustomRange
                    handleDateRangeChange={handleDateRangeChange}
                  />
                </Col>
                <Col>
                  <Button
                    className="flex justify-center items-center bg-white"
                    data-testid="test-case-expand-button"
                    icon={
                      showExpandIcon ? (
                        <FullScreen height={16} width={16} />
                      ) : (
                        <ExitFullScreen height={16} width={16} />
                      )
                    }
                    onClick={handleExpandClick}
                  />
                </Col>
              </Row>
            </Col>
            <Col data-testid="graph-container" span={24}>
              {getGraph()}
            </Col>
          </Row>
        )}
      </Col>
      <Col span={24}>
        <Row align="top" data-testid="params-container" gutter={[16, 16]}>
          {showParameters && (
            <Col>
              <Typography.Text className="text-grey-muted">
                {`${t('label.parameter')}:`}
              </Typography.Text>
              {!isEmpty(parameterValuesWithoutSqlExpression) ? (
                <Row className="parameter-value-container" gutter={[4, 4]}>
                  {parameterValuesWithoutSqlExpression?.map(showParamsData)}
                </Row>
              ) : (
                <Typography.Text className="m-l-xs" type="secondary">
                  {t('label.no-parameter-available')}
                </Typography.Text>
              )}
            </Col>
          )}
          {!isUndefined(parameterValuesWithSqlExpression) ? (
            <Col>{parameterValuesWithSqlExpression.map(showParamsData)}</Col>
          ) : null}
          {data.description && (
            <Col>
              <Space direction="vertical" size={4}>
                <Typography.Text className="text-grey-muted">
                  {`${t('label.description')}:`}
                </Typography.Text>
                <RichTextEditorPreviewer markdown={data.description} />
              </Space>
            </Col>
          )}
        </Row>
      </Col>
    </Row>
  );
};

export default TestSummary;
