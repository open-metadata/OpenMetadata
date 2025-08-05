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

import { AgentStatus } from '../enums/ServiceInsights.enum';
import { PipelineType } from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import {
  COLLATE_AUTO_TIER_APP_NAME,
  COLLATE_DATA_QUALITY_APP_NAME,
  COLLATE_DOCUMENTATION_APP_NAME,
} from './Applications.constant';

export const AUTOPILOT_AGENTS_ORDERED_LIST = [
  PipelineType.Metadata,
  PipelineType.Lineage,
  PipelineType.Usage,
  COLLATE_AUTO_TIER_APP_NAME,
  COLLATE_DOCUMENTATION_APP_NAME,
  COLLATE_DATA_QUALITY_APP_NAME,
  PipelineType.AutoClassification,
  PipelineType.Profiler,
];

export const AUTOPILOT_AGENTS_STATUS_ORDERED_LIST = [
  AgentStatus.Successful,
  AgentStatus.Running,
  AgentStatus.Failed,
  AgentStatus.Pending,
];
