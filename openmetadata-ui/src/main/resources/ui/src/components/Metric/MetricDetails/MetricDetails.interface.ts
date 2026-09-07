/*
 *  Copyright 2024 Collate.
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
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Metric } from '../../../generated/entity/data/metric';
import { DataAssetWithDomains } from '../../DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { QueryVote } from '../../Database/TableQueries/TableQueries.interface';

export interface MetricDetailsProps {
  metricDetails: Metric;
  metricPermissions: OperationPermission;
  fetchMetricDetails: () => void;
  onFollowMetric: () => Promise<void>;
  onMetricUpdate: (updatedData: Metric, key?: keyof Metric) => Promise<void>;
  onToggleDelete: (version?: number) => void;
  onUnFollowMetric: () => Promise<void>;
  onUpdateMetricDetails: (data: DataAssetWithDomains) => void;
  onVersionChange: () => void;
  onUpdateVote: (data: QueryVote, id: string) => Promise<void>;
}
