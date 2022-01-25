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

import { Paging } from 'Models';
import { IngestionType } from '../../enums/service.enum';
import { DatabaseService } from '../../generated/entity/services/databaseService';
import { AirflowPipeline } from '../../generated/operations/pipelines/airflowPipeline';
import { EntityReference } from '../../generated/type/entityReference';

export interface ConnectorConfig {
  username: string;
  password: string;
  host: string;
  database: string;
  includeFilterPattern: Array<string>;
  excludeFilterPattern: Array<string>;
  includeViews: boolean;
  excludeDataProfiler?: boolean;
  enableDataProfiler?: boolean;
}
export interface IngestionData {
  id?: string;
  name: string;
  displayName: string;
  ingestionType: IngestionType;
  service: EntityReference;
  scheduleInterval: string;
  ingestionStatuses?: Array<{
    state: string;
    startDate: string;
    endDate: string;
  }>;
  nextExecutionDate?: string;
  connectorConfig?: ConnectorConfig;
  forceDeploy?: boolean;
  owner?: { id: string; name?: string; type: string };
  startDate?: string;
  endDate?: string;
}

export interface Props {
  serviceType?: string;
  serviceName?: string;
  paging: Paging;
  ingestionList: Array<AirflowPipeline>;
  serviceList: Array<DatabaseService>;
  pagingHandler: (value: string) => void;
  deleteIngestion: (id: string, displayName: string) => Promise<void>;
  triggerIngestion: (id: string, displayName: string) => Promise<void>;
  addIngestion: (data: AirflowPipeline, triggerIngestion?: boolean) => void;
  updateIngestion: (
    data: AirflowPipeline,
    oldData: AirflowPipeline,
    id: string,
    displayName: string,
    triggerIngestion?: boolean
  ) => Promise<void>;
}
