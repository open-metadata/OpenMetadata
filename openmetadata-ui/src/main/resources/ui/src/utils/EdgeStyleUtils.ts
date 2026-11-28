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
import { DependencyType } from '../generated/type/entityLineage';

export const INDIRECT_EDGE_LINE_DASH = [6, 4];

export interface EdgeStyle {
  stroke: string;
  opacity: number;
  strokeWidth: number;
  lineDash?: number[];
}

export interface LineageEdgeColors {
  primary: string;
  columnHighlight: string;
  dqHighlight: string;
  indirect?: string;
  labelBackground: string;
  labelBorder?: string;
  labelText: string;
}

export function isIndirectEdge(edge: Edge): boolean {
  const dependencyType =
    edge.data?.edge?.dependencyType ?? edge.data?.sceneEdge?.dependencyType;

  return dependencyType === DependencyType.Indirect;
}

const EDGE_STYLE_CACHE_MAX = 1_000;
const edgeStyleCache = new Map<string, EdgeStyle>();
let cachedColorSignature = '';

function getBaseEdgeAppearance(
  isIndirect: boolean,
  isEdgeHovered: boolean | undefined,
  colors: LineageEdgeColors
): { stroke: string; opacity: number } {
  if (isEdgeHovered) {
    return { stroke: colors.primary, opacity: 1 };
  }
  if (isIndirect) {
    return {
      stroke: colors.indirect ?? 'rgba(177, 177, 183)',
      opacity: 0.7,
    };
  }

  return { stroke: 'rgba(177, 177, 183)', opacity: 1 };
}

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
  const isIndirect = isIndirectEdge(edge);
  let { stroke, opacity } = getBaseEdgeAppearance(
    isIndirect,
    isEdgeHovered,
    colors
  );
  const strokeWidth = 2;

  if (isNodeTraced) {
    stroke = colors.primary;
    opacity = 1;
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

  return isIndirect
    ? { stroke, opacity, strokeWidth, lineDash: INDIRECT_EDGE_LINE_DASH }
    : { stroke, opacity, strokeWidth };
}

function isEdgeNodeTraced(edge: Edge, tracedNodes: Set<string>): boolean {
  const fromEntityId = edge.data?.edge?.fromEntity?.id;
  const toEntityId = edge.data?.edge?.toEntity?.id;

  return Boolean(
    fromEntityId &&
      toEntityId &&
      tracedNodes.has(fromEntityId) &&
      tracedNodes.has(toEntityId)
  );
}

function getStyleCacheKey(
  edgeId: string,
  isIndirect: boolean,
  isNodeTraced: boolean,
  hasTracedContext: boolean,
  dqHighlightedEdgesHas: boolean,
  selectedColumn: string | undefined,
  isColumnHighlighted: boolean,
  isHoveredEdge?: boolean
): string {
  return `${edgeId}-${isIndirect}-${isNodeTraced}-${hasTracedContext}-${dqHighlightedEdgesHas}-${selectedColumn}-${isColumnHighlighted}-${isHoveredEdge}`;
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
  const colorSignature = `${colors.primary}|${colors.columnHighlight}|${
    colors.dqHighlight
  }|${colors.indirect ?? ''}|${colors.labelBackground}|${colors.labelText}`;
  if (colorSignature !== cachedColorSignature) {
    edgeStyleCache.clear();
    cachedColorSignature = colorSignature;
  }

  const isIndirect = isIndirectEdge(edge);
  const isNodeTraced = isEdgeNodeTraced(edge, tracedNodes);

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
    isIndirect,
    isNodeTraced,
    hasTracedContext,
    dqHighlightedEdges.has(edge.id),
    selectedColumn,
    isColumnHighlighted,
    isEdgeHovered
  );

  const cachedStyle = edgeStyleCache.get(cacheKey);
  if (cachedStyle) {
    edgeStyleCache.delete(cacheKey);
    edgeStyleCache.set(cacheKey, cachedStyle);

    return cachedStyle;
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

  if (edgeStyleCache.size >= EDGE_STYLE_CACHE_MAX) {
    const oldestKey = edgeStyleCache.keys().next().value;
    if (oldestKey !== undefined) {
      edgeStyleCache.delete(oldestKey);
    }
  }
  edgeStyleCache.set(cacheKey, style);

  return style;
}

export function clearEdgeStyleCache(): void {
  edgeStyleCache.clear();
}

export type EdgeVisualState = 'traced' | 'dimmed' | 'hidden' | 'default';

function getColumnLineageEdgeState(
  edge: Edge,
  tracedColumns: Set<string>,
  inColumnMode: boolean,
  inNodeMode: boolean
): EdgeVisualState {
  if (inColumnMode) {
    const isColumnHighlighted =
      tracedColumns.has(edge.sourceHandle ?? '') &&
      tracedColumns.has(edge.targetHandle ?? '');

    return isColumnHighlighted ? 'traced' : 'hidden';
  }
  if (inNodeMode) {
    return 'hidden';
  }

  return 'default';
}

// Node-click and column-click are mutually exclusive tracing modes
// (LineageProvider clears the other set when either fires), so we can key
// off which set is non-empty to decide the current mode.
export function computeEdgeVisualState(
  edge: Edge,
  tracedNodes: Set<string>,
  tracedColumns: Set<string>
): EdgeVisualState {
  const isColumnLineage = Boolean(edge.data?.isColumnLineage);
  const inColumnMode = tracedColumns.size > 0;
  const inNodeMode = tracedNodes.size > 0;

  if (isColumnLineage) {
    return getColumnLineageEdgeState(
      edge,
      tracedColumns,
      inColumnMode,
      inNodeMode
    );
  }

  if (inColumnMode) {
    return 'dimmed';
  }
  if (inNodeMode) {
    return isEdgeNodeTraced(edge, tracedNodes) ? 'traced' : 'dimmed';
  }

  return 'default';
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
