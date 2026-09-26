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
import { createContext, DragEvent, useContext } from 'react';
import type { Connection, Edge, Node, NodeProps } from 'reactflow';
import { ExportTypes } from '../../../constants/Export.constants';
import { EntityType } from '../../../enums/entity.enum';
import { AddLineage } from '../../../generated/api/lineage/addLineage';
import { LineageDirection } from '../../../generated/api/lineage/lineageDirection';
import { CSVExportResponse } from '../../Entity/EntityExportModalProvider/EntityExportModalProvider.interface';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import { LineageNodeType } from '../Lineage.interface';

// The subset of `<Lineage />`'s internal handlers that cannot be plain,
// store-driven functions because they close over React-tree state (ELK
// relayout, JSX node labels, transactional REST awaits, router-aware
// pagination). Everything else a descendant needs is read directly off
// `useLineageStore`.
export type LineageHandlersValue = {
  loadChildNodesHandler: (
    node: LineageNodeType,
    direction: LineageDirection,
    depth?: number
  ) => Promise<void>;
  removeNodeHandler: (node: Node | NodeProps) => Promise<void>;
  onNodeClick: (node: Node) => void;
  onNodeDrop: (event: DragEvent, reactFlowBounds: DOMRect) => void;
  onNodeCollapse: (node: Node | NodeProps, direction: LineageDirection) => void;
  onConnect: (connection: Edge | Connection) => void;
  onEdgeDetailsUpdate: (updatedEdgeDetails: AddLineage) => Promise<void>;
  updateEntityData: (
    entityType: EntityType,
    entity?: SourceType,
    isPlatformLineage?: boolean
  ) => void;
  handleEntityUpdate: (updatedEntity: Partial<SourceType>) => void;
  onExportClick: (
    exportTypes?: ExportTypes[],
    onExportCallback?: (_: string) => Promise<CSVExportResponse>
  ) => void;
};

const noop = () => undefined;
const noopAsync = () => Promise.resolve();

export const LineageHandlersContext = createContext<LineageHandlersValue>({
  loadChildNodesHandler: noopAsync,
  removeNodeHandler: noopAsync,
  onNodeClick: noop,
  onNodeDrop: noop,
  onNodeCollapse: noop,
  onConnect: noop,
  onEdgeDetailsUpdate: noopAsync,
  updateEntityData: noop,
  handleEntityUpdate: noop,
  onExportClick: noop,
});

export const useLineageHandlers = () => useContext(LineageHandlersContext);
