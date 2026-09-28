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
import { PolicyClass } from '../support/access-control/PoliciesClass';
import { RolesClass } from '../support/access-control/RolesClass';
import { ApiCollectionClass } from '../support/entity/ApiCollectionClass';
import { ContainerClass } from '../support/entity/ContainerClass';
import { DashboardClass } from '../support/entity/DashboardClass';
import { MlModelClass } from '../support/entity/MlModelClass';
import { PipelineClass } from '../support/entity/PipelineClass';
import { SearchIndexClass } from '../support/entity/SearchIndexClass';
import { ApiServiceClass } from '../support/entity/service/ApiServiceClass';
import { DashboardServiceClass } from '../support/entity/service/DashboardServiceClass';
import { DatabaseServiceClass } from '../support/entity/service/DatabaseServiceClass';
import { MessagingServiceClass } from '../support/entity/service/MessagingServiceClass';
import { MlmodelServiceClass } from '../support/entity/service/MlmodelServiceClass';
import { PipelineServiceClass } from '../support/entity/service/PipelineServiceClass';
import { SearchIndexServiceClass } from '../support/entity/service/SearchIndexServiceClass';
import { StorageServiceClass } from '../support/entity/service/StorageServiceClass';
import { TableClass } from '../support/entity/TableClass';
import { TopicClass } from '../support/entity/TopicClass';
import { EntityData } from '../support/interfaces/ConditionalPermissions.interface';
import { UserClass } from '../support/user/UserClass';
import { ServiceTypes } from './settings';

export const isOwnerPolicy = new PolicyClass();
export const matchAnyTagPolicy = new PolicyClass();
export const isOwnerRole = new RolesClass();
export const matchAnyTagRole = new RolesClass();
export const userWithOwnerPermission = new UserClass();
export const userWithTagPermission = new UserClass();
// Every fixture below is used to navigate to a per-asset service page
// (assetOwnerUrl/assetTagUrl below), so each passes its own service instead of
// sharing the shard's.
export const apiCollectionWithOwner = new ApiCollectionClass({
  service: new ApiServiceClass(),
});
export const apiCollectionWithTag = new ApiCollectionClass({
  service: new ApiServiceClass(),
});
export const containerWithOwner = new ContainerClass({
  service: new StorageServiceClass(),
});
export const containerWithTag = new ContainerClass({
  service: new StorageServiceClass(),
});
export const dashboardWithOwner = new DashboardClass({
  service: new DashboardServiceClass(),
});
export const dashboardWithTag = new DashboardClass({
  service: new DashboardServiceClass(),
});
export const mlModelWithOwner = new MlModelClass({
  service: new MlmodelServiceClass(),
});
export const mlModelWithTag = new MlModelClass({
  service: new MlmodelServiceClass(),
});
export const pipelineWithOwner = new PipelineClass({
  service: new PipelineServiceClass(),
});
export const pipelineWithTag = new PipelineClass({
  service: new PipelineServiceClass(),
});
export const searchIndexWithOwner = new SearchIndexClass({
  service: new SearchIndexServiceClass(),
});
export const searchIndexWithTag = new SearchIndexClass({
  service: new SearchIndexServiceClass(),
});
export const tableWithOwner = new TableClass({
  service: new DatabaseServiceClass(),
});
export const tableWithTag = new TableClass({
  service: new DatabaseServiceClass(),
});
export const topicWithOwner = new TopicClass({
  service: new MessagingServiceClass(),
});
export const topicWithTag = new TopicClass({
  service: new MessagingServiceClass(),
});

const withOwner = {
  apiCollectionWithOwner,
  containerWithOwner,
  dashboardWithOwner,
  mlModelWithOwner,
  pipelineWithOwner,
  searchIndexWithOwner,
  tableWithOwner,
  topicWithOwner,
};

const withTag = {
  apiCollectionWithTag,
  containerWithTag,
  dashboardWithTag,
  mlModelWithTag,
  pipelineWithTag,
  searchIndexWithTag,
  tableWithTag,
  topicWithTag,
};

