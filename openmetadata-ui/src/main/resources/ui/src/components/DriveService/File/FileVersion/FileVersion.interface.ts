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
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { File } from '../../../../generated/entity/data/file';
import { EntityHistory } from '../../../../generated/type/entityHistory';
import { TagLabel } from '../../../../generated/type/tagLabel';
import { TitleBreadcrumbProps } from '../../../common/TitleBreadcrumb/TitleBreadcrumb.interface';

export interface FileVersionProps {
  version?: string;
  currentVersionData: File;
  isVersionLoading: boolean;
  owners: File['owners'];
  domains: File['domains'];
  dataProducts: File['dataProducts'];
  tier: TagLabel;
  breadCrumbList: TitleBreadcrumbProps['titleLinks'];
  versionList: EntityHistory;
  deleted?: boolean;
  backHandler: () => void;
  versionHandler: (v: string) => void;
  entityPermissions: OperationPermission;
}
