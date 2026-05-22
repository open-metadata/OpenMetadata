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

import { Edge } from '../generated/governance/workflows/elements/edge';
import { NodeSubType } from '../generated/governance/workflows/elements/nodeSubType';
import { NodeType } from '../generated/governance/workflows/elements/nodeType';

export interface BaseNodeConfig {
  type: string;
  subType: string;
  name: string;
  displayName?: string;
  description?: string;
  input?: string[];
  inputNamespaceMap?: Record<string, string>;
  output?: string[];
  branches?: string[];
  config?: Record<string, unknown>;
}

export interface BackendNode extends BaseNodeConfig {
  type: NodeType;
  subType: NodeSubType;
}

export interface BackendEdge extends Edge {
  from: string;
  to: string;
  condition?: string;
}

export interface NodeData {
  name: string;
  label: string;
  displayName?: string;
  description?: string;
  subType: NodeSubType;
  action?: string;
  config?: Record<string, unknown>;
  input?: string[];
  inputNamespaceMap?: Record<string, string>;
  output?: string[];
  branches?: string[];
}

export interface NodePosition {
  x: number;
  y: number;
}

export interface NodeConfiguration {
  type: string;
  subType: string;
  name: string;
  displayName?: string;
  input?: string[];
  inputNamespaceMap?: Record<string, string>;
  output?: string[];
  branches?: string[];
  config?: Record<string, unknown>;
}

export interface QualityBand {
  name: string;
  minScore: number;
  maxScore: number;
  color: string;
}

export interface DataCompletenessConfig {
  qualityBands?: QualityBand[];
  fieldsToCheck?: string[];
}

export interface SetEntityAttributeConfig {
  fieldName?: string;
  fieldValue?: string;
}

export interface CheckEntityAttributesConfig {
  rules?: string;
}

export interface AssigneeCandidate {
  id: string;
  type: string;
  fullyQualifiedName?: string;
  name?: string;
}

export interface UserApprovalConfig {
  assignees?: {
    addReviewers: boolean;
    addOwners?: boolean;
    candidates?: AssigneeCandidate[];
  };
  approvalThreshold?: number;
  rejectionThreshold?: number;
}

export interface RollbackEntityConfig {
  [key: string]: unknown;
}

export type NodeConfigUnion =
  | DataCompletenessConfig
  | SetEntityAttributeConfig
  | CheckEntityAttributesConfig
  | UserApprovalConfig
  | RollbackEntityConfig
  | Record<string, unknown>;

export interface NodeDataWithMetadata extends NodeData {
  id: string;
  lastSaved?: boolean;
  userModified?: boolean;
  fieldName?: string;
  fieldValue?: string;
  rules?: string;
  qualityBands?: QualityBand[];
  fieldsToCheck?: string[];
  approvalThreshold?: number;
  rejectionThreshold?: number;
  type?: string;
  data?: NodeData;
}
