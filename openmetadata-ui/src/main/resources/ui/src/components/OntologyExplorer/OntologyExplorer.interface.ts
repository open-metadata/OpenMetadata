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

import { Glossary } from '../../generated/entity/data/glossary';
import { EntityReference } from '../../generated/entity/type';
import { GlossaryTermRelationType } from '../../rest/settingConfigAPI';

export type OntologyScope = 'global' | 'glossary' | 'term';

export interface OntologyExplorerProps {
  scope: OntologyScope;
  entityId?: string;
  glossaryId?: string;
  className?: string;
  showHeader?: boolean;
  height?: string | number;
}

export interface OntologyNode {
  id: string;
  label: string;
  originalLabel?: string;
  assetCount?: number;
  type: string;
  fullyQualifiedName?: string;
  description?: string;
  group?: string;
  glossaryId?: string;
  entityRef?: EntityReference;
  owners?: EntityReference[];
  termId?: string;
  originalGlossary?: string;
  glossaryName?: string;
  originalNode?: OntologyNode;
}

export interface OntologyEdge {
  from: string;
  to: string;
  label: string;
  relationType: string;
}

export interface OntologyGraphData {
  nodes: OntologyNode[];
  edges: OntologyEdge[];
}

import {
  LayoutType,
  type LayoutEngineType,
} from './OntologyExplorer.constants';
import type { GraphSearchHighlightInput } from './utils/graphSearchHighlight';

export type LayoutAlgorithm = LayoutType;
export type { LayoutEngineType } from './OntologyExplorer.constants';
export type { GraphSearchHighlightInput } from './utils/graphSearchHighlight';
export type GraphViewMode = 'overview' | 'hierarchy' | 'crossGlossary';

export interface GraphSettings {
  layout: LayoutType;
  showEdgeLabels: boolean;
}

export interface GraphFilters {
  viewMode: GraphViewMode;
  glossaryIds: string[];
  relationTypes: string[];
  showIsolatedNodes: boolean;
  showCrossGlossaryOnly: boolean;
  searchQuery: string;
}

export interface OntologyGraphHandle {
  fitView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  runLayout: () => void;
  focusNode: (nodeId: string) => void;
  getNodePositions: () => Record<string, { x: number; y: number }>;
}

export interface HierarchyComboInfo {
  id: string;
  label: string;
  glossaryId: string;
}

export type ExplorationMode = 'model' | 'data' | 'hierarchy';

export interface OntologyGraphProps {
  nodes: OntologyNode[];
  edges: OntologyEdge[];
  settings: GraphSettings;
  nodePositions?: Record<string, { x: number; y: number }>;
  selectedNodeId?: string | null;
  expandedTermIds?: Set<string>;
  glossaryColorMap: Record<string, string>;
  dataSignature?: string;
  explorationMode?: ExplorationMode;
  hierarchyCombos?: HierarchyComboInfo[];
  focusNodeId?: string | null;
  graphSearchHighlight?: GraphSearchHighlightInput | null;
  onNodeClick: (
    node: OntologyNode,
    position?: { x: number; y: number },
    meta?: { dataModeAssetBadgeClick?: boolean }
  ) => void;
  onNodeDoubleClick: (node: OntologyNode) => void;
  onNodeContextMenu: (
    node: OntologyNode,
    position: { x: number; y: number }
  ) => void;
  onPaneClick: () => void;
}

export interface FilterToolbarProps {
  filters: GraphFilters;
  glossaries: Glossary[];
  relationTypes: GlossaryTermRelationType[];
  onFiltersChange: (filters: GraphFilters) => void;
  onViewModeChange?: (viewMode: GraphViewMode) => void;
  onClearAll?: () => void;
  viewModeDisabled?: boolean;
}

export interface GraphSettingsPanelProps {
  settings: GraphSettings;
  onSettingsChange: (settings: GraphSettings) => void;
}

export interface NodeContextMenuProps {
  node: OntologyNode;
  position: { x: number; y: number };
  onClose: () => void;
  onFocus: (node: OntologyNode) => void;
  onViewDetails: (node: OntologyNode) => void;
  onOpenInNewTab: (node: OntologyNode) => void;
}

export interface OntologyControlButtonsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export interface MergedEdge {
  from: string;
  to: string;
  relationType: string;
  inverseRelationType?: string;
  isBidirectional: boolean;
}

export interface LayoutConfig {
  type: 'dagre' | 'radial' | 'circular';
  [key: string]: unknown;
}

export type LayoutNodeLike = {
  id: string;
  data?: { size?: number | number[] };
};

export interface HierarchyNode extends OntologyNode {
  id: string;
  termId: string;
  glossaryId: string;
  originalGlossary?: string;
  glossaryName?: string;
  originalNode: OntologyNode;
}

export interface HierarchyEdge {
  from: string;
  to: string;
  relationType: string;
  color?: string;
}

export interface HierarchyGraphResult {
  nodes: HierarchyNode[];
  edges: HierarchyEdge[];
  combos: HierarchyComboInfo[];
}

export interface BuildHierarchyGraphsParams {
  terms: OntologyNode[];
  relations: OntologyEdge[];
  relationSettings: { relationTypes?: GlossaryTermRelationType[] } | null;
  relationColors: Record<string, string>;
  glossaryNames: Record<string, string>;
}

export interface BuildGraphDataProps {
  inputNodes: OntologyNode[];
  inputEdges: OntologyEdge[];
  explorationMode: ExplorationMode;
  settings: GraphSettings;
  selectedNodeId: string | null;
  expandedTermIds?: Set<string>;
  clickedEdgeId: string | null;
  nodePositions?: Record<string, { x: number; y: number }>;
  glossaryColorMap: Record<string, string>;
  layoutType: LayoutEngineType;
  hierarchyCombos?: HierarchyComboInfo[];
  graphSearchHighlight?: GraphSearchHighlightInput | null;
}
