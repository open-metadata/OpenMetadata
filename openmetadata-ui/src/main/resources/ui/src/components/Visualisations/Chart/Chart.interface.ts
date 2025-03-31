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

import { ReactNode } from 'react';
import { ColumnProfile } from '../../../generated/entity/data/table';
import { MetricChartType } from '../../Database/Profiler/ProfilerDashboard/profilerDashboard.interface';

export interface CustomBarChartProps {
  chartCollection: MetricChartType;
  name: string;
  tickFormatter?: string;
  noDataPlaceholderText?: ReactNode;
}

export interface DataDistributionHistogramProps {
  data: {
    firstDayData?: ColumnProfile;
    currentDayData?: ColumnProfile;
  };
  noDataPlaceholderText?: ReactNode;
}

export type CustomPieChartData = {
  name: string;
  value: number;
  color: string;
};
export interface CustomPieChartProps {
  name: string;
  data: CustomPieChartData[];
  label?: React.ReactNode;
}
export type CustomAreaChartData = {
  timestamp: number;
  count: number;
};

export type AreaChartColorScheme = {
  gradientStartColor?: string;
  gradientEndColor?: string;
  strokeColor?: string;
};
export interface CustomAreaChartProps {
  data: CustomAreaChartData[];
  name: string;
  height?: number;
  valueFormatter?: (value: number) => string;
  colorScheme?: AreaChartColorScheme;
}
