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

import { DateRangeObject } from 'Models';
import { ReactNode } from 'react';
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import {
  Column,
  ColumnProfilerConfig,
  PartitionProfilerConfig,
  ProfileSampleType,
  Table,
  TableProfilerConfig,
} from '../../../../generated/entity/data/table';
import { TestCase, TestSummary } from '../../../../generated/tests/testCase';
import { UsePagingInterface } from '../../../../hooks/paging/usePaging';
import { ListTestCaseParamsBySearch } from '../../../../rest/testAPI';
import { TestLevel } from '../../../DataQuality/AddDataQualityTest/components/TestCaseFormV1.interface';

export interface TableProfilerProps {
  permissions: OperationPermission;
  table?: Table;
  testCaseSummary?: TestSummary;
}

export interface TableProfilerProviderProps extends TableProfilerProps {
  children: ReactNode;
}

export interface TableProfilerContextInterface {
  isTableDeleted?: boolean;
  testCaseSummary?: TestSummary;
  permissions: OperationPermission;
  isTestsLoading: boolean;
  isProfilerDataLoading: boolean;
  tableProfiler?: Table;
  customMetric?: Table;
  allTestCases: TestCase[];
  overallSummary: OverallTableSummaryType[];
  onTestCaseUpdate: (testCase?: TestCase) => void;
  onSettingButtonClick: () => void;
  fetchAllTests: (params?: ListTestCaseParamsBySearch) => Promise<void>;
  onCustomMetricUpdate: (table: Table) => void;
  isProfilingEnabled: boolean;
  dateRangeObject: DateRangeObject;
  onDateRangeChange: (dateRange: DateRangeObject) => void;
  testCasePaging: UsePagingInterface;
  table?: Table;
  isTestCaseDrawerOpen: boolean;
  onTestCaseDrawerOpen: (type: TestLevel) => void;
}

export type TableTestsType = {
  tests: TestCase[];
  results: {
    success: number;
    aborted: number;
    failed: number;
  };
};

export type ModifiedColumn = Column & {
  testCount?: number;
};

export interface ProfilerProgressWidgetProps {
  value: number;
  strokeColor?: string;
  direction?: 'left' | 'right';
}

export interface ProfilerSettingsModalProps {
  tableId: string;
  columns: Column[];
  visible: boolean;
  onVisibilityChange: (visible: boolean) => void;
}

export interface TestIndicatorProps {
  value: number | string;
  type: string;
}

export type OverallTableSummaryType = {
  title: string;
  value: number | string;
  className?: string;
  key: string;
};

export type TableProfilerChartProps = {
  entityFqn?: string;
  showHeader?: boolean;
  tableDetails?: Table;
};

export interface ProfilerSettingModalState {
  data: TableProfilerConfig | undefined;
  sqlQuery: string;
  profileSample: number | undefined;
  sampleDataCount?: number;
  excludeCol: string[];
  includeCol: ColumnProfilerConfig[];
  enablePartition: boolean;
  partitionData: PartitionProfilerConfig | undefined;
  selectedProfileSampleType: ProfileSampleType | undefined;
}

export interface ProfilerForm extends PartitionProfilerConfig {
  profileSample: number | undefined;
  selectedProfileSampleType: ProfileSampleType | undefined;
  enablePartition: boolean;
  profileSampleType: ProfileSampleType | undefined;
  profileSamplePercentage: number;
  profileSampleRows: number | undefined;
  includeColumns: ColumnProfilerConfig[];
}
