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
import { Col, Row } from 'antd';
import { Gutter } from 'antd/lib/grid/row';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TOTAL_ENTITY_CHART_COLOR } from '../../constants/DataInsight.constants';
import CustomStatistic from './CustomStatistic';
import EntitySummaryProgressBar from './EntitySummaryProgressBar.component';

type TotalEntityInsightSummaryProps = {
  total: string | number;
  relativePercentage: number;
  selectedDays: number;
  entities: string[];
  latestData: Record<string, number>;
  gutter?: Gutter | [Gutter, Gutter];
};

const TotalEntityInsightSummary = ({
  total,
  relativePercentage,
  selectedDays,
  entities,
  latestData,
  gutter,
}: TotalEntityInsightSummaryProps) => {
  const { t } = useTranslation();

  return (
    <Row data-testid="total-entity-insight-summary-container" gutter={gutter}>
      <Col className="p-b-sm" span={24}>
        <CustomStatistic
          changeInValue={relativePercentage}
          duration={selectedDays}
          label={t('label.total-entity', {
            entity: t('label.asset-plural'),
          })}
          value={total}
        />
      </Col>
      {entities.map((entity, i) => {
        const progress = (latestData[entity] / Number(total)) * 100;

        return (
          <Col key={entity} span={24}>
            <EntitySummaryProgressBar
              entity={entity}
              latestData={latestData}
              progress={progress}
              strokeColor={TOTAL_ENTITY_CHART_COLOR[i]}
            />
          </Col>
        );
      })}
    </Row>
  );
};

export default TotalEntityInsightSummary;
