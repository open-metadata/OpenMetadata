/*
 *  Copyright 2026 Collate.
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
import { Direction } from '../../../generated/api/data/metricObservability';
import { EntityReference } from '../../../generated/entity/type';

export const METRIC_ASSETS_PAGE_SIZE = 10;

export type MetricAssetDirectionFilter = Direction | 'all';
export type MetricAssetTypeFilter = string | 'all';

export interface MetricAssetFilters {
  direction: MetricAssetDirectionFilter;
  search: string;
  type: MetricAssetTypeFilter;
}

export interface MetricAssetDetails {
  asset: EntityReference;
  columns: string[];
  containment: string[];
  description?: string;
  domains: EntityReference[];
  glossaryTerms: string[];
  owners: EntityReference[];
  tags: string[];
  tier?: string;
  usageCount?: number;
  usagePercentile?: number;
}

export interface MetricAssetLineageColumn {
  fromColumns: string[];
  toColumn?: string;
}