export const assetsData = [
  {
    asset: ServiceTypes.API_SERVICES,
    withOwner: apiCollectionWithOwner,
    withTag: apiCollectionWithTag,
    childTabId: 'collections',
    assetOwnerUrl: `/service/${apiCollectionWithOwner.serviceType}`,
    assetTagUrl: `/service/${apiCollectionWithTag.serviceType}`,
  },
  {
    asset: ServiceTypes.STORAGE_SERVICES,
    withOwner: containerWithOwner,
    withTag: containerWithTag,
    childTabId: 'containers',
    assetOwnerUrl: `/service/${containerWithOwner.serviceType}`,
    assetTagUrl: `/service/${containerWithTag.serviceType}`,
  },
  {
    asset: ServiceTypes.DASHBOARD_SERVICES,
    withOwner: dashboardWithOwner,
    withTag: dashboardWithTag,
    childTabId: 'dashboards',
    childTabId2: 'data-model',
    childTableId2: 'data-models-table',
    assetOwnerUrl: `/service/${dashboardWithOwner.serviceType}`,
    assetTagUrl: `/service/${dashboardWithTag.serviceType}`,
  },
  {
    asset: ServiceTypes.ML_MODEL_SERVICES,
    withOwner: mlModelWithOwner,
    withTag: mlModelWithTag,
    childTabId: 'ml models',
    assetOwnerUrl: `/service/${mlModelWithOwner.serviceType}`,
    assetTagUrl: `/service/${mlModelWithTag.serviceType}`,
  },
  {
    asset: ServiceTypes.PIPELINE_SERVICES,
    withOwner: pipelineWithOwner,
    withTag: pipelineWithTag,
    childTabId: 'pipelines',
    assetOwnerUrl: `/service/${pipelineWithOwner.serviceType}`,
    assetTagUrl: `/service/${pipelineWithTag.serviceType}`,
  },
  {
    asset: ServiceTypes.SEARCH_SERVICES,
    withOwner: searchIndexWithOwner,
    withTag: searchIndexWithTag,
    childTabId: 'search indexes',
    assetOwnerUrl: `/service/${searchIndexWithOwner.serviceType}`,
    assetTagUrl: `/service/${searchIndexWithTag.serviceType}`,
  },
  {
    asset: ServiceTypes.DATABASE_SERVICES,
    withOwner: tableWithOwner,
    withTag: tableWithTag,
    childTabId: 'databases',
    assetOwnerUrl: `/service/${tableWithOwner.serviceType}`,
    assetTagUrl: `/service/${tableWithTag.serviceType}`,
  },
  {
    asset: ServiceTypes.MESSAGING_SERVICES,
    withOwner: topicWithOwner,
    withTag: topicWithTag,
    childTabId: 'topics',
    assetOwnerUrl: `/service/${topicWithOwner.serviceType}`,
    assetTagUrl: `/service/${topicWithTag.serviceType}`,
  },
  {
    asset: 'database',
    withOwner: tableWithOwner,
    withTag: tableWithTag,
    childTabId: 'schemas',
    assetOwnerUrl: `/database`,
    assetTagUrl: `/database`,
  },
  {
    asset: 'databaseSchema',
    withOwner: tableWithOwner,
    withTag: tableWithTag,
    childTabId: 'table',
    assetOwnerUrl: `/databaseSchema`,
    assetTagUrl: `/databaseSchema`,
  },
  {
    asset: 'container',
    withOwner: containerWithOwner,
    withTag: containerWithTag,
    childTabId: 'children',
    assetOwnerUrl: `/container`,
    assetTagUrl: `/container`,
  },
];

export const conditionalPermissionsEntityData: EntityData = {
  isOwnerPolicy,
  matchAnyTagPolicy,
  isOwnerRole,
  matchAnyTagRole,
  userWithOwnerPermission,
  userWithTagPermission,
  withOwner,
  withTag,
};
