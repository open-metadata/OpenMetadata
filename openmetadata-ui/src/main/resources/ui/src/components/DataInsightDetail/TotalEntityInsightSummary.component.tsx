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
import { Col, Row, Typography } from 'antd';
import { isNil } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import EntitySummaryProgressBar from './EntitySummaryProgressBar.component';

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
          <Col key={entity} span={24}>
            <EntitySummaryProgressBar
              entity={entity}
              latestData={latestData}
              progress={progress}
            />
          </Col>
        );
      })}
    </Row>
  );
};

export default TotalEntityInsightSummary;
