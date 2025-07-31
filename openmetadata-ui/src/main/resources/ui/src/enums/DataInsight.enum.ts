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
export enum DataInsightIndex {
  AGGREGATED_COST_ANALYSIS_REPORT_DATA = 'aggregated_cost_analysis_report_data_index',
}

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
  DescriptionCoverage = 'assets_with_description',
  PIICoverage = 'assets_with_pii',
  TierCoverage = 'assets_with_tier',
  OwnersCoverage = 'assets_with_owners',
  PIIDistribution = 'assets_with_pii_bar',
  TierDistribution = 'assets_with_tier_bar',
  DescriptionSourceBreakdown = 'description_source_breakdown',
  TagSourceBreakdown = 'tag_source_breakdown',
  TierSourceBreakdown = 'tier_source_breakdown',
  DataQualityTestBreakdown = 'data_quality_test_breakdown',
  HealthyDataAssets = 'healthy_data_assets',
  AssetsWithDescriptionLive = 'assets_with_description_live',
  AssetsWithPIILive = 'assets_with_pii_live',
  AssetsWithTierLive = 'assets_with_tier_live',
  AssetsWithOwnerLive = 'assets_with_owner_live',
  TotalDataAssetsLive = 'total_data_assets_live',
  PipelineStatusLive = 'pipeline_status_live',
}
