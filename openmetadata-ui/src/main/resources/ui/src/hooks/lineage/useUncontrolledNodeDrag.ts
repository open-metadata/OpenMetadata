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
import { useCallback, useEffect, useRef } from 'react';
import {
  applyNodeChanges,
  Node,
  NodeChange,
  OnNodesChange,
  useStoreApi,
  XYPosition,
} from 'reactflow';

interface DragPosition {
  position: XYPosition;
  positionAbsolute?: XYPosition;
}

const isDragFrame = (change: NodeChange) =>
  change.type === 'position' && Boolean(change.dragging);

/**
 * Lets React Flow own node positions while a drag is in progress.
 *
 * Controlled nodes round-trip every drag frame through React state and back
 * into React Flow's store; with auto-pan that happens several times per frame
 * and can exceed React's nested-update limit. Drag frames are applied to React
 * Flow's store only, and the drag-end change, which carries no position, is
 * filled in so the caller receives the final position once.
 *
 * The caller's nodes keep their pre-drag positions until the drop, and any
 * re-render of them mid-drag (a hover highlight, a measured node) re-syncs
 * React Flow's store. Pass the returned `nodes` to `<ReactFlow>`: they carry
 * the in-flight drag positions, so such a re-sync cannot snap a dragged node
 * back or let the drop save its start position.
 *
 * Must be called inside a `ReactFlowProvider`.
 */
export const useUncontrolledNodeDrag = <T extends Node>(
  nodes: T[],
  onNodesChange: OnNodesChange
) => {
  const store = useStoreApi();
  const dragPositions = useRef(new Map<string, DragPosition>());

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const dragFrames = changes.filter(isDragFrame);
      let abandoned: NodeChange[] = [];
      if (dragFrames.length) {
        // Each frame carries every node being dragged. A remembered node
        // missing from it had its drag cancelled (a second touch) with no
        // drop, so it is settled where it was left.
        const draggedIds = new Set(
          dragFrames.flatMap((change) =>
            change.type === 'position' ? [change.id] : []
          )
        );
        abandoned = [...dragPositions.current]
          .filter(([id]) => !draggedIds.has(id))
          .map(([id, drag]) => ({
            id,
            type: 'position',
            dragging: false,
            ...drag,
          }));
        dragPositions.current = new Map();
        for (const change of dragFrames) {
          if (change.type === 'position' && change.position) {
            dragPositions.current.set(change.id, {
              position: change.position,
              positionAbsolute: change.positionAbsolute,
            });
          }
        }
        const { getNodes, setNodes } = store.getState();
        setNodes(applyNodeChanges([...abandoned, ...dragFrames], getNodes()));
      }

      const committed = changes
        .filter((change) => !isDragFrame(change))
        .map((change) => {
          if (change.type !== 'position') {
            return change;
          }
          const dragged = dragPositions.current.get(change.id);
          dragPositions.current.delete(change.id);

          return dragged && !change.position
            ? { ...change, ...dragged }
            : change;
        });
      if (abandoned.length || committed.length) {
        onNodesChange([...abandoned, ...committed]);
      }
    },
    [onNodesChange, store]
  );

  // A touch drag aborted by a second touch (e.g. a pinch-zoom attempt)
  // never dispatches the drop change — React Flow's drag-end handler returns
  // early when `abortDrag` is set, so `handleNodesChange` above is never called
  // and `dragPositions` is never drained.  Without this listener the entry
  // would persist indefinitely and the render-time overlay below would
  // re-stamp `dragging: true` and the mid-drag position onto the node on
  // every future re-render (pane clicks, selects, lineage refetches), leaving
  // its edges hidden and its position diverged from the lineage state.
  //
  // d3-drag registers its touchend/touchcancel handler on the flow container
  // (bubble phase); this listener is on `window`, so it runs *after* React
  // Flow's handler.  For a normal drag the drop has already been dispatched
  // and `dragPositions` drained by the time this fires, making the settlement
  // a no-op.  For a cancelled drag the entry is still present and is settled
  // here so the caller receives the final position and the overlay clears.
  useEffect(() => {
    const settleStale = () => {
      if (dragPositions.current.size === 0) {
        return;
      }
      const abandoned: NodeChange[] = [...dragPositions.current].map(
        ([id, drag]) => ({
          id,
          type: 'position',
          dragging: false,
          ...drag,
        })
      );
      dragPositions.current = new Map();
      const { getNodes, setNodes } = store.getState();
      setNodes(applyNodeChanges(abandoned, getNodes()));
      onNodesChange(abandoned);
    };
    window.addEventListener('touchend', settleStale);
    window.addEventListener('touchcancel', settleStale);
    window.addEventListener('mouseup', settleStale);

    return () => {
      window.removeEventListener('touchend', settleStale);
      window.removeEventListener('touchcancel', settleStale);
      window.removeEventListener('mouseup', settleStale);
    };
  }, [onNodesChange, store]);

  const drags = dragPositions.current;
  const flowNodes = drags.size
    ? nodes.map((node) => {
        const dragged = drags.get(node.id);

        return dragged ? { ...node, ...dragged, dragging: true } : node;
      })
    : nodes;

  return { nodes: flowNodes, onNodesChange: handleNodesChange };
};
