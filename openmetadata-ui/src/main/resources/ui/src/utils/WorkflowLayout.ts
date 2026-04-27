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

import { Edge, Node, Position } from 'reactflow';

const NODE_WIDTH = 264;
const NODE_HEIGHT = 50;
const NODE_SPACING_X = 150;
const NODE_SPACING_Y = 150;
const CANVAS_MARGIN = 50;

export const applyFlowchartLayout = (
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[] } => {
  if (nodes.length === 0) {
    return { nodes, edges };
  }

  const nodeConnections = new Map<
    string,
    { incoming: string[]; outgoing: string[] }
  >();

  nodes.forEach((node) => {
    nodeConnections.set(node.id, { incoming: [], outgoing: [] });
  });
  edges.forEach((edge) => {
    const source = nodeConnections.get(edge.source);
    const target = nodeConnections.get(edge.target);

    if (source) {
      source.outgoing.push(edge.target);
    }
    if (target) {
      target.incoming.push(edge.source);
    }
  });
  const rootNodes = nodes.filter((node) => {
    const connections = nodeConnections.get(node.id);

    return connections && connections.incoming.length === 0;
  });

  if (rootNodes.length === 0 && nodes.length > 0) {
    rootNodes.push(nodes[0]);
  }

  const visitedNodes = new Set<string>();
  const nodeLevels = new Map<string, number>();
  const levelNodes = new Map<number, string[]>();

  const queue: Array<{ nodeId: string; level: number }> = [];

  rootNodes.forEach((node) => {
    queue.push({ nodeId: node.id, level: 0 });
  });

  while (queue.length > 0) {
    const { nodeId, level } = queue.shift()!;

    if (visitedNodes.has(nodeId)) {
      continue;
    }

    visitedNodes.add(nodeId);
    nodeLevels.set(nodeId, level);

    if (!levelNodes.has(level)) {
      levelNodes.set(level, []);
    }
    levelNodes.get(level)!.push(nodeId);

    const connections = nodeConnections.get(nodeId);
    if (connections) {
      connections.outgoing.forEach((childId) => {
        if (!visitedNodes.has(childId)) {
          queue.push({ nodeId: childId, level: level + 1 });
        }
      });
    }
  }

  nodes.forEach((node) => {
    if (!visitedNodes.has(node.id)) {
      const maxLevel = Math.max(...Array.from(nodeLevels.values()), -1);
      const newLevel = maxLevel + 1;
      nodeLevels.set(node.id, newLevel);

      if (!levelNodes.has(newLevel)) {
        levelNodes.set(newLevel, []);
      }
      levelNodes.get(newLevel)!.push(node.id);
    }
  });

  const layoutedNodes = nodes.map((node) => {
    const level = nodeLevels.get(node.id) || 0;
    const nodesAtLevel = levelNodes.get(level) || [];
    const nodeIndex = nodesAtLevel.indexOf(node.id);

    // Horizontal layout: nodes flow from left to right
    const x = CANVAS_MARGIN + level * (NODE_WIDTH + NODE_SPACING_X);

    let y: number;
    if (nodesAtLevel.length === 1) {
      // Center single nodes vertically
      y = 200; // Fixed center Y position
    } else {
      const totalHeight =
        (nodesAtLevel.length - 1) * (NODE_HEIGHT + NODE_SPACING_Y);
      const startY = 200 - totalHeight / 2;
      y = startY + nodeIndex * (NODE_HEIGHT + NODE_SPACING_Y);
    }

    return {
      ...node,
      position: { x, y },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });

  return { nodes: layoutedNodes, edges };
};
