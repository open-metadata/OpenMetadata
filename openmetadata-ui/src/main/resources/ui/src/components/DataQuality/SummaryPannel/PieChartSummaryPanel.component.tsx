import { Card, Col, Row } from 'antd';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Cell, Pie, PieChart } from 'recharts';
import { SummaryPanelProps } from './SummaryPanel.interface';

const renderCenterText = (value: number) => (
  <text
    dominantBaseline="middle"
    fill="#222"
    fontSize="28"
    fontWeight="bold"
    textAnchor="middle"
    x="50%"
    y="50%">
    {value.toLocaleString()}
  </text>
);

const PieChartSummaryPanel = ({
  testSummary,
  isLoading = false,
  showAdditionalSummary = false,
}: SummaryPanelProps) => {
  const { t } = useTranslation();
  console.log('testSummary', testSummary);

  //   {
  //     "success": 4,
  //     "failed": 3,
  //     "aborted": 1,
  //     "total": 8,
  //     "unhealthy": 1,
  //     "healthy": 1,
  //     "totalDQEntities": 2,
  //     "totalEntityCount": 36
  // }

  const success = useMemo(
    () => [
      {
        name: 'success',
        value: testSummary?.success,
        color: '#22C55E',
      },
      {
        name: 'total',
        value: testSummary?.total,
        color: '#E5E7EB',
      },
    ],
    [testSummary]
  );

  return (
    <Card loading={isLoading}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 20 }}>
          {t('test-cases-status', 'Test Cases Status')}
        </div>
        <div style={{ color: '#6B7280' }}>
          {t(
            'test-cases-status-desc',
            'Understand the metadata available in your service and keep track of the main KPIs coverage'
          )}
        </div>
      </div>
      <Row gutter={[32, 16]} justify="center">
        {/* Total Tests */}
        <Col md={8} xs={24}>
          <Card style={{ textAlign: 'center', minHeight: 320 }}>
            <div style={{ fontWeight: 600, fontSize: 20, marginBottom: 8 }}>
              {t('total-tests', 'Total Tests')}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative',
                height: 180,
              }}>
              <PieChart height={200} width={200}>
                <Pie
                  cx="50%"
                  cy="50%"
                  data={success}
                  dataKey="value"
                  innerRadius={85}
                  outerRadius={100}>
                  {success?.map((entry) => (
                    <Cell fill={entry.color} key={`cell-${entry.name}`} />
                  ))}
                </Pie>
                {/* {renderCenterText(testSummary?.totalTests || 0)} */}
              </PieChart>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 16,
                marginTop: 8,
              }}>
              {testSummary?.totalTests?.map((item: any) => (
                <div
                  key={item.name}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: item.color,
                      display: 'inline-block',
                    }}
                  />
                  <span style={{ color: '#222', fontWeight: 500 }}>
                    {t(item.name)}
                  </span>
                  <span style={{ color: '#6B7280', fontWeight: 500 }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </Col>
        {/* Healthy Data Assets */}
        <Col md={8} xs={24}>
          <Card style={{ textAlign: 'center', minHeight: 320 }}>
            <div style={{ fontWeight: 600, fontSize: 20, marginBottom: 8 }}>
              {t('healthy-data-asset-plural')}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative',
                height: 180,
              }}>
              <PieChart height={180} width={180}>
                <Pie
                  cx="50%"
                  cy="50%"
                  data={testSummary?.healthyDataAssets}
                  dataKey="value"
                  endAngle={-30}
                  innerRadius={60}
                  nameKey="name"
                  outerRadius={80}
                  startAngle={210}
                  stroke="none">
                  {testSummary?.healthyDataAssets?.map(
                    (entry: any, idx: number) => (
                      <Cell fill={entry.color} key={`cell-healthy-${idx}`} />
                    )
                  )}
                </Pie>
                {renderCenterText(1000)}
              </PieChart>
            </div>
          </Card>
        </Col>
        {/* Data Assets Coverage */}
        <Col md={8} xs={24}>
          <Card style={{ textAlign: 'center', minHeight: 320 }}>
            <div style={{ fontWeight: 600, fontSize: 20, marginBottom: 8 }}>
              {t('data-asset-plural-coverage')}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                position: 'relative',
                height: 180,
              }}>
              <PieChart height={180} width={180}>
                <Pie
                  cx="50%"
                  cy="50%"
                  data={testSummary?.dataAssetsCoverage}
                  dataKey="value"
                  endAngle={-30}
                  innerRadius={60}
                  nameKey="name"
                  outerRadius={80}
                  startAngle={210}
                  stroke="none">
                  {testSummary?.dataAssetsCoverage?.map(
                    (entry: any, idx: number) => (
                      <Cell fill={entry.color} key={`cell-coverage-${idx}`} />
                    )
                  )}
                </Pie>
                {renderCenterText(1000)}
              </PieChart>
            </div>
          </Card>
        </Col>
      </Row>
    </Card>
  );
};

export default PieChartSummaryPanel;
