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
import { ApiEndpointClass } from '../support/entity/ApiEndpointClass';
import { ContainerClass } from '../support/entity/ContainerClass';
import { DashboardClass } from '../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../support/entity/DashboardDataModelClass';
import { MetricClass } from '../support/entity/MetricClass';
import { MlModelClass } from '../support/entity/MlModelClass';
import { PipelineClass } from '../support/entity/PipelineClass';
import { SearchIndexClass } from '../support/entity/SearchIndexClass';
import { StoredProcedureClass } from '../support/entity/StoredProcedureClass';
import { TableClass } from '../support/entity/TableClass';
import { TopicClass } from '../support/entity/TopicClass';

export const searchRBACEntities = [
  {
    name: 'API Endpoint',
    class: ApiEndpointClass,
    resource: 'apiEndpoint',
  },
  {
    name: 'Table',
    class: TableClass,
    resource: 'table',
  },
  {
    name: 'Stored Procedure',
    class: StoredProcedureClass,
    resource: 'storedProcedure',
  },
  {
    name: 'Dashboard',
    class: DashboardClass,
    resource: 'dashboard',
  },
  {
    name: 'Pipeline',
    class: PipelineClass,
    resource: 'pipeline',
  },
  {
    name: 'Topic',
    class: TopicClass,
    resource: 'topic',
  },
  {
    name: 'ML Model',
    class: MlModelClass,
    resource: 'mlmodel',
  },
  {
    name: 'Container',
    class: ContainerClass,
    resource: 'container',
  },
  {
    name: 'Search Index',
    class: SearchIndexClass,
    resource: 'searchIndex',
  },
  {
    name: 'Dashboard Data Model',
    class: DashboardDataModelClass,
    resource: 'dashboardDataModel',
  },
  {
    name: 'Metric',
    class: MetricClass,
    resource: 'metric',
  },
];
