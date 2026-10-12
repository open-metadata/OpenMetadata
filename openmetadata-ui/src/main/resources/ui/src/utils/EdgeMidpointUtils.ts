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
import type { Edge, Node } from 'reactflow';
import { Position } from 'reactflow';
import { getEdgeCoordinates } from './CanvasUtils';
import { computeEdgeVisualState, EdgeVisualState } from './EdgeStyleUtils';
import { getEdgePathData } from './EntityLineageEdgeUtils';
import { getEntityName } from './EntityNameUtils';

export interface EdgeMidpoint {
  id: string;
  dataTestId?: string;
  canvasX: number;
  canvasY: number;
  edge: Edge;
  visualState: EdgeVisualState;
}

const computeEdgeCenter = (
  edge: Edge,
  getNode: (id: string) => Node | undefined,
  columnsInCurrentPages?: Map<string, string[]>
): { centerX: number; centerY: number } | null => {
  const computedPath = edge.data?.computedPath;

  if (computedPath) {
    return {
      centerX: computedPath.edgeCenterX,
      centerY: computedPath.edgeCenterY,
    };
  }

  const coords = getEdgeCoordinates(
    edge,
    getNode(edge.source),
    getNode(edge.target),
    columnsInCurrentPages
  );

  if (!coords) {
    return null;
  }

  const pathData = getEdgePathData(edge.source, edge.target, {
    sourceX: coords.sourceX,
    sourceY: coords.sourceY,
    targetX: coords.targetX,
    targetY: coords.targetY,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  });

  return { centerX: pathData.edgeCenterX, centerY: pathData.edgeCenterY };
};

const computeEdgeDataTestId = (edge: Edge): string | undefined => {
  const {
    isColumnLineage,
    edge: edgeDetails,
    columnFunctionValue,
    isExpanded,
  } = edge.data || {};

  const hasPipeline =
    !isColumnLineage &&
    edgeDetails?.pipeline &&
    getEntityName(edgeDetails.pipeline);
  const hasFunction = !isColumnLineage && columnFunctionValue && isExpanded;

  if ((hasPipeline || hasFunction) && edgeDetails) {
    return `pipeline-label-${edgeDetails.fromEntity.fullyQualifiedName}-${edgeDetails.toEntity.fullyQualifiedName}`;
  }

  return edge.data?.dataTestId;
};

export const calculateEdgeMidpoints = (
  edges: Edge[],
  getNode: (id: string) => Node | undefined,
  columnsInCurrentPages?: Map<string, string[]>,
  tracedNodes: Set<string> = new Set(),
  tracedColumns: Set<string> = new Set()
): EdgeMidpoint[] => {
  return edges
    .map((edge) => {
      const center = computeEdgeCenter(edge, getNode, columnsInCurrentPages);

      if (!center) {
        return null;
      }

      return {
        id: edge.id,
        dataTestId: computeEdgeDataTestId(edge),
        canvasX: center.centerX,
        canvasY: center.centerY,
        edge,
        visualState: computeEdgeVisualState(edge, tracedNodes, tracedColumns),
      };
    })
    .filter(Boolean) as EdgeMidpoint[];
};
