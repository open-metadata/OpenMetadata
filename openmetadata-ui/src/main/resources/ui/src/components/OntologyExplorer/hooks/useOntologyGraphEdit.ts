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

import { useCallback, useEffect, useRef, useState } from 'react';

export interface Point {
  x: number;
  y: number;
}

export interface PendingRelation {
  fromId: string;
  toId: string;
  at: Point;
}

export interface UseOntologyGraphEditParams {
  isEditMode: boolean;
  /** Container-local center point of each node, keyed by node id. */
  nodePositions: Record<string, Point>;
  /** Convert a window client point to a container-local point, or null if outside. */
  toLocalPoint: (clientX: number, clientY: number) => Point | null;
  onCreateRelation: (
    fromId: string,
    toId: string,
    relationType: string
  ) => Promise<void> | void;
}

const HIT_RADIUS = 44;

export function findNearestNode(
  nodePositions: Record<string, Point>,
  point: Point,
  excludeId: string
): string | null {
  let nearestId: string | null = null;
  let nearestDistance = HIT_RADIUS;
  Object.entries(nodePositions).forEach(([id, pos]) => {
    if (id !== excludeId) {
      const distance = Math.hypot(pos.x - point.x, pos.y - point.y);
      if (distance <= nearestDistance) {
        nearestDistance = distance;
        nearestId = id;
      }
    }
  });

  return nearestId;
}

/**
 * Draw-to-connect gesture state machine. Owns the pointer drag lifecycle from an
 * armed source node to a target node; hit-testing is done against container-local
 * node centers. Rendering (port handles + provisional line) lives in the overlay
 * that consumes this hook, so the gesture logic here is DOM-agnostic and testable.
 */
export const useOntologyGraphEdit = ({
  isEditMode,
  nodePositions,
  toLocalPoint,
  onCreateRelation,
}: UseOntologyGraphEditParams) => {
  const [armedFromId, setArmedFromId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [candidateTargetId, setCandidateTargetId] = useState<string | null>(
    null
  );
  const [pendingRelation, setPendingRelation] =
    useState<PendingRelation | null>(null);

  const nodePositionsRef = useRef(nodePositions);
  nodePositionsRef.current = nodePositions;
  const toLocalPointRef = useRef(toLocalPoint);
  toLocalPointRef.current = toLocalPoint;

  const cancel = useCallback(() => {
    setArmedFromId(null);
    setCursor(null);
    setCandidateTargetId(null);
  }, []);

  const startArm = useCallback(
    (fromId: string, at: Point) => {
      if (isEditMode) {
        setPendingRelation(null);
        setArmedFromId(fromId);
        setCursor(at);
        setCandidateTargetId(null);
      }
    },
    [isEditMode]
  );

  const selectTarget = useCallback(
    (toId: string) => {
      if (armedFromId === null || toId === armedFromId) {
        return;
      }
      const from = nodePositionsRef.current[armedFromId];
      const to = nodePositionsRef.current[toId];
      if (!from || !to) {
        return;
      }
      setPendingRelation({
        fromId: armedFromId,
        toId,
        at: {
          x: (from.x + to.x) / 2,
          y: (from.y + to.y) / 2,
        },
      });
      cancel();
    },
    [armedFromId, cancel]
  );

  const setCandidateTarget = useCallback(
    (toId: string | null) => {
      setCandidateTargetId(
        armedFromId !== null && toId !== armedFromId ? toId : null
      );
    },
    [armedFromId]
  );

  useEffect(() => {
    if (armedFromId === null) {
      return undefined;
    }

    const handleMove = (event: PointerEvent) => {
      const local = toLocalPointRef.current(event.clientX, event.clientY);
      if (local) {
        setCursor(local);
        setCandidateTargetId(
          findNearestNode(nodePositionsRef.current, local, armedFromId)
        );
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cancel();
        setPendingRelation(null);
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('keydown', handleKey);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('keydown', handleKey);
    };
  }, [armedFromId, cancel]);

  useEffect(() => {
    if (!isEditMode) {
      cancel();
      setPendingRelation(null);
    }
  }, [cancel, isEditMode]);

  const confirmRelationType = useCallback(
    async (relationType: string) => {
      const pending = pendingRelation;
      setPendingRelation(null);
      if (pending) {
        await onCreateRelation(pending.fromId, pending.toId, relationType);
      }
    },
    [pendingRelation, onCreateRelation]
  );

  const dismissPending = useCallback(() => {
    setPendingRelation(null);
  }, []);

  return {
    armedFromId,
    cursor,
    candidateTargetId,
    pendingRelation,
    startArm,
    selectTarget,
    setCandidateTarget,
    cancel,
    confirmRelationType,
    dismissPending,
  };
};
