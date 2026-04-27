/*
 *  Copyright 2024 Collate.
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

import { NodeSubType } from '../generated/governance/workflows/elements/nodeSubType';
import { NodeType } from '../generated/governance/workflows/elements/nodeType';

export interface CustomNodeData {
  label: string;
  type: NodeType;
  name?: string;
  displayName?: string;
  subType?: NodeSubType;
  config?: Record<string, unknown>;
  input?: string[];
  inputNamespaceMap?: Record<string, string>;
  output?: string[];
  branches?: string[];
}

export interface BackendWorkflowDefinition {
  name: string;
  displayName: string;
  description: string;
  type?: string;
  trigger: WorkflowTrigger;
  nodes: BackendWorkflowNode[];
  edges: BackendWorkflowEdge[];
  config: WorkflowConfig;
}

export interface WorkflowTrigger {
  type: 'periodicBatchEntity' | 'eventBasedEntity' | 'noOp' | '';
  config: TriggerConfig;
  output?: string[];
}

export interface TriggerConfig {
  entityTypes: string[];
  schedule?: {
    scheduleTimeline: string;
  };
  batchSize?: number;
  filters?: string;
  events?: string[];
}

export interface BackendWorkflowNode {
  type: 'startEvent' | 'endEvent' | 'automatedTask' | 'userTask';
  subType: string;
  name: string;
  displayName: string;
  config?: NodeConfig;
  input?: string[];
  inputNamespaceMap?: Record<string, string>;
  output?: string[];
  branches?: string[];
}

export interface BackendWorkflowEdge {
  from: string;
  to: string;
  condition?: string;
}

export interface WorkflowConfig {
  storeStageStatus: boolean;
}

export interface NodeConfig {
  rules?: string;
  fieldName?: string;
  fieldValue?: string;
  qualityBands?: QualityBand[];
  fieldsToCheck?: string[];
  assignees?: {
    addReviewers?: boolean;
    addOwners?: boolean;
    candidates?: Array<{
      id: string;
      type: string;
      fullyQualifiedName?: string;
      name?: string;
    }>;
  };
  approvalThreshold?: number;
  rejectionThreshold?: number;
  [key: string]: unknown;
}

export interface QualityBand {
  name: string;
  minimumScore: number;
}
