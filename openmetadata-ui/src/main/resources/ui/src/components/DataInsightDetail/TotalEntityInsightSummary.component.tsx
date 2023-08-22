import { Col, Progress, Row, Typography } from 'antd';
import { TOTAL_ENTITY_CHART_COLOR } from 'constants/DataInsight.constants';
import { isNil, uniqueId } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';

type TotalEntityInsightSummaryProps = {
  total: string | number;
  relativePercentage: number;
  selectedDays: number;
  entities: string[];
  latestData: Record<string, number>;
};

const TotalEntityInsightSummary = ({
  total,
  relativePercentage,
  selectedDays,
  entities,
  latestData,
}: TotalEntityInsightSummaryProps) => {
  const { t } = useTranslation();

  const pluralize = (entity: string) => {
    return entity + 's';
  };

  return (
    <Row>
      <Col className="p-b-sm" span={24}>
        <div className="d-flex justify-between">
          <div className="d-flex flex-col">
            <Typography.Text className="font-medium">
              {t('label.total-entity', {
                entity: t('label.asset-plural'),
              })}
            </Typography.Text>
            <Typography.Text className="font-bold text-2xl">
              {total}
            </Typography.Text>
          </div>
          <div className="d-flex flex-col justify-end text-right">
            {Boolean(relativePercentage) && !isNil(relativePercentage) && (
              <Typography.Paragraph className="m-b-0">
                <Typography.Text
                  className="d-block"
                  type={relativePercentage >= 0 ? 'success' : 'danger'}>
                  {`${
                    relativePercentage >= 0 ? '+' : ''
                  }${relativePercentage.toFixed(2)}%`}
                </Typography.Text>
                <Typography.Text className="d-block">
                  {Boolean(selectedDays) &&
                    t('label.days-change-lowercase', {
                      days: selectedDays,
                    })}
                </Typography.Text>
              </Typography.Paragraph>
            )}
          </div>
        </div>
      </Col>
      {entities.map((entity) => {
        const progress = (latestData[entity] / Number(total)) * 100;

        return (
          <Col key={uniqueId()} span={24}>
            <Row className="m-b-xs">
              <Col
                className="d-flex justify-between items-center text-xs"
                md={12}
                sm={24}>
                <Typography.Paragraph className="m-b-0">
                  {pluralize(entity)}
                </Typography.Paragraph>

                <Typography.Paragraph className="m-b-0">
                  {latestData[entity]}
                </Typography.Paragraph>
              </Col>
              <Col md={12} sm={24}>
                <Progress
                  className="p-l-xss"
                  percent={progress}
                  showInfo={false}
                  size="small"
                  strokeColor={TOTAL_ENTITY_CHART_COLOR[entity]}
                />
              </Col>
            </Row>
          </Col>
        );
      })}
    </Row>
  );
};

export default TotalEntityInsightSummary;
