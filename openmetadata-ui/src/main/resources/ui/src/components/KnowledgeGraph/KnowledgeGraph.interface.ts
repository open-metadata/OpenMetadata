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
import { EntityReference } from '../../generated/entity/type';

export interface KnowledgeGraphProps {
  entity?: EntityReference;
  entityType: string;
  depth?: number;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  group: string;
  title?: string;
  description?: string;
  owner?: string;
  tags?: Array<{ name: string; tagFQN: string }>;
  name?: string;
  fullyQualifiedName?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
  arrows?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
