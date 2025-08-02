/*
 *  Copyright 2025 Collate.
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

import { SystemChartType } from '../enums/DataInsight.enum';

export const PLATFORM_INSIGHTS_CHARTS: SystemChartType[] = [
  SystemChartType.DescriptionCoverage,
  SystemChartType.PIICoverage,
  SystemChartType.TierCoverage,
  SystemChartType.OwnersCoverage,
  SystemChartType.HealthyDataAssets,
];

export const PLATFORM_INSIGHTS_LIVE_CHARTS: SystemChartType[] = [
  SystemChartType.AssetsWithDescriptionLive,
  SystemChartType.AssetsWithPIILive,
  SystemChartType.AssetsWithTierLive,
  SystemChartType.AssetsWithOwnerLive,
  SystemChartType.HealthyDataAssets,
];

export const LIVE_CHARTS_LIST = [
  ...PLATFORM_INSIGHTS_LIVE_CHARTS,
  SystemChartType.TotalDataAssetsLive,
  SystemChartType.PipelineStatusLive,
];

export const SERVICE_INSIGHTS_WORKFLOW_DEFINITION_NAME = 'AutoPilotWorkflow';
