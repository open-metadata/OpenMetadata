/*
 *  Copyright 2026 Collate.
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

import { EntityReference } from '../../generated/type/entityReference';
import { FieldCarrier } from './rdfGraphAdapter';
import { Graph3DData, GraphLink3D, GraphNode3D, Lens, Level } from './types';

export interface KnowledgeGraph3DProps {
  // The focus entity. Beyond the reference fields, it optionally carries the
  // child fields (columns/dataModel/messageSchema/fields) the "Show columns"
  // toggle renders — see FieldCarrier.
  entity?: EntityReference & FieldCarrier;
  entityType: string;
  depth?: number;
}

export interface KnowledgeGraph3DSceneProps {
  data: Graph3DData;
  level: Level;
  gaps: boolean;
  selectedNodeId: string | null;
  selectedLinkKey: string | null;
  onSelectNode: (node: GraphNode3D | null) => void;
  onSelectLink: (link: GraphLink3D | null) => void;
  /** Builds the on-hover tooltip for a node (name · type), translated. */
  getNodeTooltip: (node: GraphNode3D) => string;
  /** Builds the on-hover tooltip for a link (the relationship), translated. */
  getLinkTooltip: (link: GraphLink3D) => string;
  /**
   * Whether the graph is in fullscreen. Toggling it re-fits the camera so the
   * graph fills the resized stage; free-form window resizes are left alone.
   */
  isFullscreen: boolean;
  /** Imperative reset handle wired by the parent to the "Reset view" control. */
  registerResetView?: (resetView: () => void) => void;
  /** Imperative PNG-export handle wired to the "Export" control. */
  registerExportImage?: (exportImage: () => Promise<string | null>) => void;
}

export interface KnowledgeGraph3DControlsProps {
  level: Level;
  lens: Lens;
  gaps: boolean;
  showColumns: boolean;
  /** Graph traversal depth (1-5); higher fetches more of the neighborhood. */
  depth: number;
  /** Translated label for the columns/fields toggle (asset-type aware). */
  columnsToggleLabel: string;
  /** When false (empty/loading graph) the Reset/Export controls are disabled. */
  hasGraph: boolean;
  onLevelChange: (level: Level) => void;
  onLensChange: (lens: Lens) => void;
  onGapsChange: (gaps: boolean) => void;
  onShowColumnsChange: (showColumns: boolean) => void;
  onDepthChange: (depth: number) => void;
  onResetView: () => void;
  onExport: () => void;
}

export interface KnowledgeGraph3DPanelProps {
  graph: Graph3DData;
  node: GraphNode3D;
  onClose: () => void;
}

export interface KnowledgeGraph3DEdgePanelProps {
  link: GraphLink3D;
  source: GraphNode3D;
  target: GraphNode3D;
  onClose: () => void;
  onSelectNode: (node: GraphNode3D) => void;
}

export interface LinkAccessors {
  isHighlightActive: boolean;
  isLinkHighlighted: (link: GraphLink3D) => boolean;
}
