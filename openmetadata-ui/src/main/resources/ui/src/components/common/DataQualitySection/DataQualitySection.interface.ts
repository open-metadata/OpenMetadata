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
export interface DataQualityTest {
  type: 'success' | 'aborted' | 'failed';
  count: number;
}

export type FilterStatus = 'success' | 'failed' | 'aborted';

export interface DataQualitySectionProps {
  tests: DataQualityTest[];
  totalTests: number;
  onEdit?: () => void;
  showEditButton?: boolean;
  isDataQualityTab?: boolean;
  activeFilter?: FilterStatus;
  onFilterChange?: (filter: FilterStatus) => void;
}
export type DataQualityType = 'success' | 'aborted' | 'failed';
export interface DataQualityLegendItemProps {
  count: number;
  label: string;
  type: DataQualityType;
}

export interface DataQualityProgressSegmentProps {
  percent: number;
  type: DataQualityType;
}

export interface DataQualityStatCardProps {
  count: number;
  label: string;
  type: DataQualityType;
  isActive: boolean;
  onClick: () => void;
}
