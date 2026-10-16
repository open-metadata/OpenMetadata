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
import type { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import type { Metric } from '../../../generated/entity/data/metric';
import type { EntityHistory } from '../../../generated/type/entityHistory';
import type { TagLabel } from '../../../generated/type/tagLabel';
import type { TitleBreadcrumbProps } from '../../common/TitleBreadcrumb/TitleBreadcrumb.interface';

export interface MetricVersionProp {
  version?: string;
  currentVersionData: Metric;
  isVersionLoading: boolean;
  owners: Metric['owners'];
  domains: Metric['domains'];
  tier: TagLabel;
  slashedMetricName: TitleBreadcrumbProps['titleLinks'];
  versionList: EntityHistory;
  backHandler: () => void;
  versionHandler: (v: string) => void;
  entityPermissions: OperationPermission;
}
