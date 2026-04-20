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
import { Edge, Node, Position, Viewport } from 'reactflow';
import { EntityChildren } from '../components/Entity/EntityLineage/NodeChildren/NodeChildren.interface';
import { LINEAGE_CHILD_ITEMS_PER_PAGE } from '../constants/constants';
import {
  COLUMN_NODE_HEIGHT,
  NODE_HEIGHT,
  NODE_HEIGHT_WITH_CHILDREN,
  NODE_WIDTH,
} from '../constants/Lineage.constants';
import { EntityType } from '../enums/entity.enum';
import { useLineageStore } from '../hooks/useLineageStore';
import {
  getEdgePathData,
  getEntityChildrenAndLabel,
} from './EntityLineageUtils';

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface EdgeCoordinates {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

export function setupCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  willReadFrequently = false
): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently });
  if (!ctx) {
    throw new Error('Could not get 2D context from canvas');
  }

  const dpr = window.devicePixelRatio || 1;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.scale(dpr, dpr);

  return ctx;
}

const getBaseNodeHeightFromType = (
  entityType: string,
  isRootNode: boolean = false,
  children: { children: EntityChildren }
) => {
  const childrenPresent = children.children.length !== 0;

  let baseHeight = childrenPresent ? NODE_HEIGHT_WITH_CHILDREN : NODE_HEIGHT;

  switch (entityType) {
    case EntityType.METRIC:
    case EntityType.DRIVE_SERVICE:
    case EntityType.DATABASE_SERVICE:
    case EntityType.MESSAGING_SERVICE:
    case EntityType.METADATA_SERVICE:
    case EntityType.DASHBOARD_SERVICE:
    case EntityType.PIPELINE_SERVICE:
    case EntityType.MLMODEL_SERVICE:
    case EntityType.STORAGE_SERVICE:
    case EntityType.SEARCH_SERVICE:
    case EntityType.SECURITY_SERVICE:
    case EntityType.API_SERVICE:
      baseHeight = 48;

      break;
  }

  return isRootNode ? baseHeight + 10 : baseHeight;
};

export function getNodeHeight(
  node: Node,
  isColumnLineage: boolean,
  columnCount?: number
) {
  const isRootNode = node.data?.isRootNode ?? false;

  const visibleColumnCount = isColumnLineage
    ? columnCount ?? LINEAGE_CHILD_ITEMS_PER_PAGE
    : columnCount ?? 0;

  let height = getBaseNodeHeightFromType(
    node.data.node?.entityType,
    isRootNode,
    getEntityChildrenAndLabel(node.data.node)
  );

  if (isColumnLineage) {
    height += getNodeYPadding(node);

    if (visibleColumnCount > 0) {
      height += COLUMN_NODE_HEIGHT * visibleColumnCount;
    }

    // Navigation padding
    height += 28 * 2;
  }

  return height;
}

const getNodeYPadding = (node: Node): number => {
  const { children } = getEntityChildrenAndLabel(node.data.node);

  const sourceYPadding = children.length > 0 ? 48 : 0;

  // Add padding for the node's border
  return sourceYPadding;
};

interface ColumnLineageData {
  columnIds: string[];
  columnIndex: number;
  isFilterActive: boolean;
  totalColumns: number;
  navigationNeeded: boolean;
}

function getColumnLineageData(
  nodeId: string,
  node: Node,
  handleId: string | null | undefined,
  columnsInCurrentPages: Map<string, string[]>,
  nodeFilterMap: Map<string, boolean>
): ColumnLineageData | null {
  const columnIds = columnsInCurrentPages.get(nodeId) || [];
  const columnIndex = columnIds.findIndex((id) => id === handleId);

  if (columnIndex === -1) {
    return null;
  }

  const { children } = getEntityChildrenAndLabel(node.data.node);

  const isFilterActive = nodeFilterMap.get(nodeId) ?? false;
  const totalColumns = children?.length ?? 0;
  const navigationNeeded = !isFilterActive && columnIds.length !== totalColumns;

  return {
    columnIds,
    columnIndex,
    isFilterActive,
    totalColumns,
    navigationNeeded,
  };
}

