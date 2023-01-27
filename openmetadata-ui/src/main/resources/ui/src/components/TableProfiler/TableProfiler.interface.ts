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

import { PROFILER_FILTER_RANGE } from '../../constants/profiler.constant';
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
  tableFqn: string;
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
  columns: Column[];
  hasEditAccess: boolean;
  columnTests: TestCase[];
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

export type OverallTableSummeryType = {
  title: string;
  value: number | string;
  className?: string;
};

export type TableProfilerData = {
  tableProfilerData: TableProfile[];
  systemProfilerData: SystemProfile[];
};

export type TableProfilerChartProps = {
  selectedTimeRange: keyof typeof PROFILER_FILTER_RANGE;
};

export interface ProfilerSettingModalState {
  data: TableProfilerConfig | undefined;
  sqlQuery: string;
  profileSample: number | undefined;
  excludeCol: string[];
  includeCol: ColumnProfilerConfig[];
  enablePartition: boolean;
  partitionData: PartitionProfilerConfig | undefined;
  selectedProfileSampleType: ProfileSampleType | undefined;
}
