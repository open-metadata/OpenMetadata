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
import type {
  EdgeData as G6EdgeData,
  Graph,
  NodeData as G6NodeData,
} from '@antv/g6';
import { EntityReference } from '../../generated/entity/type';
import { GraphData as RdfGraphData } from '../../rest/rdfAPI.interface';
import {
  GraphEdge,
  GraphFilterOptions,
} from '../../types/knowledgeGraph.types';

export interface KnowledgeGraphProps {
  entity?: EntityReference;
  entityType: string;
  levels?: KnowledgeGraphLevel;
}

export type KnowledgeGraphLevel = 1 | 2 | 3;
export type KnowledgeGraphLabelMode = 'auto' | 'all' | 'none';

export interface GraphLevelRing {
  level: number;
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
}

/**
 * How prominently a node or edge is drawn. `base` is the resting graph;
 * `focus` marks the elements on the highlighted relationship path; `dim`
 * pushes everything else back so the path reads clearly.
 */
export type ElementFocusState = 'base' | 'focus' | 'dim';

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  group?: string;
  title?: string;
  description?: string;
  owner?: string;
  tags?: Array<{ name: string; tagFQN: string }>;
  name?: string;
  fullyQualifiedName?: string;
}

export interface GraphData extends Omit<RdfGraphData, 'nodes'> {
  nodes: GraphNode[];
  edges: GraphEdge[];
  filterOptions?: GraphFilterOptions;
  totalNodes?: number;
  totalEdges?: number;
  source?: string;
  error?: string;
}

export type GraphInteractionCtx = {
  graph: Graph;
  g6Nodes: G6NodeData[];
  g6Edges: G6EdgeData[];
  focusNodeId: string;
  graphDataNodes: GraphNode[];
  /** Mirrors the toolbar toggle so restoring an edge redraws its label or not. */
  showEdgeLabels: boolean;
  selectedNodeIdRef: React.MutableRefObject<string | null>;
  setSelectedNode: (node: GraphNode | null) => void;
  setEdgeTooltip: (state: EdgeTooltipState | null) => void;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  setSelectedEdge?: (edgeId: string | null) => void;
};

export interface EdgeTooltipState {
  x: number;
  y: number;
  labels: string[];
  sourceLabel: string;
  targetLabel: string;
  edgeId: string;
}

export type KnowledgeGraphLayout = 'dagre' | 'radial';

export interface GraphFilterChoice {
  id: string;
  label: string;
}

export interface KnowledgeGraphFilters {
  entityTypes: string[];
  relationshipTypes: string[];
}

export interface KnowledgeGraphToolbarProps {
  selectedLevel: KnowledgeGraphLevel;
  layout: KnowledgeGraphLayout;
  labelMode: KnowledgeGraphLabelMode;
  nodes: GraphNode[];
  filters: KnowledgeGraphFilters;
  filterOptions?: GraphFilterOptions;
  onFindNode: (nodeId: string) => void;
  onLevelChange: (level: KnowledgeGraphLevel) => void;
  onLayoutChange: (layout: KnowledgeGraphLayout) => void;
  onLabelModeChange: (mode: KnowledgeGraphLabelMode) => void;
  onFiltersChange: (filters: KnowledgeGraphFilters) => void;
  onExportJsonLd: () => Promise<void>;
  onExportPng: () => Promise<void>;
  onExportTurtle: () => Promise<void>;
}

export interface KnowledgeGraphOverlaysProps {
  edges: GraphEdge[];
  edgeTooltip: EdgeTooltipState | null;
  /** Node id → display label, for the edge manifest's test ids. */
  nodeLabelById: Map<string, string>;
  selectedNode: GraphNode | null;
  onClosePanel: () => void;
  onSlideoutOpenChange: (isOpen: boolean) => void;
}

export interface KnowledgeGraphViewControlsProps {
  isFullscreen: boolean;
  onFit: () => void;
  onFullscreen: () => void;
  onRefresh: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}
