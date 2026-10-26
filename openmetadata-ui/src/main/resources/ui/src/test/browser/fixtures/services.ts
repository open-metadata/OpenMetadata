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

/**
 * One typed factory per service (and the two database containers) the
 * service details pages render: the fields the page reads, the shape the
 * server returns.
 */
import { Database } from '../../../generated/entity/data/database';
import { DatabaseSchema } from '../../../generated/entity/data/databaseSchema';
import {
  APIService,
  APIServiceType,
} from '../../../generated/entity/services/apiService';
import {
  DashboardService,
  DashboardServiceType,
} from '../../../generated/entity/services/dashboardService';
import {
  DatabaseService,
  DatabaseServiceType,
} from '../../../generated/entity/services/databaseService';
import {
  DriveService,
  DriveServiceType,
} from '../../../generated/entity/services/driveService';
import {
  MessagingService,
  MessagingServiceType,
} from '../../../generated/entity/services/messagingService';
import {
  MlModelServiceType,
  MlmodelService,
} from '../../../generated/entity/services/mlmodelService';
import {
  PipelineService,
  PipelineServiceType,
} from '../../../generated/entity/services/pipelineService';
import {
  SearchService,
  SearchServiceType,
} from '../../../generated/entity/services/searchService';
import {
  StorageService,
  StorageServiceType,
} from '../../../generated/entity/services/storageService';
import { EntityReference } from '../../../generated/type/entityReference';
import { UNTOUCHED } from './dataAssets';

const id = (n: number) =>
  `3d4b5c6e-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** A service named `name`, untouched: no owners, tags, domains or votes. */
const service = (n: number, name: string) => ({
  ...UNTOUCHED,
  id: id(n),
  name,
  fullyQualifiedName: name,
  domains: [],
  dataProducts: [],
});

const ref = (n: number, type: string, fqn: string): EntityReference => ({
  id: id(n),
  type,
  name: fqn.split('.').pop(),
  fullyQualifiedName: fqn,
});

export const makeApiService = (): APIService => ({
  ...service(1, 'pw_api_service'),
  serviceType: APIServiceType.REST,
});

export const makeDatabaseService = (): DatabaseService => ({
  ...service(2, 'pw_database_service'),
  serviceType: DatabaseServiceType.Mysql,
});

export const makeDashboardService = (): DashboardService => ({
  ...service(3, 'pw_dashboard_service'),
  serviceType: DashboardServiceType.Looker,
});

export const makeMessagingService = (): MessagingService => ({
  ...service(4, 'pw_messaging_service'),
  serviceType: MessagingServiceType.Kafka,
});

export const makeMlmodelService = (): MlmodelService => ({
  ...service(5, 'pw_mlmodel_service'),
  serviceType: MlModelServiceType.Mlflow,
});

export const makePipelineService = (): PipelineService => ({
  ...service(6, 'pw_pipeline_service'),
  serviceType: PipelineServiceType.Airflow,
});

export const makeSearchService = (): SearchService => ({
  ...service(7, 'pw_search_service'),
  serviceType: SearchServiceType.ElasticSearch,
});

export const makeStorageService = (): StorageService => ({
  ...service(8, 'pw_storage_service'),
  serviceType: StorageServiceType.S3,
});

export const makeDriveService = (): DriveService => ({
  ...service(9, 'pw_drive_service'),
  serviceType: DriveServiceType.GoogleDrive,
});

const DATABASE_FQN = 'pw_database_service.pw_database';

export const makeDatabase = (): Database => ({
  ...service(10, 'pw_database'),
  fullyQualifiedName: DATABASE_FQN,
  service: ref(2, 'databaseService', 'pw_database_service'),
  serviceType: DatabaseServiceType.Mysql,
});

export const makeDatabaseSchema = (): DatabaseSchema => ({
  ...service(11, 'pw_schema'),
  fullyQualifiedName: `${DATABASE_FQN}.pw_schema`,
  service: ref(2, 'databaseService', 'pw_database_service'),
  database: ref(10, 'database', DATABASE_FQN),
  serviceType: DatabaseServiceType.Mysql,
});