function calculateColumnPosition(
  columnIndex: number,
  navigationNeeded: boolean,
  node: Node,
  baseNodeHeight: number,
  columnFilterActive: boolean
): number {
  const columnCenterOffset =
    COLUMN_NODE_HEIGHT * columnIndex + COLUMN_NODE_HEIGHT / 2;

  const navigationOffset = columnFilterActive
    ? 0
    : columnIndex >= LINEAGE_CHILD_ITEMS_PER_PAGE
    ? 17
    : 0;

  const yPadding = navigationNeeded
    ? getNodeYPadding(node) + 28
    : getNodeYPadding(node);

  return columnCenterOffset + navigationOffset + yPadding + baseNodeHeight;
}

function getColumnLineageCoordinates(
  edge: Edge,
  sourceNode: Node,
  targetNode: Node,
  columnsInCurrentPages: Map<string, string[]>,
  nodeFilterMap: Map<string, boolean>
): EdgeCoordinates | null {
  const sourceData = getColumnLineageData(
    sourceNode.id,
    sourceNode,
    edge.sourceHandle,
    columnsInCurrentPages,
    nodeFilterMap
  );

  const targetData = getColumnLineageData(
    targetNode.id,
    targetNode,
    edge.targetHandle,
    columnsInCurrentPages,
    nodeFilterMap
  );

  if (!sourceData || !targetData) {
    return null;
  }

  // Passing column count as 0 since we don't want to consider columns
  // we are calculating column position separately
  const sourceNodeHeight = getNodeHeight(sourceNode, false, 0);
  const targetNodeHeight = getNodeHeight(targetNode, false, 0);

  const sourceY = calculateColumnPosition(
    sourceData.columnIndex,
    sourceData.navigationNeeded,
    sourceNode,
    sourceNodeHeight,
    sourceData.isFilterActive
  );

  const targetY = calculateColumnPosition(
    targetData.columnIndex,
    targetData.navigationNeeded,
    targetNode,
    targetNodeHeight,
    targetData.isFilterActive
  );

  return {
    sourceX: sourceNode.position.x + NODE_WIDTH,
    sourceY: sourceNode.position.y + sourceY,
    targetX: targetNode.position.x,
    targetY: targetNode.position.y + targetY,
  };
}

function getEntityLineageCoordinates(
  sourceNode: Node,
  targetNode: Node,
  isColumnLineage: boolean
): EdgeCoordinates {
  const sourceHeight = getNodeHeight(sourceNode, isColumnLineage, 0);
  const targetHeight = getNodeHeight(targetNode, isColumnLineage, 0);

  return {
    sourceX: sourceNode.position.x + (sourceNode.width ?? 0),
    sourceY: sourceNode.position.y + sourceHeight / 2,
    targetX: targetNode.position.x - 10,
    targetY: targetNode.position.y + targetHeight / 2,
  };
}

export function getEdgeCoordinates(
  edge: Edge,
  sourceNode?: Node,
  targetNode?: Node,
  columnsInCurrentPages?: Map<string, string[]>
): EdgeCoordinates | null {
  if (!sourceNode || !targetNode) {
    return null;
  }

  if (
    !sourceNode.width ||
    !sourceNode.height ||
    !targetNode.width ||
    !targetNode.height
  ) {
    return null;
  }

  const isColumnLineage = edge.data?.isColumnLineage ?? false;

  if (isColumnLineage && columnsInCurrentPages) {
    const nodeFilterMap = useLineageStore.getState().nodeFilterState;

    return getColumnLineageCoordinates(
      edge,
      sourceNode,
      targetNode,
      columnsInCurrentPages,
      nodeFilterMap
    );
  }

  return getEntityLineageCoordinates(sourceNode, targetNode, isColumnLineage);
}

export function getEdgeBounds(
  edge: Edge,
  sourceNode: Node | undefined,
  targetNode: Node | undefined,
  columnsInCurrentPages?: Map<string, string[]>
): BoundingBox | null {
  const coords = getEdgeCoordinates(
    edge,
    sourceNode,
    targetNode,
    columnsInCurrentPages
  );

  if (!coords) {
    return null;
  }

  const padding = 50;

  return {
    minX: Math.min(coords.sourceX, coords.targetX) - padding,
    maxX: Math.max(coords.sourceX, coords.targetX) + padding,
    minY: Math.min(coords.sourceY, coords.targetY) - padding,
    maxY: Math.max(coords.sourceY, coords.targetY) + padding,
  };
}

export function getViewportBounds(
  viewport: Viewport,
  canvasWidth: number,
  canvasHeight: number
): BoundingBox {
  const { x, y, zoom } = viewport;

  return {
    minX: -x / zoom,
    maxX: (-x + canvasWidth) / zoom,
    minY: -y / zoom,
    maxY: (-y + canvasHeight) / zoom,
  };
}

