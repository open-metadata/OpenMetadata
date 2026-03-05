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

import { EntityReference } from '../../generated/entity/type';

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
  type: string;
  fullyQualifiedName?: string;
  description?: string;
  group?: string;
  glossaryId?: string;
  entityRef?: EntityReference;
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

export interface ConceptsTreeNode {
  key: string;
  title: string;
  type: 'glossary' | 'term' | 'tag' | 'domain';
  icon?: React.ReactNode;
  children?: ConceptsTreeNode[];
  isLeaf?: boolean;
  data?: {
    id: string;
    fullyQualifiedName: string;
    description?: string;
    relationsCount?: number;
  };
}

export interface ConceptsTreeProps {
  scope: OntologyScope;
  entityId?: string;
  glossaryId?: string;
  selectedNodeId?: string;
  onNodeSelect: (node: ConceptsTreeNode) => void;
  onNodeFocus: (nodeId: string) => void;
}

export interface DetailsPanelProps {
  node: OntologyNode | null;
  onClose: () => void;
  onNavigate?: (node: OntologyNode) => void;
  onAddRelation?: (fromNode: OntologyNode) => void;
}

export type LayoutAlgorithm = 'force' | 'hierarchical' | 'radial' | 'circular';
export type NodeColorMode =
  | 'glossary'
  | 'relationType'
  | 'hierarchyLevel'
  | 'connectionCount';
export type NodeSizeMode = 'uniform' | 'connectionCount' | 'childCount';
export type GraphViewMode =
  | 'overview'
  | 'hierarchy'
  | 'neighborhood'
  | 'crossGlossary';

export interface GraphSettings {
  layout: LayoutAlgorithm;
  nodeColorMode: NodeColorMode;
  nodeSizeMode: NodeSizeMode;
  showEdgeLabels: boolean;
  showNodeDescriptions: boolean;
  showGlossaryHulls: boolean;
  showMetrics: boolean;
  highlightOnHover: boolean;
  animateTransitions: boolean;
  physicsEnabled: boolean;
  edgeBundling: boolean;
}

export interface GraphFilters {
  viewMode: GraphViewMode;
  glossaryIds: string[];
  relationTypes: string[];
  hierarchyLevels: number[];
  showIsolatedNodes: boolean;
  showCrossGlossaryOnly: boolean;
  searchQuery: string;
  depth: number;
}

export interface NodeContextMenuAction {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onClick: (node: OntologyNode) => void;
  disabled?: boolean;
}

export interface EnhancedOntologyNode extends OntologyNode {
  depth?: number;
  connectionCount?: number;
  childCount?: number;
  glossaryName?: string;
  glossaryColor?: string;
  isHighlighted?: boolean;
  isFaded?: boolean;
}
