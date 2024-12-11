/*
 *  Copyright 2022 Collate.
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

import { DataInsightChartResult } from '../generated/dataInsight/dataInsightChartResult';
import { ChartAggregateParam } from '../interface/data-insight.interface';
import APIClient from './index';

export enum SystemChartType {
  TotalDataAssets = 'total_data_assets',
  PercentageOfDataAssetWithDescription = 'percentage_of_data_asset_with_description',
  PercentageOfDataAssetWithOwner = 'percentage_of_data_asset_with_owner',
  PercentageOfServiceWithDescription = 'percentage_of_service_with_description',
  PercentageOfServiceWithOwner = 'percentage_of_service_with_owner',
  TotalDataAssetsByTier = 'total_data_assets_by_tier',
  TotalDataAssetsSummaryCard = 'total_data_assets_summary_card',
  DataAssetsWithDescriptionSummaryCard = 'data_assets_with_description_summary_card',
  DataAssetsWithOwnerSummaryCard = 'data_assets_with_owner_summary_card',
  TotalDataAssetsWithTierSummaryCard = 'total_data_assets_with_tier_summary_card',
  NumberOfDataAssetWithDescription = 'number_of_data_asset_with_description_kpi',
  NumberOfDataAssetWithOwner = 'number_of_data_asset_with_owner_kpi',
}

export interface DataInsightCustomChartResult {
  results: Array<{ count: number; day: number; group: string }>;
}

export const getAggregateChartData = async (params: ChartAggregateParam) => {
  const response = await APIClient.get<DataInsightChartResult>(
    '/analytics/dataInsights/charts/aggregate',
    {
      params,
    }
  );

  return response.data;
};

export const getChartPreviewByName = async (
  name: SystemChartType,
  params: { start: number; end: number; filter?: string }
) => {
  const response = await APIClient.get<DataInsightCustomChartResult>(
    `/analytics/dataInsights/system/charts/name/${name}/data`,
    {
      params,
    }
  );

  return response.data;
};

export const getMultiChartsPreviewByName = async (
  chartNames: SystemChartType[],
  params: { start: number; end: number; filter?: string }
) => {
  const response = await APIClient.get<
    Record<SystemChartType, DataInsightCustomChartResult>
  >(`/analytics/dataInsights/system/charts/listChartData`, {
    params: {
      chartNames,
      ...params,
    },
  });

  return response.data;
};