export function boundsIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return !(
    a.maxX < b.minX ||
    a.minX > b.maxX ||
    a.maxY < b.minY ||
    a.minY > b.maxY
  );
}

export function isEdgeInViewport(
  edge: Edge,
  sourceNode: Node | undefined,
  targetNode: Node | undefined,
  viewport: Viewport,
  canvasWidth: number,
  canvasHeight: number,
  columnsInCurrentPages: Map<string, string[]>
): boolean {
  const edgeBounds = getEdgeBounds(
    edge,
    sourceNode,
    targetNode,
    columnsInCurrentPages
  );
  if (!edgeBounds) {
    return false;
  }

  if (edge.data?.isColumnLineage && columnsInCurrentPages) {
    const sourceColumnIds = columnsInCurrentPages.get(edge.source) || [];
    const targetColumnIds = columnsInCurrentPages.get(edge.target) || [];

    if (
      !sourceColumnIds.includes(edge.sourceHandle ?? '') ||
      !targetColumnIds.includes(edge.targetHandle ?? '')
    ) {
      return false;
    }
  }

  const viewportBounds = getViewportBounds(viewport, canvasWidth, canvasHeight);

  return boundsIntersect(edgeBounds, viewportBounds);
}

export function hasSignificantViewportChange(
  current: Viewport,
  previous: Viewport,
  threshold: number = 0.1
): boolean {
  const deltaX = Math.abs(current.x - previous.x);
  const deltaY = Math.abs(current.y - previous.y);
  const deltaZoom = Math.abs(current.zoom - previous.zoom);

  return (
    deltaX > threshold || deltaY > threshold || deltaZoom > threshold * 0.1
  );
}

export function transformPoint(
  x: number,
  y: number,
  viewport: Viewport
): { x: number; y: number } {
  return {
    x: x * viewport.zoom + viewport.x,
    y: y * viewport.zoom + viewport.y,
  };
}

export function inverseTransformPoint(
  screenX: number,
  screenY: number,
  viewport: Viewport
): { x: number; y: number } {
  return {
    x: (screenX - viewport.x) / viewport.zoom,
    y: (screenY - viewport.y) / viewport.zoom,
  };
}

/**
 * Draws an arrowhead that matches ReactFlow's built-in ArrowClosed marker:
 *   <polyline points="-5,-4 0,0 -5,4 -5,-4"
 *             stroke-linecap="round" stroke-linejoin="round"
 *             style="stroke: <color>; fill: <color>; stroke-width: 1;" />
 * The marker viewBox is "-10 -10 20 20" with refX=0, refY=0, so the tip
 * sits exactly at the path endpoint.
 */
export function drawArrowMarker(
  ctx: CanvasRenderingContext2D,
  targetX: number,
  targetY: number,
  angle: number,
  color: string
) {
  ctx.save();

  ctx.translate(targetX, targetY);
  ctx.rotate(angle);

  // Scale factor 1 matches ReactFlow's effective marker size when
  // markerUnits="strokeWidth" is combined with strokeWidth=2.
  const s = 1;
  ctx.beginPath();
  ctx.moveTo(-5 * s, -4 * s);
  ctx.lineTo(0, 0);
  ctx.lineTo(-5 * s, 4 * s);
  ctx.lineTo(-5 * s, -4 * s);
  ctx.closePath();

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = s;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

export function getEdgeAngle(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number
): number {
  return Math.atan2(targetY - sourceY, targetX - sourceX);
}

/**
 * Computes the arrival tangent angle at the end of a bezier SVG path string.
 *
 * ReactFlow's markerEnd arrow is oriented along the tangent of the bezier curve
 * at t=1, which is the direction from the last control point (c2) to the end
 * point. Using the raw source→target chord angle (getEdgeAngle) diverges from
 * this whenever nodes are at different Y positions.
 *
 * For a cubic bezier "M sx sy C c1x c1y c2x c2y tx ty" the tangent at t=1
 * is (tx - c2x, ty - c2y).
 *
 * Falls back to the chord angle when the path cannot be parsed (e.g.
 * self-connecting arc paths).
 */
export function getBezierEndTangentAngle(
  pathString: string,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number
): number {
  const cubicRe =
    /[Cc]\s*([-\d.e+]+)[,\s]+([-\d.e+]+)[,\s]+([-\d.e+]+)[,\s]+([-\d.e+]+)[,\s]+([-\d.e+]+)[,\s]+([-\d.e+]+)/g;

  let lastMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;
  while ((match = cubicRe.exec(pathString)) !== null) {
    lastMatch = match;
  }

  if (lastMatch) {
    const c2x = parseFloat(lastMatch[3]);
    const c2y = parseFloat(lastMatch[4]);
    const tx = parseFloat(lastMatch[5]);
    const ty = parseFloat(lastMatch[6]);
    const dx = tx - c2x;
    const dy = ty - c2y;

    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
      return Math.atan2(dy, dx);
    }
  }

  return getEdgeAngle(sourceX, sourceY, targetX, targetY);
}

