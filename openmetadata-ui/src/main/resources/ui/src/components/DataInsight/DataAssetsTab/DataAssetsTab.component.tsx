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
import { Grid } from '@openmetadata/ui-core-components';
import { getLayoutGutter } from '../../../utils/common/layout.utils';

import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SystemChartType } from '../../../enums/DataInsight.enum';
import { useDataInsightProvider } from '../../../pages/DataInsightPage/DataInsightProvider';
import {
  DataInsightCustomChartResult,
  getChartPreviewByName,
} from '../../../rest/DataInsightAPI';
import { getQueryFilterForDataInsightChart } from '../../../utils/DataInsightPureUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import Loader from '../../common/Loader/Loader';
import { DataInsightChartCard } from '../DataInsightChartCard';

const DataAssetsTab = () => {
  const { t } = useTranslation();
  const { kpi, chartFilter } = useDataInsightProvider();
  // Every card needs the total-assets series (its own chart, or the base of a
  // percentage change), so it is fetched once here instead of once per card.
  const [totalAssets, setTotalAssets] =
    useState<DataInsightCustomChartResult>();

  useEffect(() => {
    if (kpi.isLoading) {
      return;
    }
    let isStale = false;
    setTotalAssets(undefined);
    getChartPreviewByName(SystemChartType.TotalDataAssets, {
      start: chartFilter.startTs,
      end: chartFilter.endTs,
      filter: getQueryFilterForDataInsightChart(
        chartFilter.team,
        chartFilter.tier
      ),
    })
      .then((response) => !isStale && setTotalAssets(response))
      .catch((error) => {
        if (!isStale) {
          showErrorToast(error as AxiosError);
          setTotalAssets({ results: [] });
        }
      });

    return () => {
      isStale = true;
    };
  }, [
    chartFilter.startTs,
    chartFilter.endTs,
    chartFilter.team,
    chartFilter.tier,
    kpi.isLoading,
  ]);

  if (kpi.isLoading) {
    return <Loader />;
  }

  return (
    <Grid className="layout-row layout-grid" style={getLayoutGutter(16, 16)}>
      <Grid.Item className="layout-column" span={24}>
        <DataInsightChartCard
          header={t('label.data-insight-total-entity-summary')}
          subHeader={t('message.total-entity-insight')}
          totalAssets={totalAssets}
          type={SystemChartType.TotalDataAssets}
        />
      </Grid.Item>
      <Grid.Item className="layout-column" span={24}>
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
      </Grid.Item>
      <Grid.Item className="layout-column" span={24}>
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
      </Grid.Item>
      <Grid.Item className="layout-column" span={24}>
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
      </Grid.Item>
      <Grid.Item className="layout-column" span={24}>
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
      </Grid.Item>
      <Grid.Item className="layout-column" span={24}>
        <DataInsightChartCard
          header={t('label.data-insight-tier-summary')}
          subHeader={t('message.field-insight', {
            field: t('label.tier'),
          })}
          type={SystemChartType.TotalDataAssetsByTier}
        />
      </Grid.Item>
    </Grid>
  );
};

export default DataAssetsTab;
