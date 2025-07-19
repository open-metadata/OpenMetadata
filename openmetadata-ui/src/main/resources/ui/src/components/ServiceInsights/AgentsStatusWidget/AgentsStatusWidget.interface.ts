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
import { App } from '../../../generated/entity/applications/app';
import { Status } from '../../../generated/entity/applications/appRunRecord';
import { PipelineState } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { ServicesType } from '../../../interface/service.interface';
import { ServiceInsightWidgetCommonProps } from '../ServiceInsightsTab.interface';

export interface AgentsStatusWidgetProps
  extends ServiceInsightWidgetCommonProps {
  collateAIagentsList: App[];
  serviceDetails: ServicesType;
}

export interface AgentsInfo {
  label: string;
  status?: PipelineState | Status;
  isCollateAgent: boolean;
}
