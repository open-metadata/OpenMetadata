import { Card, Col, Row, Typography } from 'antd';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Cell, Pie, PieChart } from 'recharts';
import { PRIMARY_COLOR, WHITE_SMOKE } from '../../../constants/Color.constants';
import PageHeader from '../../PageHeader/PageHeader.component';
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
}: SummaryPanelProps) => {
  const { t } = useTranslation();

  const healthyDataAssets = useMemo(() => {
    return [
      {
        name: 'healthy',
        value: testSummary?.healthy,
        color: '#12B76A',
      },
      {
        name: 'total',
        value:
          (testSummary?.totalDQEntities ?? 0) - (testSummary?.healthy ?? 0),
        color: WHITE_SMOKE,
      },
    ];
  }, [testSummary?.healthy, testSummary?.totalDQEntities]);

  const dataAssetsCoverage = useMemo(() => {
    return [
      {
        name: 'dataAssetsCoverage',
        value: testSummary?.totalDQEntities,
        color: PRIMARY_COLOR,
      },
      {
        name: 'total',
        value:
          (testSummary?.totalEntityCount ?? 0) -
          (testSummary?.totalDQEntities ?? 0),
        color: WHITE_SMOKE,
      },
    ];
  }, [testSummary?.totalEntityCount, testSummary?.totalDQEntities]);

  const testCaseSummary = useMemo(() => {
    return [
      {
        name: 'success',
        data: [
          {
            name: 'success',
            value: testSummary?.success,
            color: '#12B76A',
          },
          {
            name: 'total',
            value: (testSummary?.total ?? 0) - (testSummary?.success ?? 0),
            color: WHITE_SMOKE,
          },
        ],
        innerRadius: 90,
        outerRadius: 100,
      },
      {
        name: 'failed',
        data: [
          {
            name: 'failed',
            value: testSummary?.failed,
            color: '#EF4444',
          },
          {
            name: 'total',
            value: (testSummary?.total ?? 0) - (testSummary?.failed ?? 0),
            color: WHITE_SMOKE,
          },
        ],
        innerRadius: 70,
        outerRadius: 80,
      },
      {
        name: 'aborted',
        data: [
          {
            name: 'aborted',
            value: testSummary?.aborted,
            color: '#F59E0B',
          },
          {
            name: 'total',
            value: (testSummary?.total ?? 0) - (testSummary?.aborted ?? 0),
            color: WHITE_SMOKE,
          },
        ],
        innerRadius: 50,
        outerRadius: 60,
      },
    ];
  }, [testSummary]);

  return (
    <Card loading={isLoading}>
      <PageHeader
        data={{
          header: t('label.data-quality'),
          subHeader: t('message.page-sub-header-for-data-quality'),
        }}
      />
      <Row className="p-t-box" gutter={[32, 16]} justify="center">
        {/* Total Tests */}
        <Col md={8} xs={24}>
          <Card style={{ textAlign: 'center', minHeight: 300 }}>
            <Typography.Title
              className="heading"
              data-testid="heading"
              level={5}>
              {t('label.total-entity', {
                entity: t('label.test-case-plural'),
              })}
            </Typography.Title>
            <div className="flex-center m-y-md" style={{ height: 200 }}>
              <PieChart height={200} width={200}>
                {testCaseSummary.map((item) => {
                  return (
                    <Pie
                      cx="50%"
                      cy="50%"
                      data={item.data}
                      dataKey="value"
                      endAngle={-270}
                      innerRadius={item.innerRadius}
                      key={item.name}
                      outerRadius={item.outerRadius}
                      startAngle={90}>
                      {item.data?.map((entry) => (
                        <Cell fill={entry.color} key={`cell-${entry.name}`} />
                      ))}
                    </Pie>
                  );
                })}
                {renderCenterText(testSummary?.total || 0)}
              </PieChart>
            </div>
            <div className="flex-center gap-6">
              {testCaseSummary?.map((item) => (
                <div className="flex-center gap-2" key={item.name}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: item.data[0].color,
                      display: 'inline-block',
                    }}
                  />
                  <span style={{ color: '#222', fontWeight: 500 }}>
                    {t(item.name)}
                  </span>
                  <span style={{ color: '#6B7280', fontWeight: 500 }}>
                    {item.data[0].value}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </Col>
        {/* Healthy Data Assets */}
        <Col md={8} xs={24}>
          <Card style={{ textAlign: 'center', minHeight: 300 }}>
            <Typography.Title
              className="heading"
              data-testid="heading"
              level={5}>
              {t('label.healthy-data-asset-plural')}
            </Typography.Title>
            <div className="flex-center m-y-md" style={{ height: 200 }}>
              <PieChart height={200} width={200}>
                <Pie
                  cx="50%"
                  cy="50%"
                  data={healthyDataAssets}
                  dataKey="value"
                  endAngle={-270}
                  innerRadius={90}
                  outerRadius={100}
                  startAngle={90}>
                  {healthyDataAssets?.map((entry, idx) => (
                    <Cell fill={entry.color} key={`cell-healthy-${idx}`} />
                  ))}
                </Pie>
                {renderCenterText(testSummary?.healthy || 0)}
              </PieChart>
            </div>
          </Card>
        </Col>
        {/* Data Assets Coverage */}
        <Col md={8} xs={24}>
          <Card style={{ textAlign: 'center', minHeight: 300 }}>
            <Typography.Title
              className="heading"
              data-testid="heading"
              level={5}>
              {t('label.data-asset-plural-coverage')}
            </Typography.Title>
            <div className="flex-center m-y-md" style={{ height: 200 }}>
              <PieChart height={200} width={200}>
                <Pie
                  cx="50%"
                  cy="50%"
                  data={dataAssetsCoverage}
                  dataKey="value"
                  endAngle={-270}
                  innerRadius={90}
                  outerRadius={100}
                  startAngle={90}>
                  {dataAssetsCoverage?.map((entry, idx) => (
                    <Cell fill={entry.color} key={`cell-coverage-${idx}`} />
                  ))}
                </Pie>
                {renderCenterText(testSummary?.totalDQEntities || 0)}
              </PieChart>
            </div>
          </Card>
        </Col>
      </Row>
    </Card>
  );
};

export default PieChartSummaryPanel;
