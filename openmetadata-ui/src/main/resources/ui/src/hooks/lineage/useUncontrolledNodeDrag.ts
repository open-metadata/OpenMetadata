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
import { useCallback } from 'react';
import {
  applyNodeChanges,
  NodeChange,
  OnNodesChange,
  useStoreApi,
} from 'reactflow';

const isDragFrame = (change: NodeChange) =>
  change.type === 'position' && Boolean(change.dragging);

/**
 * Lets React Flow own node positions while a drag is in progress.
 *
 * Controlled nodes round-trip every drag frame through React state and back
 * into React Flow's store; with auto-pan that happens several times per frame
 * and can exceed React's nested-update limit. Drag frames are applied to React
 * Flow's store only, and the drag-end change, which carries no position, is
 * filled in from it so the caller receives the final position once.
 *
 * Any other change the caller receives mid-drag (say, React Flow measuring a
 * node auto-pan just revealed) makes React Flow re-sync from the caller's
 * nodes, which still hold the pre-drag positions. Those batches therefore also
 * carry the dragged nodes' current positions, so the re-sync cannot snap a
 * dragged node back or let the drop save its start position.
 *
 * Must be called inside a `ReactFlowProvider`.
 */
export const useUncontrolledNodeDrag = (
  onNodesChange: OnNodesChange
): OnNodesChange => {
  const store = useStoreApi();

  return useCallback(
    (changes) => {
      const { getNodes, setNodes, nodeInternals } = store.getState();
      const dragFrames = changes.filter(isDragFrame);
      if (dragFrames.length) {
        setNodes(applyNodeChanges(dragFrames, getNodes()));
      }

      const committed = changes
        .filter((change) => !isDragFrame(change))
        .map((change) => {
          const node =
            change.type === 'position' && !change.position
              ? nodeInternals.get(change.id)
              : undefined;

          return node
            ? {
                ...change,
                position: node.position,
                positionAbsolute: node.positionAbsolute,
              }
            : change;
        });
      if (!committed.length) {
        return;
      }
      const endingIds = new Set(
        committed.flatMap((change) =>
          change.type === 'position' ? [change.id] : []
        )
      );
      const inFlight: NodeChange[] = store
        .getState()
        .getNodes()
        .filter((node) => node.dragging && !endingIds.has(node.id))
        .map((node) => ({
          id: node.id,
          type: 'position',
          dragging: true,
          position: node.position,
          positionAbsolute: node.positionAbsolute,
        }));
      onNodesChange([...inFlight, ...committed]);
    },
    [onNodesChange, store]
  );
};
