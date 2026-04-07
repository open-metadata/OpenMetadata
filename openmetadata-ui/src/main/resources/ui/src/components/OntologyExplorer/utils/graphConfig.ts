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
export const CHAR_WIDTH_ESTIMATE = 7;
export const MODEL_NODE_MAX_WIDTH = 220;
export const COMBO_PADDING = 48;
export const HULL_GAP = 56;
export const MIN_NODE_SPACING = 24;
export const MIN_LINK_DISTANCE = 160;

/** Minimum node width so label doesn't clip. */
export const MIN_NODE_WIDTH = 72;
/** Minimum width when node shows cross-glossary badge (e.g. "[Bank] Term"). */
export const BADGE_MIN_NODE_WIDTH = 100;

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
  const fromLabel = NODE_PADDING_H * 2 + label.length * CHAR_WIDTH_ESTIMATE;

  return Math.max(MIN_NODE_WIDTH, fromLabel);
}

export function truncateNodeLabelByWidth(label: string, width: number): string {
  const maxChars = Math.max(
    1,
    Math.floor((width - NODE_PADDING_H * 2) / CHAR_WIDTH_ESTIMATE)
  );

  if (label.length <= maxChars) {
    return label;
  }

  if (maxChars <= 1) {
    return '...';
  }

  return `${label.slice(0, maxChars - 1)}...`;
}

/**
 * Shared dagre spacing so hierarchy and overview look consistent.
 * Larger values keep edge labels clear of nodes and arrowheads off node borders.
 */
export const DAGRE_RANK_SEP = 150;
export const DAGRE_NODE_SEP = 100;
/** Extra separation in hierarchy mode so glossary combo boxes do not overlap. */
export const HIERARCHY_DAGRE_NODE_SEP = 260;
export const HIERARCHY_DAGRE_RANK_SEP = 200;
/** Extra separation when glossary hulls are shown so cross-glossary edges avoid overlapping nodes. */
const CROSS_GLOSSARY_LAYOUT_EXTRA = 90;

export function getLayoutConfig(
  layoutType: LayoutType | LayoutEngineType,
  nodeCount: number,
  hasHulls = false,
  focusNode?: string,
  isDataMode = false,
  isHierarchyMode = false
): LayoutConfig {
  const engineType: LayoutEngineType =
    layoutType === LayoutEngine.Dagre ||
    layoutType === LayoutEngine.Radial ||
    layoutType === LayoutEngine.Circular
      ? layoutType
      : toLayoutEngineType(layoutType as LayoutType);
  const baseNodeSize = (d?: LayoutNodeLike) => getNodeSize(d);

  if (engineType === LayoutEngine.Dagre) {
    let nodesep = hasHulls
      ? COMBO_PADDING * 2 + HULL_GAP + CROSS_GLOSSARY_LAYOUT_EXTRA
      : DAGRE_NODE_SEP;
    let ranksep = hasHulls
      ? COMBO_PADDING * 2 + HULL_GAP + CROSS_GLOSSARY_LAYOUT_EXTRA
      : DAGRE_RANK_SEP;

    if (isHierarchyMode) {
      nodesep = Math.max(nodesep, HIERARCHY_DAGRE_NODE_SEP);
      ranksep = Math.max(ranksep, HIERARCHY_DAGRE_RANK_SEP);
    }

    return {
      type: LayoutEngine.Dagre,
      animation: false,
      rankdir: 'TB',
      nodesep,
      ranksep,
      preventOverlap: true,
      nodeSize: baseNodeSize,
    };
  }

  if (engineType === LayoutEngine.Radial) {
    return {
      type: LayoutEngine.Radial,
      animation: false,
      ...(focusNode && !isDataMode && { focusNode }),
      unitRadius: isDataMode ? 220 : nodeCount <= 2 ? MIN_LINK_DISTANCE : 150,
      preventOverlap: true,
      nodeSize: isDataMode ? 20 : 40,
      nodeSpacing: isDataMode ? 30 : MIN_NODE_SPACING,
      linkDistance: isDataMode ? 220 : 200,
      strictRadial: false,
      maxIteration: 1000,
      sortBy: 'degree',
    };
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
