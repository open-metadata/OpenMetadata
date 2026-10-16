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

import type { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk.bundled.js';
import type { Edge, Node } from 'reactflow';
import { NODE_WIDTH } from '../../../constants/Lineage.constants';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { getNodeHeight } from '../../CanvasUtils';
import { getEntityChildrenAndLabel } from '../../EntityLineageNodeUtils';

/**
 * Lazy boundary for the ELK engine.
 *
 * elkjs is ~1.37MB in the built bundle and this is the only module that needs
 * it. Loading it here — rather than at module scope — keeps it out of whatever
 * chunk imports this file. `LineageProvider` is statically imported by eight
 * lineage components, so a top-level import would put the engine in the shared
 * chunk that every authenticated route pulls, including glossary pages that
 * render with G6/antv-dagre and never call ELK.
 */
const loadElkLayout = async () => (await import('./ELKUtil/ELKUtil')).default;

export const getELKLayoutedElements = async (
  nodes: Node[],
  edges: Edge[],
  columnsHavingLineage: Map<string, Set<string>> = new Map()
) => {
  const { nodeFilterState, isColumnLevelLineage, isEditMode } =
    useLineageStore.getState();
  const elkNodes: ElkNode[] = nodes.map((node) => {
    const isColumnOnlyFilterActive =
      (isColumnLevelLineage || nodeFilterState.get(node.id)) ?? false;
    const columns = isEditMode
      ? getEntityChildrenAndLabel(node.data.node).children.length
      : columnsHavingLineage.get(node.id)?.size ?? 0;

    const nodeHeight = getNodeHeight(node, isColumnOnlyFilterActive, columns);

    return {
      id: node.id,
      width: NODE_WIDTH,
      height: nodeHeight,
    };
  });

  const elkEdges: ElkExtendedEdge[] = edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));

  try {
    const ELKLayout = await loadElkLayout();
    const layoutedGraph = await ELKLayout.layoutGraph(elkNodes, elkEdges);
    const layoutedMap = new Map(
      (layoutedGraph?.children ?? []).map((n) => [n.id, n])
    );
    const updatedNodes: Node[] = nodes.map((node) => {
      const layoutedNode = layoutedMap.get(node.id);

      return {
        ...node,
        position: { x: layoutedNode?.x ?? 0, y: layoutedNode?.y ?? 0 },
        height: layoutedNode?.height ?? node.height,
        hidden: false,
      };
    });

    return { nodes: updatedNodes, edges: edges ?? [] };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error occurred while layouting graph:', error);

    return { nodes: [], edges: [] };
  }
};

export const positionNodesUsingElk = async (
  nodes: Node[],
  edges: Edge[],
  columnsHavingLineage: Map<string, Set<string>>
) => {
  const obj = await getELKLayoutedElements(nodes, edges, columnsHavingLineage);

  return obj;
};