export function getCubicBezierMidpoint(
  pathString: string,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number
): { x: number; y: number } {
  const cubicRe =
    /[Cc]\s*([-\d.e+]+)[,\s]+([-\d.e+]+)[,\s]+([-\d.e+]+)[,\s]+([-\d.e+]+)[,\s]+([-\d.e+]+)[,\s]+([-\d.e+]+)/;

  const match = pathString.match(cubicRe);

  if (match) {
    const c1x = parseFloat(match[1]);
    const c1y = parseFloat(match[2]);
    const c2x = parseFloat(match[3]);
    const c2y = parseFloat(match[4]);
    const tx = parseFloat(match[5]);
    const ty = parseFloat(match[6]);

    const t = 0.5;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    const x = mt3 * sourceX + 3 * mt2 * t * c1x + 3 * mt * t2 * c2x + t3 * tx;
    const y = mt3 * sourceY + 3 * mt2 * t * c1y + 3 * mt * t2 * c2y + t3 * ty;

    return { x, y };
  }

  return {
    x: (sourceX + targetX) / 2,
    y: (sourceY + targetY) / 2,
  };
}

interface EdgePathData {
  edgePath: string;
  edgeCenterX: number;
  edgeCenterY: number;
  sourceX?: number;
  sourceY?: number;
  targetX?: number;
  targetY?: number;
}

const pathDataCache = new Map<string, EdgePathData>();

function getCacheKey(
  edgeId: string,
  sourceNode?: Node,
  targetNode?: Node,
  columnsInCurrentPages?: Map<string, string[]>
): string {
  const sourcePos = sourceNode
    ? `${sourceNode.position.x},${sourceNode.position.y},${sourceNode.width},${sourceNode.height}`
    : '';
  const targetPos = targetNode
    ? `${targetNode.position.x},${targetNode.position.y},${targetNode.width},${targetNode.height}`
    : '';
  const srcCols =
    (sourceNode && columnsInCurrentPages?.get(sourceNode.id)?.join(',')) ?? '';
  const tgtCols =
    (targetNode && columnsInCurrentPages?.get(targetNode.id)?.join(',')) ?? '';

  return `${edgeId}|${sourcePos}|${targetPos}|${srcCols}|${tgtCols}`;
}

export const computePathDataForEdge = (
  edge: Edge,
  sourceNode?: Node,
  targetNode?: Node,
  columnsInCurrentPages: Map<string, string[]> = new Map()
): EdgePathData | null => {
  if (edge.data?.computedPath) {
    return edge.data.computedPath;
  }

  const cacheKey = getCacheKey(
    edge.id,
    sourceNode,
    targetNode,
    columnsInCurrentPages
  );
  const cached = pathDataCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const coords = getEdgeCoordinates(
    edge,
    sourceNode,
    targetNode,
    columnsInCurrentPages
  );

  if (!coords) {
    return null;
  }

  const pathData = getEdgePathData(edge.source ?? '', edge.target ?? '', {
    sourceX: coords.sourceX,
    sourceY: coords.sourceY,
    targetX: coords.targetX,
    targetY: coords.targetY,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  });

  const enrichedPathData: EdgePathData = {
    ...pathData,
    sourceX: coords.sourceX,
    sourceY: coords.sourceY,
    targetX: coords.targetX,
    targetY: coords.targetY,
  };

  pathDataCache.set(cacheKey, enrichedPathData);

  if (pathDataCache.size > 1000) {
    const firstKey = pathDataCache.keys().next().value;
    pathDataCache.delete(firstKey ?? '');
  }

  return enrichedPathData;
};

export const clearPathDataCache = (): void => {
  pathDataCache.clear();
};
