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

import { EntityTags } from 'Models';
import { Dbtmodel } from '../../generated/entity/data/dbtmodel';
import { EntityReference } from '../../generated/entity/data/table';
import { User } from '../../generated/entity/teams/user';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';

export interface DatasetOwner extends EntityReference {
  displayName?: string;
}

export interface DBTModelDetailsProps {
  version?: string;
  users: Array<User>;
  dbtModelDetails: Dbtmodel;
  dbtModelFQN: string;
  entityName: string;
  activeTab: number;
  owner: DatasetOwner;
  description: string;
  tier: string;
  columns: Dbtmodel['columns'];
  followers: Array<User>;
  dbtModelTags: Array<EntityTags>;
  slashedDBTModelName: TitleBreadcrumbProps['titleLinks'];
  viewDefinition: Dbtmodel['viewDefinition'];
  setActiveTabHandler: (value: number) => void;
  followDBTModelHandler: () => void;
  unfollowDBTModelHandler: () => void;
  settingsUpdateHandler: (updatedDBTModel: Dbtmodel) => Promise<void>;
  columnsUpdateHandler: (updatedDBTModel: Dbtmodel) => void;
  descriptionUpdateHandler: (updatedDBTModel: Dbtmodel) => void;
}
