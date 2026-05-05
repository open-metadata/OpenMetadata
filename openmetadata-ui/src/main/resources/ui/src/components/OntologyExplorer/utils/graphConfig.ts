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
import {
  LayoutEngine,
  MODEL_ANTV_DAGRE_RANKSEP_WITH_COMBOS,
  NODE_LABEL_FONT_SIZE,
  NODE_LABEL_FONT_WEIGHT,
  NODE_PADDING_H,
  NODE_PADDING_V,
  toLayoutEngineType,
  type LayoutEngineType,
  type LayoutType,
} from '../OntologyExplorer.constants';
import { LayoutConfig, LayoutNodeLike } from '../OntologyExplorer.interface';

export const NODE_WIDTH = 120;
export const NODE_HEIGHT = 2 * NODE_PADDING_V + 18;
export { NODE_PADDING_H } from '../OntologyExplorer.constants';
export const CHAR_WIDTH_ESTIMATE = 9;
export const MODEL_NODE_MAX_WIDTH = 560;

const NODE_LABEL_MEASURE_FONT = `${NODE_LABEL_FONT_WEIGHT} ${NODE_LABEL_FONT_SIZE}px sans-serif`;
let nodeLabelMeasureCtx: CanvasRenderingContext2D | null = null;

function getNodeLabelMeasureCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') {
    return null;
  }
  if (!nodeLabelMeasureCtx) {
    const canvas = document.createElement('canvas');
    nodeLabelMeasureCtx = canvas.getContext('2d');
  }

  return nodeLabelMeasureCtx;
}

export function measureLabelTextWidth(label: string): number {
  const ctx = getNodeLabelMeasureCtx();
  if (!ctx) {
    return label.length * CHAR_WIDTH_ESTIMATE;
  }
  try {
    ctx.font = NODE_LABEL_MEASURE_FONT;

    return Math.ceil(ctx.measureText(label).width);
  } catch {
    return label.length * CHAR_WIDTH_ESTIMATE;
  }
}

export const COMBO_PADDING = 48;
export const HULL_GAP = 56;
export const MIN_NODE_SPACING = 12;
export const MIN_LINK_DISTANCE = 60;

export const DAGRE_RANK_SEP = 40;
export const DAGRE_NODE_SEP = 20;
export const HIERARCHY_DAGRE_NODE_SEP = 150;
export const HIERARCHY_DAGRE_RANK_SEP = 150;

export const MIN_NODE_WIDTH = 72;
export const BADGE_MIN_NODE_WIDTH = 100;

export function adaptiveSpacing(base: number, nodeCount: number): number {
  if (nodeCount <= 50) {
    return base;
  }
  if (nodeCount <= 200) {
    return Math.ceil(base * 0.7);
  }
  if (nodeCount <= 1000) {
    return Math.ceil(base * 0.45);
  }
  if (nodeCount <= 5000) {
    return Math.ceil(base * 0.25);
  }

  return Math.ceil(base * 0.15);
}

export interface GetOntologyLayoutConfigOptions {
  hasCombos: boolean;
  isDataMode: boolean;
  isModelView: boolean;
  isHierarchyMode: boolean;
}

export function getNodeSize(d?: LayoutNodeLike): [number, number] {
  const size = d?.data?.size;
  if (Array.isArray(size) && size.length >= 2) {
    const w = Math.max(MIN_NODE_WIDTH, Number(size[0]) || NODE_WIDTH);
    const h = Math.max(NODE_HEIGHT, Number(size[1]) || NODE_HEIGHT);

    return [w, h];
  }
  if (typeof size === 'number') {
    const s = Math.max(MIN_NODE_WIDTH, NODE_HEIGHT, size);

    return [s, s];
  }

  return [NODE_WIDTH, NODE_HEIGHT];
}

export function estimateNodeWidth(label: string): number {
  const textWidth = measureLabelTextWidth(label);

  return Math.max(MIN_NODE_WIDTH, textWidth + NODE_PADDING_H * 2);
}

export function truncateNodeLabelByWidth(label: string, width: number): string {
  const maxTextPx = width - NODE_PADDING_H * 2;
  const ctx = getNodeLabelMeasureCtx();

  if (!ctx) {
    const maxChars = Math.max(1, Math.floor(maxTextPx / CHAR_WIDTH_ESTIMATE));
    if (label.length <= maxChars) {
      return label;
    }

    return maxChars <= 1 ? '...' : `${label.slice(0, maxChars - 1)}...`;
  }

  ctx.font = NODE_LABEL_MEASURE_FONT;
  if (ctx.measureText(label).width <= maxTextPx) {
    return label;
  }

  const ellipsisWidth = ctx.measureText('...').width;
  const budget = maxTextPx - ellipsisWidth;
  let lo = 0;
  let hi = label.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(label.slice(0, mid)).width <= budget) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  return lo === 0 ? '...' : `${label.slice(0, lo)}...`;
}

export function getLayoutConfig(
  layoutType: LayoutType | LayoutEngineType,
  nodeCount: number,
  options: GetOntologyLayoutConfigOptions
): LayoutConfig {
  const { hasCombos, isDataMode, isModelView, isHierarchyMode } = options;

  const baseNodeSize = (d?: LayoutNodeLike) => getNodeSize(d);

  const engineType: LayoutEngineType =
    layoutType === LayoutEngine.Dagre || layoutType === LayoutEngine.Circular
      ? layoutType
      : toLayoutEngineType(layoutType as LayoutType);

  if (!isModelView) {
    if (engineType === LayoutEngine.Dagre) {
      const baseSep = isHierarchyMode
        ? HIERARCHY_DAGRE_NODE_SEP
        : DAGRE_NODE_SEP;
      const baseRank = isHierarchyMode
        ? HIERARCHY_DAGRE_RANK_SEP
        : DAGRE_RANK_SEP;

      return {
        type: LayoutEngine.Dagre,
        animation: false,
        rankdir: 'TB',
        nodesep: adaptiveSpacing(baseSep, nodeCount),
        ranksep: adaptiveSpacing(baseRank, nodeCount),
        preventOverlap: true,
        nodeSize: baseNodeSize,
      };
    }

    if (isDataMode && engineType === LayoutEngine.Circular) {
      return { type: 'preset', animation: false };
    }

    if (engineType === LayoutEngine.Circular) {
      return {
        type: LayoutEngine.Circular,
        animation: false,
        nodeSize: baseNodeSize,
        nodeSpacing: MIN_NODE_SPACING,
      };
    }

    return {
      type: engineType,
    };
  }

  if (engineType === LayoutEngine.Dagre) {
    return {
      type: 'antv-dagre',
      animation: false,
      sortByCombo: hasCombos,
      nodeSize: baseNodeSize,
      enableWorker: nodeCount > 250,
      ...(hasCombos && { ranksep: MODEL_ANTV_DAGRE_RANKSEP_WITH_COMBOS }),
    };
  }

  // Model-view Circular: positions are pre-computed by positionCircularNodes in
  // useOntologyGraph and baked into node.style.x/y before draw(). Use 'preset'
  // so G6 reads those coordinates directly — same pattern as KnowledgeGraph.
  if (engineType === LayoutEngine.Circular) {
    return { type: 'preset', animation: false };
  }

  return {
    type: engineType,
  };
}
