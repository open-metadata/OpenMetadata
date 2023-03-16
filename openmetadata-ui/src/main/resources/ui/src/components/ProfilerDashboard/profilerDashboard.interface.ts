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

import { CurveType } from 'recharts/types/shape/Curve';
import { ListTestCaseParams } from 'rest/testAPI';
import {
  Column,
  ColumnProfile,
  Table,
} from '../../generated/entity/data/table';
import { TestCase } from '../../generated/tests/testCase';

export interface ProfilerDashboardProps {
  onTableChange: (table: Table) => void;
  isTestCaseLoading?: boolean;
  table: Table;
  testCases: TestCase[];
  profilerData: ColumnProfile[];
  fetchProfilerData: (tableId: string, days?: number) => void;
  fetchTestCases: (fqn: string, params?: ListTestCaseParams) => void;
  onTestCaseUpdate: (deleted?: boolean) => void;
}

export type MetricChartType = {
  information: {
    title: string;
    dataKey: string;
    stackId?: string;
    color: string;
    latestValue?: string | number;
  }[];
  data: Record<string, string | number>[];
};

export interface ProfilerDetailsCardProps {
  showYAxisCategory?: boolean;
  chartCollection: MetricChartType;
  name: string;
  tickFormatter?: string;
  curveType?: CurveType;
}

export enum ProfilerDashboardTab {
  SUMMARY = 'Summary',
  PROFILER = 'Profiler',
  DATA_QUALITY = 'Data Quality',
}

export type ChartData = {
  name: string;
  proportion?: number;
  value: number;
  timestamp: number;
};

export type ChartCollection = {
  data: ChartData[];
  color: string;
};

export type ChartDataCollection = Record<string, ChartCollection>;

export interface ProfilerTabProps {
  profilerData: ColumnProfile[];
  activeColumnDetails: Column;
  tableProfile: Table['profile'];
}

export interface ProfilerSummaryCardProps {
  title: string;
  data: {
    title: string;
    value: number | string;
  }[];
  showIndicator?: boolean;
}

export interface DataQualityTabProps {
  testCases: TestCase[];
  onTestUpdate?: () => void;
  isLoading?: boolean;
  deletedTable?: boolean;
}

export interface TestSummaryProps {
  data: TestCase;
}

export interface ProfilerLatestValueProps {
  information: MetricChartType['information'];
  tickFormatter?: string;
  stringValue?: boolean;
}
