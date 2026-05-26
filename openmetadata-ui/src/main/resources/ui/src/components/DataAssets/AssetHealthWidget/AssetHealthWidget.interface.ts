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
import { ReactNode } from 'react';
import { EntityType } from '../../../enums/entity.enum';

export type HealthTone = 'success' | 'warning' | 'error' | 'info' | 'muted';

export type HealthRowKey =
  | 'pipeline'
  | 'dataQuality'
  | 'dataObservability'
  | 'contract';

export interface HealthRow {
  key: HealthRowKey;
  label: string;
  status: string;
  sub?: string;
  tone: HealthTone;
  href?: string;
  external?: boolean;
  cta?: string;
  icon: ReactNode;
  tooltip?: string;
  // Category color for the icon background; falls back to `tone` when unset.
  // Keeps Pipeline/DQ/DO/Contract icons visually colored even when row is
  // in a "Not set up" / muted state.
  iconTone?: HealthTone;
}

export interface HealthHeader {
  label: string;
  tone: HealthTone;
}

export interface AssetHealthState {
  rows: HealthRow[];
  header: HealthHeader;
  loading: boolean;
  contractTone?: HealthTone;
  observabilityTone?: HealthTone;
}

export interface UseAssetHealthArgs {
  entityId?: string;
  entityFqn?: string;
  entityType: EntityType;
  testSuiteId?: string;
  pipelineLatestStatus?: string;
  enabled?: boolean;
}
