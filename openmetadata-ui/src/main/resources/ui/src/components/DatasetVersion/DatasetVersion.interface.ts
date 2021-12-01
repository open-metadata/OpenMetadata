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

import { Table } from '../../generated/entity/data/table';
import { EntityHistory } from '../../generated/type/entityHistory';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';

export interface DatasetVersionProp {
  version: string;
  currentVersionData: Table;
  isVersionLoading: boolean;
  owner: Table['owner'];
  tier: string;
  slashedTableName: TitleBreadcrumbProps['titleLinks'];
  datasetFQN: string;
  versionList: EntityHistory;
  backHandler: () => void;
  versionHandler: (v: string) => void;
}
