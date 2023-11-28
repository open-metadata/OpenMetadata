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

import { SystemProfile } from '../../generated/api/data/createTableProfile';
import {
  Column,
  ColumnProfilerConfig,
  PartitionProfilerConfig,
  ProfileSampleType,
  TableProfile,
  TableProfilerConfig,
} from '../../generated/entity/data/table';
import { TestCase } from '../../generated/tests/testCase';
import { OperationPermission } from '../PermissionProvider/PermissionProvider.interface';

export interface TableProfilerProps {
  isTableDeleted?: boolean;
  permissions: OperationPermission;
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

export type columnTestResultType = {
  [key: string]: { results: TableTestsType['results']; count: number };
};

export interface ColumnProfileTableProps {
  overallSummary?: OverallTableSummaryType[];
  columns: Column[];
  columnTests: TestCase[];
  isLoading?: boolean;
  isTableDeleted?: boolean;
  isProfilingEnabled?: boolean;
  permissions?: OperationPermission;
  onSettingButtonClick?: () => void;
}

export interface ProfilerProgressWidgetProps {
  value: number;
  strokeColor?: string;
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
};

export type TableProfilerData = {
  tableProfilerData: TableProfile[];
  systemProfilerData: SystemProfile[];
};

export type TableProfilerChartProps = {
  entityFqn?: string;
  overallSummary?: OverallTableSummaryType[];
  isSummaryLoading?: boolean;
  isProfilingEnabled?: boolean;
  isTableDeleted?: boolean;
  showHeader?: boolean;
  permissions?: OperationPermission;
  onSettingButtonClick?: () => void;
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
