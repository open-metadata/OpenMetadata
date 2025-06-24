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
  CheckCircleOutlined,
  FilterOutlined,
  SnippetsOutlined,
} from '@ant-design/icons';
import { Card, Col, Row, Space, Typography } from 'antd';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  BLUE_2,
  GREEN_3,
  RED_3,
  YELLOW_2,
} from '../../../constants/Color.constants';
import { formatNumberWithComma } from '../../../utils/CommonUtils';
import './pie-chart-summary-panel.style.less';
import { SummaryPanelProps } from './SummaryPanel.interface';

const PieChartSummaryPanel = ({
  testSummary,
  isLoading = false,
  showAdditionalSummary = true,
}: SummaryPanelProps) => {
  const { t } = useTranslation();
  const {
    total: totalTests = 0,
    success: successTests = 0,
    failed: failedTests = 0,
    aborted: abortedTests = 0,
    healthy: healthyDataAssets = 0,
    totalDQEntities = 0,
    totalEntityCount = 0,
  } = testSummary || {};

  const totalDataAssets = totalDQEntities;
  const dataAssetsCoverage = totalDQEntities;

  const testData = useMemo(() => {
    return [
      { name: 'Success', value: successTests, color: GREEN_3 },
      { name: 'Aborted', value: abortedTests, color: YELLOW_2 },
      { name: 'Failed', value: failedTests, color: RED_3 },
    ];
  }, [successTests, abortedTests, failedTests]);

  const healthyPercentage = useMemo(() => {
    if (totalDataAssets === 0) {
      return 0;
    }

    return Math.round((healthyDataAssets / totalDataAssets) * 100);
  }, [healthyDataAssets, totalDataAssets]);

  const coveragePercentage = useMemo(() => {
    if (totalEntityCount === 0) {
      return 0;
    }

    return Math.round((dataAssetsCoverage / totalEntityCount) * 100);
  }, [dataAssetsCoverage, totalEntityCount]);

  const healthyData = useMemo(() => {
    const unhealthy = totalDataAssets - healthyDataAssets;

    return [
      { name: 'Healthy', value: healthyDataAssets, color: GREEN_3 },
      { name: 'Unhealthy', value: unhealthy, color: '#E5E7EB' },
    ];
  }, [healthyDataAssets, totalDataAssets]);

  const coverageData = useMemo(() => {
    const uncovered = totalEntityCount - dataAssetsCoverage;

    return [
      { name: 'Covered', value: dataAssetsCoverage, color: BLUE_2 },
      { name: 'Uncovered', value: uncovered, color: '#E5E7EB' },
    ];
  }, [dataAssetsCoverage, totalEntityCount]);

  return (
    <Row className="pie-chart-summary-panel" gutter={[16, 16]}>
      <Col md={8} sm={24} xs={24}>
        <Card className="h-full" loading={isLoading}>
          <div className="d-flex justify-between items-center">
            <div className="d-flex items-center gap-4">
              <FilterOutlined className="summary-icon total-tests-icon" />
              <div>
                <Typography.Paragraph className="summary-title">
                  {t('label.total-entity', {
                    entity: t('label.test-plural'),
                  })}
                </Typography.Paragraph>

                <Typography.Paragraph className="summary-value m-b-0">
                  {formatNumberWithComma(totalTests)}
                </Typography.Paragraph>
              </div>
            </div>

            <div className="chart-container d-flex items-center">
              <Space className="m-r-md" direction="vertical" size={4}>
                {testData.map((item) => (
                  <Space key={item.name} size={8}>
                    <div
                      className="legend-dot"
                      style={{ backgroundColor: item.color }}
                    />
                    <Typography.Text className="legend-text">
                      {item.name} {formatNumberWithComma(item.value)}
                    </Typography.Text>
                  </Space>
                ))}
              </Space>
              <ResponsiveContainer height={120} width={120}>
                <PieChart>
                  <Pie
                    cx="50%"
                    cy="50%"
                    data={testData}
                    dataKey="value"
                    innerRadius={35}
                    outerRadius={55}
                    paddingAngle={2}>
                    {testData.map((entry, index) => (
                      <Cell fill={entry.color} key={`cell-${index}`} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <text
                    className="chart-center-text"
                    dominantBaseline="middle"
                    textAnchor="middle"
                    x="50%"
                    y="50%">
                    100%
                  </text>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </Col>

      {showAdditionalSummary && (
        <>
          <Col md={8} sm={24} xs={24}>
            <Card className="h-full" loading={isLoading}>
              <div className="d-flex justify-between items-center">
                <div className="d-flex items-center gap-4">
                  <CheckCircleOutlined className="summary-icon healthy-icon" />
                  <div>
                    <Typography.Paragraph className="summary-title">
                      {t('label.healthy-data-asset-plural')}
                    </Typography.Paragraph>

                    <Typography.Paragraph className="summary-value m-b-0">
                      {formatNumberWithComma(healthyDataAssets)}
                    </Typography.Paragraph>
                  </div>
                </div>
                <div className="chart-container">
                  <ResponsiveContainer height={120} width={120}>
                    <PieChart>
                      <Pie
                        cx="50%"
                        cy="50%"
                        data={healthyData}
                        dataKey="value"
                        innerRadius={35}
                        outerRadius={55}
                        paddingAngle={0}>
                        {healthyData.map((entry, index) => (
                          <Cell fill={entry.color} key={`cell-${index}`} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <text
                        className="chart-center-text"
                        dominantBaseline="middle"
                        textAnchor="middle"
                        x="50%"
                        y="50%">
                        {`${healthyPercentage}%`}
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>
          </Col>

          <Col md={8} sm={24} xs={24}>
            <Card className="h-full" loading={isLoading}>
              <div className="d-flex justify-between items-center">
                <div className="d-flex items-center gap-4">
                  <SnippetsOutlined className="summary-icon coverage-icon" />
                  <div>
                    <Typography.Paragraph className="summary-title">
                      {t('label.data-asset-plural-coverage')}
                    </Typography.Paragraph>

                    <Typography.Paragraph className="summary-value m-b-0">
                      {formatNumberWithComma(dataAssetsCoverage)}
                    </Typography.Paragraph>
                  </div>
                </div>
                <div className="chart-container">
                  <ResponsiveContainer height={120} width={120}>
                    <PieChart>
                      <Pie
                        cx="50%"
                        cy="50%"
                        data={coverageData}
                        dataKey="value"
                        innerRadius={35}
                        outerRadius={55}
                        paddingAngle={0}>
                        {coverageData.map((entry, index) => (
                          <Cell fill={entry.color} key={`cell-${index}`} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <text
                        className="chart-center-text"
                        dominantBaseline="middle"
                        textAnchor="middle"
                        x="50%"
                        y="50%">
                        {`${coveragePercentage}%`}
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>
          </Col>
        </>
      )}
    </Row>
  );
};

export default PieChartSummaryPanel;
