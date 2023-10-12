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
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataInsightChartType } from '../../../generated/dataInsight/dataInsightChartResult';
import { useDataInsightProvider } from '../../../pages/DataInsightPage/DataInsightProvider';
import Loader from '../../Loader/Loader';
import DescriptionInsight from '../DescriptionInsight';
import OwnerInsight from '../OwnerInsight';
import TierInsight from '../TierInsight';
import TotalEntityInsight from '../TotalEntityInsight';

const DataAssetsTab = () => {
  const {
    chartFilter,
    selectedDaysFilter,
    kpi,
    tierTag: tier,
  } = useDataInsightProvider();
  const { t } = useTranslation();
  const { descriptionKpi, ownerKpi } = useMemo(() => {
    return {
      descriptionKpi: kpi.data.find(
        (value) =>
          value.dataInsightChart.name ===
          DataInsightChartType.PercentageOfEntitiesWithDescriptionByType
      ),
      ownerKpi: kpi.data.find(
        (value) =>
          value.dataInsightChart.name ===
          DataInsightChartType.PercentageOfEntitiesWithOwnerByType
      ),
    };
  }, [kpi]);

  if (kpi.isLoading) {
    return <Loader />;
  }

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <TotalEntityInsight
          chartFilter={chartFilter}
          selectedDays={selectedDaysFilter}
        />
      </Col>
      <Col span={24}>
        <DescriptionInsight
          chartFilter={chartFilter}
          dataInsightChartName={
            DataInsightChartType.PercentageOfEntitiesWithDescriptionByType
          }
          header={t('label.data-insight-description-summary-type', {
            type: t('label.data-asset'),
          })}
          kpi={descriptionKpi}
          selectedDays={selectedDaysFilter}
        />
      </Col>
      <Col span={24}>
        <OwnerInsight
          chartFilter={chartFilter}
          dataInsightChartName={
            DataInsightChartType.PercentageOfEntitiesWithOwnerByType
          }
          header={t('label.data-insight-owner-summary-type', {
            type: t('label.data-asset'),
          })}
          kpi={ownerKpi}
          selectedDays={selectedDaysFilter}
        />
      </Col>
      <Col span={24}>
        <DescriptionInsight
          chartFilter={chartFilter}
          dataInsightChartName={
            DataInsightChartType.PercentageOfServicesWithDescription
          }
          header={t('label.data-insight-description-summary-type', {
            type: t('label.service'),
          })}
          kpi={descriptionKpi}
          selectedDays={selectedDaysFilter}
        />
      </Col>
      <Col span={24}>
        <OwnerInsight
          chartFilter={chartFilter}
          dataInsightChartName={
            DataInsightChartType.PercentageOfServicesWithOwner
          }
          header={t('label.data-insight-owner-summary-type', {
            type: t('label.service'),
          })}
          kpi={ownerKpi}
          selectedDays={selectedDaysFilter}
        />
      </Col>
      <Col span={24}>
        <TierInsight
          chartFilter={chartFilter}
          selectedDays={selectedDaysFilter}
          tierTags={tier}
        />
      </Col>
    </Row>
  );
};

export default DataAssetsTab;
