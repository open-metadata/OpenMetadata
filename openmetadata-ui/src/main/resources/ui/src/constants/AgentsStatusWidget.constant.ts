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
  DATA_QUALITY_AUTOMATION_TEMPLATE,
  DOCUMENTATION_AUTOMATION_TEMPLATE,
  TIER_AUTOMATION_TEMPLATE,
} from './Applications.constant';

// The AI Automation templates that back AutoPilot's Collate agents. Also the
// source list for resolving an automation's template from its
// `{serviceName}_{template}` name.
export const AUTOPILOT_AUTOMATION_TEMPLATES = [
  TIER_AUTOMATION_TEMPLATE,
  DOCUMENTATION_AUTOMATION_TEMPLATE,
  DATA_QUALITY_AUTOMATION_TEMPLATE,
];

export const AUTOPILOT_AGENTS_ORDERED_LIST = [
  PipelineType.Metadata,
  PipelineType.Lineage,
  PipelineType.Usage,
  TIER_AUTOMATION_TEMPLATE,
  DOCUMENTATION_AUTOMATION_TEMPLATE,
  DATA_QUALITY_AUTOMATION_TEMPLATE,
  PipelineType.AutoClassification,
  PipelineType.Profiler,
];

export const AUTOPILOT_AGENTS_STATUS_ORDERED_LIST = [
  AgentStatus.Successful,
  AgentStatus.Running,
  AgentStatus.Failed,
  AgentStatus.Pending,
];
