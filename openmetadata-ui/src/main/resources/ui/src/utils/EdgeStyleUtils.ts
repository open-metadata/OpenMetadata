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
import type { Edge } from 'reactflow';

export interface EdgeStyle {
  stroke: string;
  opacity: number;
  strokeWidth: number;
}

export interface LineageEdgeColors {
  primary: string;
  columnHighlight: string;
  dqHighlight: string;
}

const edgeStyleCache = new Map<string, EdgeStyle>();
let cachedColorSignature = '';

function calculateEdgeStyle(
  edge: Edge,
  isNodeTraced: boolean,
  hasTracedContext: boolean,
  dqHighlightedEdges: Set<string>,
  selectedColumn: string | undefined,
  colors: LineageEdgeColors,
  isColumnLineage: boolean,
  isColumnHighlighted: boolean,
  isEdgeHovered?: boolean
): EdgeStyle {
  let stroke = isEdgeHovered ? colors.primary : 'rgba(177, 177, 183)';
  let opacity = 1;
  const strokeWidth = 2;

  if (isNodeTraced) {
    stroke = colors.primary;
  } else if (hasTracedContext) {
    opacity = 0.3;
  }

  if (isColumnLineage && isColumnHighlighted) {
    stroke = selectedColumn ? colors.columnHighlight : colors.primary;
    opacity = 1;
  }

  if (dqHighlightedEdges.has(edge.id)) {
    stroke = colors.dqHighlight;
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
  colors: LineageEdgeColors,
  isColumnLineage: boolean,
  sourceHandle?: string | null,
  targetHandle?: string | null,
  isEdgeHovered?: boolean
): EdgeStyle {
  // Cache keys don't encode colors, so drop cached styles when the resolved
  // colors change (e.g. the user updates the brand/custom theme) to avoid
  // repainting stale strokes.
  const colorSignature = `${colors.primary}|${colors.columnHighlight}|${colors.dqHighlight}`;
  if (colorSignature !== cachedColorSignature) {
    edgeStyleCache.clear();
    cachedColorSignature = colorSignature;
  }

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
    colors,
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
