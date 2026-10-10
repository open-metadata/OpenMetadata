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
import { Edge } from 'reactflow';
import { useLineageStore } from '../../../hooks/useLineageStore';

export const onEdgeClick = (edge: Edge): void => {
  const {
    setSelectedEdge,
    openDrawer,
    setActiveNode,
    setSelectedNode,
    setTracedNodes,
    setTracedColumns,
  } = useLineageStore.getState();

  setSelectedEdge(edge);
  openDrawer();
  setActiveNode(undefined);
  setSelectedNode(undefined);
  setTracedNodes(new Set());

  const { sourceHandle, targetHandle } = edge;
  if (sourceHandle && targetHandle) {
    setTracedColumns(new Set([sourceHandle, targetHandle]));
  }
};

export const onAddPipelineClick = (): void => {
  useLineageStore.getState().openAddEdgeModal();
};

export const onColumnEdgeRemove = (): void => {
  useLineageStore.getState().openDeleteModal();
};
