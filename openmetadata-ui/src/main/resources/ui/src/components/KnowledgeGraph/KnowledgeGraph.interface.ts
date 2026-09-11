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
import type { RelationCategory } from './KnowledgeGraph.relations';

export interface KnowledgeGraphProps {
  entity?: EntityReference;
  entityType: string;
  levels?: KnowledgeGraphLevel;
}

export type KnowledgeGraphLevel = 1 | 2 | 3;
export type KnowledgeGraphLabelMode = 'auto' | 'all' | 'none';
export type KnowledgeGraphMode = 'knowledge-graph' | 'ontology';
export type KnowledgeGraphPresentation = 'balanced' | 'all';
export type KnowledgeGraphDrawer = 'columns' | 'relationships' | 'coverage';
export type MappingCoverage = 'mapped' | 'unmapped' | 'unknown';

export interface GraphNodePresentation {
  level: number;
  position: { x: number; y: number };
  size: [number, number];
  root?: boolean;
  members?: GraphNode[];
  predicate?: string;
  relationType?: string;
  direction?: 'in' | 'out';
  anchorId?: string;
  groupId?: string;
  expanded?: boolean;
  side?: 'left' | 'right' | 'top' | 'bottom';
  coverage?: MappingCoverage;
}

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
  ontologyProperty?: { range: string; functional: boolean };
  presentation?: GraphNodePresentation;
}

export interface GraphDerivation {
  nodes: GraphNode[];
  /** Original predicates retain their direction, even when the chain walks backwards. */
  edges: GraphEdge[];
}

export interface KnowledgeGraphEdge extends GraphEdge {
  id?: string;
  derivation?: GraphDerivation;
  members?: KnowledgeGraphEdge[];
  category?: RelationCategory;
  /** A connector to an expanded member represents an existing bundle, not another RDF statement. */
  presentationOnly?: boolean;
}

export interface KnowledgeGraphG6Edge extends G6EdgeData {
  data: {
    label: string;
    category: RelationCategory;
    relationType?: string;
    derivation?: GraphDerivation;
    members?: KnowledgeGraphEdge[];
    presentationOnly?: boolean;
  };
}

export interface GraphData extends Omit<RdfGraphData, 'nodes' | 'edges'> {
  nodes: GraphNode[];
  edges: KnowledgeGraphEdge[];
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
  derived?: boolean;
}

export type KnowledgeGraphLayout = 'dagre' | 'radial' | 'lanes';

export interface GraphFilterChoice {
  id: string;
  label: string;
}

export interface KnowledgeGraphFilters {
  entityTypes: string[];
  relationshipTypes: string[];
}

/** The Columns / Relationships / Gaps tabs that open the details drawer. */
export interface KnowledgeGraphDetailsControl {
  active: KnowledgeGraphDrawer | null;
  counts: Record<KnowledgeGraphDrawer, number>;
  onChange: (drawer: KnowledgeGraphDrawer) => void;
}

export interface KnowledgeGraphToolbarProps {
  hasFilters?: boolean;
  selectedLevel: KnowledgeGraphLevel;
  layout: KnowledgeGraphLayout;
  labelMode: KnowledgeGraphLabelMode;
  mode: KnowledgeGraphMode;
  nodes: GraphNode[];
  filters: KnowledgeGraphFilters;
  filterOptions?: GraphFilterOptions;
  presentation: KnowledgeGraphPresentation;
  showBands: boolean;
  excludedFamilies: RelationCategory[];
  familyCounts: Record<RelationCategory, number>;
  ontology: {
    concepts: GraphNode[];
    selectedId?: string;
    onChange: (id: string) => void;
  };
  viewport: { isFullscreen: boolean; onFullscreen: () => void };
  onPresentationChange: (presentation: KnowledgeGraphPresentation) => void;
  onToggleBands: () => void;
  onToggleFamily: (family: RelationCategory) => void;
  onClearFilters: () => void;
  onFindNode: (nodeId: string) => void;
  onLevelChange: (level: KnowledgeGraphLevel) => void;
  onLayoutChange: (layout: KnowledgeGraphLayout) => void;
  onLabelModeChange: (mode: KnowledgeGraphLabelMode) => void;
  onModeChange: (mode: KnowledgeGraphMode) => void;
  onFiltersChange: (filters: KnowledgeGraphFilters) => void;
  onExportJsonLd: () => Promise<void>;
  onExportPng: () => Promise<void>;
  onExportTurtle: () => Promise<void>;
  onExportCsv: () => Promise<void>;
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
  zoom?: number;
  onFit: () => void;
  onFullscreen: () => void;
  onRefresh: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}
