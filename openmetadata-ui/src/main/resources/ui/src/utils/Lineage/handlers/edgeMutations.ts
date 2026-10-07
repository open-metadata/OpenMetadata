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
import { AxiosError } from 'axios';
import { Edge } from 'reactflow';
import { buildLineagePayload } from '../../../components/Lineage/LineageMap/LineageMapEdit.utils';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { EdgeFromToData } from '../../../interface/lineage.interface';
import { getLineageEdgeDetails } from '../../../rest/lineageAPI';
import { addLineageHandler } from '../../EntityLineagePureUtils';

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

const getExistingEdgeDetails = async (fromId: string, toId: string) => {
  try {
    return await getLineageEdgeDetails(fromId, toId);
  } catch (error) {
    if ((error as AxiosError).response?.status !== 404) {
      throw error;
    }

    return undefined;
  }
};

/**
 * Adds (or extends) the lineage edge between two entities, merging a column
 * pair into the edge's existing column lineage. Resolves false when there is
 * nothing to save (same entity, or the column pair is already mapped).
 */
export const saveLineageEdge = async (
  fromEntity: EdgeFromToData,
  toEntity: EdgeFromToData,
  columnPair?: { fromColumn: string; toColumn: string }
): Promise<boolean> => {
  const existingDetails = await getExistingEdgeDetails(
    fromEntity.id,
    toEntity.id
  );
  const payload = buildLineagePayload(
    fromEntity,
    toEntity,
    existingDetails,
    columnPair
  );
  if (!payload) {
    return false;
  }
  await addLineageHandler(payload);

  return true;
};
