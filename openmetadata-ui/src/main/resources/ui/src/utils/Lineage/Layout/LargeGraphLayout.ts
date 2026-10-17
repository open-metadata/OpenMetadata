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

import type { Node } from 'reactflow';
import { NODE_HEIGHT, NODE_WIDTH } from '../../../constants/Lineage.constants';

const FALLBACK_LAYER_GAP = 180;
const FALLBACK_NODE_GAP = 40;

export const layoutLargeGraphWithoutElk = (
  nodes: Node[],
  calculatedHeights: Map<string, number> = new Map()
): Node[] => {
  const nodesByDepth = new Map<number, Node[]>();

  nodes.forEach((node) => {
    const depth = node.data?.nodeDepth ?? 0;
    const layer = nodesByDepth.get(depth) ?? [];

    layer.push(node);
    nodesByDepth.set(depth, layer);
  });

  const depths = Array.from(nodesByDepth.keys()).sort((a, b) => a - b);
  const rootDepthIndex = Math.max(depths.indexOf(0), 0);
  const layerYPositions = new Map<string, number>();

  nodesByDepth.forEach((layer) => {
    let y = 0;

    layer.forEach((node) => {
      const height =
        calculatedHeights.get(node.id) ?? node.height ?? NODE_HEIGHT;

      layerYPositions.set(node.id, y);
      y += height + FALLBACK_NODE_GAP;
    });
  });

  return nodes.map((node) => {
    const depth = node.data?.nodeDepth ?? 0;
    const depthIndex = depths.indexOf(depth);
    const height = calculatedHeights.get(node.id) ?? node.height ?? NODE_HEIGHT;

    return {
      ...node,
      height,
      position: {
        x: (depthIndex - rootDepthIndex) * (NODE_WIDTH + FALLBACK_LAYER_GAP),
        y: layerYPositions.get(node.id) ?? 0,
      },
      hidden: false,
    };
  });
};
