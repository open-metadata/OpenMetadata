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
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Select,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import { isUndefined, values } from 'lodash';
import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Rectangle,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import { GRAPH_BACKGROUND_COLOR } from '../../../../constants/constants';
import {
  CreateDIChart,
  Function as FunctionEnum,
} from '../../../../generated/api/dataInsightNew/createDIChart';
import { postAggregateChartData } from '../../../../rest/dataInsightPocAPI';
import {
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../../../utils/date-time/DateTimeUtils';
import { useAdvanceSearch } from '../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component';
import { WidgetFormProps } from './WidgetForm.interface';
import { INDEX_FIELDS } from './data';

const ChartWidgetForm = ({ onCancel }: WidgetFormProps) => {
  const [form] = Form.useForm();
  const [formState, setFormState] = useState<Record<string, string>>({
    name: 'custom-chart',
    xAxis: 'date',
    chartType: 'line',
  });
  const [graphData, setGraphData] = useState<
    {
      date: string;
      value: number;
    }[]
  >([]);
  const { toggleModal, sqlQuery } = useAdvanceSearch();

  const getGraphData = async (data: CreateDIChart) => {
    const params = {
      start: getCurrentMillis(),
      end: getEpochMillisForPastDays(7),
    };
    try {
      const response = await postAggregateChartData(params, data);
      console.log(response);
    } catch (error) {
      //
    }
  };

  useEffect(() => {
    if (!isUndefined(formState?.method)) {
      if (
        formState.method === 'function' &&
        !isUndefined(formState?.field) &&
        !isUndefined(formState?.function)
      ) {
        getGraphData({
          name: formState.name,
          field: formState.field,
          function: formState.function as CreateDIChart['function'],
          groupBy: formState.groupBy,
        });
      } else if (
        formState.method === 'formula' &&
        !isUndefined(formState?.formula)
      ) {
        // getGraphData({
        //   name: formState.name,
        //   field: formState.field,
        //   function: formState.function as CreateDIChart['function'],
        //   groupBy: formState.groupBy,
        // });
      }
    }
  }, [formState]);

  return (
    <Row gutter={[16, 16]}>
      <Col span={8}>Form</Col>
      <Col span={16}>Preview</Col>
      <Col span={8}>
        <Form
          form={form}
          initialValues={formState}
          layout="vertical"
          onValuesChange={(_, allValues) => {
            setFormState(allValues); // This logs all field values
          }}>
          <Form.Item label="Name" name="name">
            <Input placeholder="Enter Name of chart" />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input placeholder="Enter description of chart" />
          </Form.Item>
          <Form.Item label="Chart Type" name="chartType">
            <Select placeholder="Select Chart Type">
              <Select.Option value="line">Line</Select.Option>
              <Select.Option value="bar">Bar</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="Method" name="method">
            <Select placeholder="Select Method">
              <Select.Option value="function">Function</Select.Option>
              <Select.Option value="formula">Formula</Select.Option>
            </Select>
          </Form.Item>
          {formState?.method === 'function' && (
            <>
              <Form.Item label="Function" name="function">
                <Select placeholder="Select Function">
                  {values(FunctionEnum).map((func) => (
                    <Select.Option key={func} value={func}>
                      {func}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item label="Field" name="field">
                <Select showSearch placeholder="Select Field">
                  {INDEX_FIELDS.map((field) => (
                    <Select.Option key={field} value={field}>
                      {field}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </>
          )}
          {formState?.method === 'formula' && (
            <Form.Item label="Formula" name="formula">
              <Input.TextArea placeholder="Enter Formula" />
            </Form.Item>
          )}

          <Form.Item label="Group by" name="groupBy">
            <Select placeholder="Select Group by">
              {INDEX_FIELDS.map((field) => (
                <Select.Option showSearch key={field} value={field}>
                  {field}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="Filter">
            {sqlQuery ? (
              <Space
                align="center"
                className="w-full advanced-filter-text justify-between">
                <Typography data-testid="advance-search-filter-text">
                  {sqlQuery}
                </Typography>
                <Button
                  className="flex-center"
                  data-testid="advance-search-filter-btn"
                  icon={<EditIcon width={16} />}
                  type="text"
                  onClick={() => toggleModal(true)}
                />
              </Space>
            ) : (
              <Button type="default" onClick={() => toggleModal(true)}>
                Add Advance Filter
              </Button>
            )}
          </Form.Item>
          <Form.Item label="X-Axis Label" name="xAxisLabel">
            <Input placeholder="Enter X-Axis Label" />
          </Form.Item>
          <Form.Item label="X-Axis" name="xAxis">
            <Select disabled placeholder="Select X-Axis">
              <Select.Option value="date">Date</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="Y-Axis Label" name="yAxisLabel">
            <Input placeholder="Enter Y-Axis Label" />
          </Form.Item>
        </Form>
      </Col>
      <Col span={16}>
        <Card>
          {formState?.chartType === 'line' && (
            <ResponsiveContainer
              aspect={500 / 300}
              debounce={1}
              height="100%"
              width="100%">
              <LineChart
                data={graphData}
                height={300}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 50,
                }}
                width={500}>
                <CartesianGrid
                  stroke={GRAPH_BACKGROUND_COLOR}
                  vertical={false}
                />
                <Tooltip />
                <XAxis
                  dataKey="date"
                  label={{
                    value: formState?.xAxisLabel,
                    position: 'insideBottom',
                    offset: -10,
                  }}
                />
                <YAxis
                  label={{
                    value: formState?.yAxisLabel,
                    angle: -90,
                    position: 'insideLeft',
                  }}
                />
                <Line dataKey="value" stroke="#82ca9d" type="monotone" />
              </LineChart>
            </ResponsiveContainer>
          )}

          {formState?.chartType === 'bar' && (
            <ResponsiveContainer aspect={500 / 300} height="100%" width="100%">
              <BarChart
                data={graphData}
                height={300}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 50,
                }}
                width={500}>
                <CartesianGrid
                  stroke={GRAPH_BACKGROUND_COLOR}
                  vertical={false}
                />
                <Tooltip />
                <XAxis
                  dataKey="date"
                  label={{
                    value: formState?.xAxisLabel,
                    position: 'insideBottom',
                    offset: -10,
                  }}
                />
                <YAxis
                  label={{
                    value: formState?.yAxisLabel,
                    angle: -90,
                    position: 'insideLeft',
                  }}
                />
                <Bar
                  activeBar={<Rectangle fill="pink" stroke="blue" />}
                  dataKey="value"
                  fill="#8884d8"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </Col>
      <Col className="d-flex justify-end gap-2" span={24}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary">Submit</Button>
      </Col>
    </Row>
  );
};

export default ChartWidgetForm;
