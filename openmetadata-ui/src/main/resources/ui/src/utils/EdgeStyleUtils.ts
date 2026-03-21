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
import { Edge } from 'reactflow';

const EDGE_COLOR_BRAND = 'var(--tw-color-brand-600)';
const EDGE_COLOR_INDIGO = 'var(--tw-color-indigo-600)';
const EDGE_COLOR_ERROR = 'var(--tw-color-error-600)';
const EDGE_COLOR_DEFAULT = 'rgba(177, 177, 183)';

export interface EdgeStyle {
  stroke: string;
  opacity: number;
  strokeWidth: number;
}

const edgeStyleCache = new Map<string, EdgeStyle>();

function calculateEdgeStyle(
  edge: Edge,
  isNodeTraced: boolean,
  hasTracedContext: boolean,
  dqHighlightedEdges: Set<string>,
  selectedColumn: string | undefined,
  isColumnLineage: boolean,
  isColumnHighlighted: boolean,
  isEdgeHovered?: boolean
): EdgeStyle {
  let stroke = isEdgeHovered ? EDGE_COLOR_BRAND : EDGE_COLOR_DEFAULT;
  let opacity = 1;
  const strokeWidth = 2;

  if (isNodeTraced) {
    stroke = EDGE_COLOR_BRAND;
  } else if (hasTracedContext) {
    opacity = 0.3;
  }

  if (isColumnLineage && isColumnHighlighted) {
    stroke = selectedColumn ? EDGE_COLOR_INDIGO : EDGE_COLOR_BRAND;
    opacity = 1;
  }

  if (dqHighlightedEdges.has(edge.id)) {
    stroke = EDGE_COLOR_ERROR;
    opacity = 1;
  }

  return {
    stroke,
    opacity,
    strokeWidth,
  };
}

function getStyleCacheKey(
  edgeId: string,
  isNodeTraced: boolean,
  hasTracedContext: boolean,
  dqHighlightedEdgesHas: boolean,
  selectedColumn: string | undefined,
  isColumnHighlighted: boolean,
  isHoveredEdge?: boolean
): string {
  return `${edgeId}-${isNodeTraced}-${hasTracedContext}-${dqHighlightedEdgesHas}-${selectedColumn}-${isColumnHighlighted}-${isHoveredEdge}`;
}

export function computeEdgeStyle(
  edge: Edge,
  tracedNodes: Set<string>,
  tracedColumns: Set<string>,
  dqHighlightedEdges: Set<string>,
  selectedColumn: string | undefined,
  isColumnLineage: boolean,
  sourceHandle?: string | null,
  targetHandle?: string | null,
  isEdgeHovered?: boolean
): EdgeStyle {
  const fromEntityId = edge.data?.edge?.fromEntity?.id;
  const toEntityId = edge.data?.edge?.toEntity?.id;

  const isNodeTraced =
    fromEntityId &&
    toEntityId &&
    tracedNodes.has(fromEntityId) &&
    tracedNodes.has(toEntityId);

  const isColumnHighlighted =
    isColumnLineage && tracedColumns.size > 0
      ? (() => {
          return (
            tracedColumns.has(sourceHandle ?? '') &&
            tracedColumns.has(targetHandle ?? '')
          );
        })()
      : false;

  const hasTracedContext = tracedNodes.size > 0 || tracedColumns.size > 0;

  const cacheKey = getStyleCacheKey(
    edge.id,
    isNodeTraced,
    hasTracedContext,
    dqHighlightedEdges.has(edge.id),
    selectedColumn,
    isColumnHighlighted,
    isEdgeHovered
  );

  if (edgeStyleCache.has(cacheKey)) {
    return edgeStyleCache.get(cacheKey)!;
  }

  const style = calculateEdgeStyle(
    edge,
    isNodeTraced,
    hasTracedContext,
    dqHighlightedEdges,
    selectedColumn,
    isColumnLineage,
    isColumnHighlighted,
    isEdgeHovered
  );

  edgeStyleCache.set(cacheKey, style);

  return style;
}

export function clearEdgeStyleCache(): void {
  edgeStyleCache.clear();
}

export function invalidateEdgeStyles(affectedEdgeIds: string[]): void {
  affectedEdgeIds.forEach((id) => {
    const keysToDelete: string[] = [];
    edgeStyleCache.forEach((_, key) => {
      if (key.startsWith(`${id}-`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => edgeStyleCache.delete(key));
  });
}
