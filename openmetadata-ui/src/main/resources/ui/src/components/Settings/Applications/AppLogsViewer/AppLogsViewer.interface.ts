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

import { EntityType } from '../../../../enums/entity.enum';
import { AppRunRecord } from '../../../../generated/entity/applications/appRunRecord';

export interface AppLogsViewerProps {
  data: AppRunRecord;
  scrollHeight?: number;
}

export interface TotalRecords {
  totalRecords: number;
  successRecords: number;
  failedRecords: number;
}
export interface JobStats extends TotalRecords {
  processedRecords: string;
}

export type EntityTypeSearchIndex = Exclude<
  EntityType,
  | EntityType.BOT
  | EntityType.ALERT
  | EntityType.knowledgePanels
  | EntityType.WEBHOOK
  | EntityType.USER
  | EntityType.ROLE
  | EntityType.TEAM
  | EntityType.SUBSCRIPTION
  | EntityType.POLICY
  | EntityType.DATA_INSIGHT_CHART
  | EntityType.KPI
  | EntityType.TYPE
  | EntityType.APP_MARKET_PLACE_DEFINITION
  | EntityType.APPLICATION
  | EntityType.PERSONA
  | EntityType.DOC_STORE
  | EntityType.PAGE
  | EntityType.SAMPLE_DATA
  | EntityType.GOVERN
  | EntityType.CUSTOM_METRIC
  | EntityType.ALL
  | EntityType.EVENT_SUBSCRIPTION
  | EntityType.LINEAGE_EDGE
  | EntityType.API_SERVICE
  | EntityType.API_COLLECTION
  | EntityType.API_ENDPOINT
  | EntityType.METRIC
>;

export type EntityStats = Record<EntityTypeSearchIndex, TotalRecords>;

export interface EntityStatsData {
  name: string;
  totalRecords: number;
  successRecords: number;
  failedRecords: number;
}
