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
import { PolicyClass } from '../access-control/PoliciesClass';
import { RolesClass } from '../access-control/RolesClass';
import { ApiCollectionClass } from '../entity/ApiCollectionClass';
import { ContainerClass } from '../entity/ContainerClass';
import { DashboardClass } from '../entity/DashboardClass';
import { MlModelClass } from '../entity/MlModelClass';
import { PipelineClass } from '../entity/PipelineClass';
import { SearchIndexClass } from '../entity/SearchIndexClass';
import { TableClass } from '../entity/TableClass';
import { TopicClass } from '../entity/TopicClass';
import { UserClass } from '../user/UserClass';

export interface EntityData {
  isOwnerPolicy: PolicyClass;
  matchAnyTagPolicy: PolicyClass;
  isOwnerRole: RolesClass;
  matchAnyTagRole: RolesClass;
  userWithOwnerPermission: UserClass;
  userWithTagPermission: UserClass;
  withOwner: {
    apiCollectionWithOwner: ApiCollectionClass;
    containerWithOwner: ContainerClass;
    dashboardWithOwner: DashboardClass;
    mlModelWithOwner: MlModelClass;
    pipelineWithOwner: PipelineClass;
    searchIndexWithOwner: SearchIndexClass;
    tableWithOwner: TableClass;
    topicWithOwner: TopicClass;
  };
  withTag: {
    apiCollectionWithTag: ApiCollectionClass;
    containerWithTag: ContainerClass;
    dashboardWithTag: DashboardClass;
    mlModelWithTag: MlModelClass;
    pipelineWithTag: PipelineClass;
    searchIndexWithTag: SearchIndexClass;
    tableWithTag: TableClass;
    topicWithTag: TopicClass;
  };
}

export type AssetTypes =
  | ApiCollectionClass
  | ContainerClass
  | DashboardClass
  | MlModelClass
  | PipelineClass
  | TableClass
  | TopicClass;
