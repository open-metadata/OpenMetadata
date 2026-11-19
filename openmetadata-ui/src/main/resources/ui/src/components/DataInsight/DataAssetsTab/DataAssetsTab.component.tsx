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
import { AxiosError } from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SystemChartType } from '../../../enums/DataInsight.enum';
import {
  DataInsightCustomChartResult,
  getChartPreviewByName,
} from '../../../rest/DataInsightAPI';
import { getQueryFilterForDataInsightChart } from '../../../utils/DataInsightPureUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import Loader from '../../common/Loader/Loader';
import { DataInsightChartCard } from '../DataInsightChartCard';
import { useDataInsightProvider } from '../DataInsightProvider/DataInsightProvider';

const DataAssetsTab = () => {
  const { t } = useTranslation();
  const { kpi, chartFilter } = useDataInsightProvider();
  // The total-assets card draws this series and the percentage cards base
  // their change on it, so it is fetched once here instead of once per card.
  const [totalAssets, setTotalAssets] =
    useState<DataInsightCustomChartResult | null>();

  const latestRequestId = useRef(0);

  const fetchTotalAssets = useCallback(async () => {
    // A filter change can overlap requests; only the newest may set the totals.
    const requestId = ++latestRequestId.current;
    setTotalAssets(undefined);
    try {
      const response = await getChartPreviewByName(
        SystemChartType.TotalDataAssets,
        {
          start: chartFilter.startTs,
          end: chartFilter.endTs,
          filter: getQueryFilterForDataInsightChart(
            chartFilter.team,
            chartFilter.tier
          ),
        }
      );
      if (requestId === latestRequestId.current) {
        setTotalAssets(response);
      }
    } catch (error) {
      if (requestId === latestRequestId.current) {
        showErrorToast(error as AxiosError);
        setTotalAssets(null);
      }
    }
  }, [
    chartFilter.startTs,
    chartFilter.endTs,
    chartFilter.team,
    chartFilter.tier,
  ]);

  useEffect(() => {
    if (!kpi.isLoading) {
      void fetchTotalAssets();
    }
  }, [fetchTotalAssets, kpi.isLoading]);

  if (kpi.isLoading) {
    return <Loader />;
  }

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <DataInsightChartCard
          header={t('label.data-insight-total-entity-summary')}
          subHeader={t('message.total-entity-insight')}
          totalAssets={totalAssets}
          type={SystemChartType.TotalDataAssets}
        />
      </Col>
      <Col span={24}>
        <DataInsightChartCard
          listAssets
          header={t('label.data-insight-description-summary-type', {
            type: t('label.data-asset'),
          })}
          subHeader={t('message.field-insight', {
            field: t('label.description-lowercase'),
          })}
          totalAssets={totalAssets}
          type={SystemChartType.PercentageOfDataAssetWithDescription}
        />
      </Col>
      <Col span={24}>
        <DataInsightChartCard
          listAssets
          header={t('label.data-insight-owner-summary-type', {
            type: t('label.data-asset'),
          })}
          subHeader={t('message.field-insight', {
            field: t('label.owner'),
          })}
          totalAssets={totalAssets}
          type={SystemChartType.PercentageOfDataAssetWithOwner}
        />
      </Col>
      <Col span={24}>
        <DataInsightChartCard
          header={t('label.data-insight-description-summary-type', {
            type: t('label.service'),
          })}
          subHeader={t('message.field-insight', {
            field: t('label.description-lowercase'),
          })}
          totalAssets={totalAssets}
          type={SystemChartType.PercentageOfServiceWithDescription}
        />
      </Col>
      <Col span={24}>
        <DataInsightChartCard
          header={t('label.data-insight-owner-summary-type', {
            type: t('label.service'),
          })}
          subHeader={t('message.field-insight', {
            field: t('label.owner'),
          })}
          totalAssets={totalAssets}
          type={SystemChartType.PercentageOfServiceWithOwner}
        />
      </Col>
      <Col span={24}>
        <DataInsightChartCard
          header={t('label.data-insight-tier-summary')}
          subHeader={t('message.field-insight', {
            field: t('label.tier'),
          })}
          type={SystemChartType.TotalDataAssetsByTier}
        />
      </Col>
    </Row>
  );
};

export default DataAssetsTab;
