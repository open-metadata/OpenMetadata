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

import { DimensionResult } from '../../../../../generated/tests/dimensionResult';

export interface DimensionResultWithTimestamp extends DimensionResult {
  timestamp?: number;
  dimensionKey?: string;
  testCaseResultId?: string;
}

export interface DimensionalityHeatmapProps {
  data: DimensionResultWithTimestamp[];
  startDate: number;
  endDate: number;
  isLoading?: boolean;
}

export type HeatmapStatus = 'success' | 'failed' | 'aborted' | 'no-data';

export interface HeatmapCellData {
  date: string;
  status: HeatmapStatus;
  dimensionValue: string;
  result?: DimensionResultWithTimestamp;
}

export interface HeatmapRowData {
  dimensionValue: string;
  cells: HeatmapCellData[];
}
