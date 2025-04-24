/*
 *  Copyright 2022 Collate.
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

import { LoadingState } from 'Models';
import { HTMLAttributes } from 'react';
import { Edge as FlowEdge, Node } from 'reactflow';
import { EntityReference } from '../../../generated/entity/type';

export interface Edge {
  edge: {
    fromEntity: {
      id: string;
      type: string;
    };
    toEntity: {
      id: string;
      type: string;
    };
  };
}

export interface EdgeData {
  fromEntity: string;
  fromId: string;
  toEntity: string;
  toId: string;
}

export interface CustomEdgeData {
  id: string;
  label?: string;
  pipeline?: EntityReference;
  source: string;
  target: string;
  sourceType: string;
  targetType: string;
  isColumnLineage: boolean;
  sourceHandle: string;
  targetHandle: string;
  selectedColumns?: string[];
  isTraced?: boolean;
  selected?: boolean;
  columnFunctionValue?: string;
  edge?: Edge;
  isExpanded?: false;
}

export type ElementLoadingState = Exclude<LoadingState, 'waiting'>;
export type CustomElement = { node: Node[]; edge: FlowEdge[] };

export type ControlProps = HTMLAttributes<HTMLDivElement>;

export interface LineageConfig {
  upstreamDepth: number;
  downstreamDepth: number;
  nodesPerLayer: number;
}

export interface LineageConfigModalProps {
  visible: boolean;
  config: LineageConfig;
  onCancel: () => void;
  onSave: (config: LineageConfig) => void;
}
