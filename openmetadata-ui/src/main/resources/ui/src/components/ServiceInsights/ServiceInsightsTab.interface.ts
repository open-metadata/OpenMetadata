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

import { NO_RUNS_STATUS } from '../../constants/ServiceInsightsTab.constants';
import { App } from '../../generated/entity/applications/app';
import {
  AppRunRecord,
  Status,
} from '../../generated/entity/applications/appRunRecord';
import {
  IngestionPipeline,
  PipelineState,
} from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { WorkflowInstance } from '../../generated/governance/workflows/workflowInstance';
import { WorkflowInstanceState } from '../../generated/governance/workflows/workflowInstanceState';
import { ServicesType } from '../../interface/service.interface';
import {
  ChartData,
  ChartSeriesData,
} from './PlatformInsightsWidget/PlatformInsightsWidget.interface';

export interface ServiceInsightsTabProps {
  serviceDetails: ServicesType;
  workflowStatesData?: WorkflowStatesData;
  collateAIagentsList: App[];
  ingestionPipelines?: IngestionPipeline[];
  isIngestionPipelineLoading: boolean;
  isCollateAIagentsLoading: boolean;
}
export interface WorkflowStatesData {
  mainInstanceState: WorkflowInstance;
  subInstanceStates: WorkflowInstanceState[];
}
export interface ServiceInsightWidgetCommonProps {
  serviceDetails: ServicesType;
  workflowStatesData?: WorkflowStatesData;
}
export interface ChartsResults {
  platformInsightsChart: ChartSeriesData[];
  piiDistributionChart: ChartData[];
  tierDistributionChart: ChartData[];
}

export interface AgentsLiveInfo
  extends Pick<
    IngestionPipeline,
    | 'name'
    | 'pipelineType'
    | 'provider'
    | 'id'
    | 'fullyQualifiedName'
    | 'displayName'
  > {
  status: PipelineState;
}

export interface CollateAgentLiveInfo
  extends Pick<AppRunRecord, 'appName' | 'appId' | 'timestamp'> {
  displayName: string;
  status: Status | typeof NO_RUNS_STATUS;
}

export interface TotalAssetsCount {
  name: string;
  value: number;
  icon: JSX.Element;
}
