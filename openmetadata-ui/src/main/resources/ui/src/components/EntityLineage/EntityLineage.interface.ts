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
import { Edge as FlowEdge, FitViewOptions, Node } from 'reactflow';
import { EntityType } from '../../enums/entity.enum';
import { Column } from '../../generated/entity/data/table';
import { EntityLineage } from '../../generated/type/entityLineage';
import { EntityReference } from '../../generated/type/entityReference';

export interface SelectedNode {
  name: string;
  type: string;
  fqn: string;
  displayName?: string;
  id?: string;
  entityId: string;
}

export interface EntityLineageProp {
  entityType: EntityType;
  deleted?: boolean;
  hasEditAccess?: boolean;
  isLoading?: boolean;
  onExitFullScreenViewClick?: () => void;
}

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

export interface SelectedEdge {
  id: string;
  source: EntityReference;
  target: EntityReference;
  data?: CustomEdgeData;
}

export type ElementLoadingState = Exclude<LoadingState, 'waiting'>;

export type CustomElement = { node: Node[]; edge: FlowEdge[] };
export type CustomFlow = Node | FlowEdge;
export type ModifiedColumn = Column & {
  type: string;
};

export interface CustomControlElementsProps {
  deleted: boolean | undefined;
  isEditMode: boolean;
  hasEditAccess: boolean | undefined;
  onClick: () => void;
  onExpandColumnClick: () => void;
  loading: boolean;
  status: LoadingState;
}

export enum EdgeTypeEnum {
  UP_STREAM = 'upstream',
  DOWN_STREAM = 'downstream',
  NO_STREAM = '',
}

export interface ControlProps extends HTMLAttributes<HTMLDivElement> {
  showZoom?: boolean;
  showFitView?: boolean;
  fitViewParams?: FitViewOptions;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitView?: () => void;
  handleFullScreenViewClick?: () => void;
  onExitFullScreenViewClick?: () => void;
  deleted: boolean | undefined;
  isEditMode: boolean;
  hasEditAccess: boolean | undefined;
  isColumnsExpanded: boolean;
  onEditLinageClick: () => void;
  onExpandColumnClick: () => void;
  loading: boolean;
  status: LoadingState;
  zoomValue: number;
  lineageData: EntityLineage;
  onOptionSelect: (value?: string) => void;
}

export type LineagePos = 'from' | 'to';

export interface LeafNodes {
  upStreamNode: Array<string>;
  downStreamNode: Array<string>;
}
export interface LoadingNodeState {
  id: string | undefined;
  state: boolean;
}

export interface EntityReferenceChild extends EntityReference {
  /**
   * Children of this entity, if any.
   */
  children?: EntityReferenceChild[];
  parents?: EntityReferenceChild[];
  pageIndex?: number;
  edgeType?: EdgeTypeEnum;
}

export interface NodeIndexMap {
  upstream: number[];
  downstream: number[];
}
