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
import { Edge, Node, Position } from 'reactflow';
import { getEdgeCoordinates } from './CanvasUtils';
import { getEdgePathData } from './EntityLineageUtils';

export interface EdgeMidpoint {
  id: string;
  dataTestId?: string;
  canvasX: number;
  canvasY: number;
  edge: Edge;
}

export const calculateEdgeMidpoints = (
  edges: Edge[],
  getNode: (id: string) => Node | undefined,
  columnsInCurrentPages?: Map<string, string[]>
): EdgeMidpoint[] => {
  return edges
    .map((edge) => {
      const computedPath = edge.data?.computedPath;
      let centerX: number, centerY: number;

      if (computedPath) {
        centerX = computedPath.edgeCenterX;
        centerY = computedPath.edgeCenterY;
      } else {
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

        centerX = pathData.edgeCenterX;
        centerY = pathData.edgeCenterY;
      }

      return {
        id: edge.id,
        dataTestId: edge.data?.dataTestId,
        canvasX: centerX,
        canvasY: centerY,
        edge,
      };
    })
    .filter(Boolean) as EdgeMidpoint[];
};
