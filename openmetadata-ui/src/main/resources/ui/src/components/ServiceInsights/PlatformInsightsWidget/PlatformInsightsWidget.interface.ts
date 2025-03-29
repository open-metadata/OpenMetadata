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

import { SystemChartType } from '../../../enums/DataInsight.enum';
import { ServiceInsightWidgetCommonProps } from '../ServiceInsightsTab.interface';

export interface ChartData {
  day: number;
  count: number;
}

export interface ChartSeriesData {
  chartType: SystemChartType;
  data: ChartData[];
  percentageChange?: number;
  currentPercentage: number;
  isIncreased?: boolean;
  noRecords?: boolean;
  numberOfDays: number;
}

export interface PlatformInsightsWidgetProps
  extends ServiceInsightWidgetCommonProps {
  chartsData: ChartSeriesData[];
  isLoading: boolean;
}
