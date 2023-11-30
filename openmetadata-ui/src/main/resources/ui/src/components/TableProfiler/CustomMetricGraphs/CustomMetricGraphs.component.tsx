/*
 *  Copyright 2023 Collate.
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
import { Button, Card, Col, Dropdown, Row, Typography } from 'antd';
import { isEmpty, last, toPairs } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ReactComponent as IconDropdown } from '../../../assets/svg/menu.svg';
import { GRAPH_BACKGROUND_COLOR } from '../../../constants/constants';
import { TOTAL_ENTITY_CHART_COLOR } from '../../../constants/DataInsight.constants';
import { axisTickFormatter, tooltipFormatter } from '../../../utils/ChartUtils';
import { getRandomHexColor } from '../../../utils/DataInsightUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import ProfilerLatestValue from '../../ProfilerDashboard/component/ProfilerLatestValue';
import { useTableProfiler } from '../TableProfilerProvider';
import './custom-metric-graphs.style.less';
import { CustomMetricGraphsProps } from './CustomMetricGraphs.interface';

const CustomMetricGraphs = ({
  customMetricsGraphData,
  isLoading,
}: // customMetrics,
CustomMetricGraphsProps) => {
  const { t } = useTranslation();
  const { permissions } = useTableProfiler();
  const editPermission =
    permissions?.EditAll || permissions?.EditDataProfile || false;
  const deletePermission = permissions?.Delete || false;

  const items = useMemo(
    () => [
      {
        key: 'edit',
        label: t('label.edit'),
        // onClick: () => console.log('edit'),
        disabled: !editPermission,
      },
      {
        key: 'delete',
        label: t('label.delete'),
        // onClick: () => console.log('delete'),
        disabled: !deletePermission,
      },
    ],
    []
  );

  return (
    <Row gutter={[16, 16]}>
      {toPairs(customMetricsGraphData).map(([key, metric], i) => {
        const color = TOTAL_ENTITY_CHART_COLOR[i] ?? getRandomHexColor();

        return (
          <Col key={key} span={24}>
            <Card
              className="shadow-none global-border-radius custom-metric-card"
              data-testid={`${key}-custom-metrics`}
              extra={
                editPermission || deletePermission ? (
                  <Dropdown
                    menu={{ items }}
                    placement="bottomLeft"
                    trigger={['click']}>
                    <Button
                      className="flex-center"
                      icon={<IconDropdown className="self-center" />}
                      size="small"
                    />
                  </Dropdown>
                ) : null
              }
              loading={isLoading}
              title={
                <Typography.Title level={5}>
                  {t('label.custom-metric')}
                </Typography.Title>
              }>
              <Row gutter={[16, 16]}>
                <Col span={4}>
                  <ProfilerLatestValue
                    information={[
                      {
                        latestValue: last(metric)?.[key] ?? '--',
                        title: key,
                        dataKey: key,
                        color,
                      },
                    ]}
                  />
                </Col>
                <Col span={20}>
                  {isEmpty(metric) ? (
                    <Row
                      align="middle"
                      className="h-full w-full"
                      justify="center">
                      <Col>
                        <ErrorPlaceHolder className="mt-0-important" />
                      </Col>
                    </Row>
                  ) : (
                    <ResponsiveContainer
                      className="custom-legend"
                      debounce={200}
                      id={`${key}_graph`}
                      minHeight={300}>
                      <LineChart
                        className="w-full"
                        data={metric}
                        margin={{ left: 16 }}>
                        <CartesianGrid stroke={GRAPH_BACKGROUND_COLOR} />
                        <XAxis
                          dataKey="formattedTimestamp"
                          padding={{ left: 16, right: 16 }}
                          tick={{ fontSize: 12 }}
                        />

                        <YAxis
                          padding={{ top: 16, bottom: 16 }}
                          tick={{ fontSize: 12 }}
                          tickFormatter={(props) => axisTickFormatter(props)}
                          type="category"
                        />
                        <Tooltip
                          formatter={(value: number | string) =>
                            tooltipFormatter(value)
                          }
                        />

                        <Line
                          dataKey={key}
                          name={key}
                          stroke={color}
                          type="monotone"
                        />

                        <Legend />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </Col>
              </Row>
            </Card>
          </Col>
        );
      })}
    </Row>
  );
};

export default CustomMetricGraphs;
