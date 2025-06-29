/*
 *  Copyright 2023 Collate.
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
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { SearchIndex } from '../../generated/entity/data/searchIndex';
import { EntityHistory } from '../../generated/type/entityHistory';
import { TagLabel } from '../../generated/type/tagLabel';
import { TitleBreadcrumbProps } from '../common/TitleBreadcrumb/TitleBreadcrumb.interface';

export interface SearchIndexVersionProps {
  version?: string;
  currentVersionData: SearchIndex;
  isVersionLoading: boolean;
  owners: SearchIndex['owners'];
  domain: SearchIndex['domain'];
  dataProducts: SearchIndex['dataProducts'];
  tier: TagLabel;
  breadCrumbList: TitleBreadcrumbProps['titleLinks'];
  versionList: EntityHistory;
  deleted?: boolean;
  backHandler: () => void;
  versionHandler: (v: string) => void;
  entityPermissions: OperationPermission;
}
