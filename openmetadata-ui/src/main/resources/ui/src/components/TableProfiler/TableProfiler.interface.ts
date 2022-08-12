/*
 *  Copyright 2021 Collate
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

import {
  Column,
  ColumnProfile,
  Table,
} from '../../generated/entity/data/table';
import { TestCaseStatus } from '../../generated/tests/tableTest';
import { DatasetTestModeType } from '../../interface/dataQuality.interface';

export interface TableProfilerProps {
  onAddTestClick: (
    tabValue: number,
    testMode?: DatasetTestModeType,
    columnName?: string
  ) => void;
  table: Table;
}

export interface ColumnProfileTableProps {
  columns: Column[];
  columnProfile: ColumnProfile[];
  onAddTestClick: (
    tabValue: number,
    testMode?: DatasetTestModeType,
    columnName?: string
  ) => void;
}

export interface ProfilerProgressWidgetProps {
  value: number;
  strokeColor?: string;
}

export interface ProfilerSettingsModalProps {
  tableId: string;
  columnProfile: ColumnProfile[];
  visible: boolean;
  onVisibilityChange: (visible: boolean) => void;
}

export interface TestIndicatorProps {
  value: number;
  type: TestCaseStatus;
}

export type OverallTableSummeryType = {
  title: string;
  value: number | string;
  className?: string;
};
