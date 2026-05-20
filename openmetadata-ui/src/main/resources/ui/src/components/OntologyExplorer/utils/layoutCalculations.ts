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
  COMBO_HEADER_HEIGHT,
  DATA_MODE_ASSET_CIRCLE_SIZE,
  DATA_MODE_ASSET_LABEL_LAYOUT_STACK,
  DATA_MODE_TERM_TO_FIRST_RING_GAP,
  LayoutEngine,
  type LayoutEngineType,
} from '../OntologyExplorer.constants';
import { OntologyNode } from '../OntologyExplorer.interface';
import {
  adaptiveSpacing,
  DAGRE_NODE_SEP,
  DAGRE_RANK_SEP,
  NODE_HEIGHT,
  NODE_WIDTH,
} from './graphConfig';

const COMBO_PADDING = 12;
const HULL_GAP = 16;
const MIN_NODE_SPACING = 12;

function getMacroCols(numGroups: number): number {
  if (numGroups <= 1) {
    return 1;
  }
  if (numGroups <= 4) {
    return 2;
  }

  return Math.ceil(Math.sqrt(numGroups));
}

const CIRCLE_MIN_RADIUS = 100;
// Minimum arc length between adjacent term centers so their asset rings don't
// overlap: each ring extends (DATA_MODE_TERM_TO_FIRST_RING_GAP +
// DATA_MODE_ASSET_CIRCLE_SIZE) outward.  Multiply by 2 so rings from two
// adjacent terms just clear each other.
const DATA_MODE_CIRCLE_ARC_SPACING =
  (DATA_MODE_TERM_TO_FIRST_RING_GAP + DATA_MODE_ASSET_CIRCLE_SIZE) * 2;
const CIRCLE_NODE_SPACING = 80;

// Hard cap on ring radius so large glossary groups (50-200 terms) don't create
// a layout that is thousands of pixels wide.  At high node counts, terms will
// overlap — this is acceptable and mirrors how Dagre compresses at scale.
const MAX_RING_RADIUS = 480;

const DATA_MODE_ASSET_SPACING_ALONG_ARC = 150;
const DATA_MODE_RING_SAFETY_PAD = 60;

// Mirror the adaptiveSpacing logic in graphConfig.ts so our manual grid layout
// compresses the same way G6's Dagre does at high node counts.
const adaptiveCircleSpacing = adaptiveSpacing;

export function computeGlossaryGroupPositions(
  inputNodes: OntologyNode[],
  layoutType: LayoutEngineType,
  nodeSpacingH?: number,
  nodeSpacingV?: number
): Record<string, { x: number; y: number }> {
  const groupMap = new Map<string, OntologyNode[]>();
  const ungrouped: OntologyNode[] = [];

  inputNodes.forEach((node) => {
    if (node.glossaryId) {
      const list = groupMap.get(node.glossaryId) ?? [];
      list.push(node);
      groupMap.set(node.glossaryId, list);
    } else {
      ungrouped.push(node);
    }
  });

  const nodesPerRow = (count: number): number =>
    Math.max(1, Math.ceil(Math.sqrt(count)));

  const isDagre = layoutType === LayoutEngine.Dagre;
  const isCircular = layoutType === LayoutEngine.Circular;
  const H_STEP =
    nodeSpacingH ??
    (isDagre ? NODE_WIDTH + DAGRE_NODE_SEP : NODE_WIDTH + MIN_NODE_SPACING);
  const V_STEP =
    nodeSpacingV ??
    nodeSpacingH ??
    (isDagre ? NODE_HEIGHT + DAGRE_RANK_SEP : NODE_HEIGHT + MIN_NODE_SPACING);

  const totalTerms = inputNodes.length;

  // For Circular: arc spacing must be wide enough that asset rings from
  // adjacent terms don't overlap at low node counts.  At high node counts,
  // apply the same adaptive compression that Dagre uses so layouts stay usable
  // (some overlap is acceptable and mirrors Dagre's behaviour at scale).
  const circleArcSpacing = isCircular
    ? adaptiveCircleSpacing(DATA_MODE_CIRCLE_ARC_SPACING, totalTerms)
    : CIRCLE_NODE_SPACING;

  // Inter-combo outer gap: reduce proportionally at high node counts so the
  // overall layout width stays comparable to the Dagre layout.
  const firstAssetRingRadius =
    DATA_MODE_TERM_TO_FIRST_RING_GAP + DATA_MODE_ASSET_CIRCLE_SIZE;
  const baseOuterGap = firstAssetRingRadius * 2 + 60;
  const outerComboGap = isCircular
    ? Math.max(HULL_GAP, adaptiveCircleSpacing(baseOuterGap, totalTerms))
    : HULL_GAP;

  interface GroupBox {
    nodes: OntologyNode[];
    localPositions: Map<string, { x: number; y: number }>;
    width: number;
    height: number;
  }

  const buildGroupBoxCircle = (nodes: OntologyNode[]): GroupBox => {
    const n = nodes.length;
    const localPositions = new Map<string, { x: number; y: number }>();
    if (n === 0) {
      return { nodes, localPositions, width: 0, height: 0 };
    }

    if (n === 1) {
      localPositions.set(nodes[0].id, {
        x: NODE_WIDTH / 2,
        y: NODE_HEIGHT / 2 + COMBO_HEADER_HEIGHT,
      });

      return {
        nodes,
        localPositions,
        width: NODE_WIDTH,
        height: NODE_HEIGHT + COMBO_HEADER_HEIGHT,
      };
    }

    const radius = Math.min(
      MAX_RING_RADIUS,
      Math.max(CIRCLE_MIN_RADIUS, (n * circleArcSpacing) / (2 * Math.PI))
    );
    const cx = radius + NODE_WIDTH / 2;
    const cy = radius + NODE_HEIGHT / 2 + COMBO_HEADER_HEIGHT;

    nodes.forEach((node, i) => {
      const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
      localPositions.set(node.id, {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      });
    });

    const width = 2 * (radius + NODE_WIDTH / 2);
    const height = 2 * (radius + NODE_HEIGHT / 2) + COMBO_HEADER_HEIGHT;

    return { nodes, localPositions, width, height };
  };

  const buildGroupBox = (nodes: OntologyNode[]): GroupBox => {
    if (isCircular) {
      return buildGroupBoxCircle(nodes);
    }
    const cols = nodesPerRow(nodes.length);
    const localPositions = new Map<string, { x: number; y: number }>();

    nodes.forEach((node, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      localPositions.set(node.id, {
        x: col * H_STEP + NODE_WIDTH / 2,
        y: row * V_STEP + NODE_HEIGHT / 2 + COMBO_HEADER_HEIGHT,
      });
    });

    const rows = Math.ceil(nodes.length / cols);
    const width = cols * H_STEP;
    const height = rows * V_STEP + COMBO_HEADER_HEIGHT;

    return { nodes, localPositions, width, height };
  };

  const groupBoxes: GroupBox[] = [];
  groupMap.forEach((nodes) => groupBoxes.push(buildGroupBox(nodes)));
  if (ungrouped.length > 0) {
    groupBoxes.push(buildGroupBox(ungrouped));
  }

  const numGroups = groupBoxes.length;
  const macroCols = isCircular
    ? Math.max(1, Math.ceil(Math.sqrt(numGroups * 2)))
    : getMacroCols(numGroups);

  // Uniform column width based on the widest group.
  const maxW =
    Math.max(...groupBoxes.map((g) => g.width), NODE_WIDTH) + COMBO_PADDING * 2;
  const cellW = maxW + outerComboGap;

  // Per-row heights: each macro row uses the actual max height of its groups,
  // so short glossary groups don't create large empty gaps below them.
  const numMacroRows = numGroups > 0 ? Math.ceil(numGroups / macroCols) : 0;
  const rowMaxH = new Array(numMacroRows).fill(0) as number[];
  groupBoxes.forEach((box, gi) => {
    const macroRow = Math.floor(gi / macroCols);
    rowMaxH[macroRow] = Math.max(
      rowMaxH[macroRow],
      box.height + COMBO_PADDING * 2
    );
  });

  const rowOriginY = new Array(numMacroRows).fill(0) as number[];
  for (let r = 1; r < numMacroRows; r++) {
    rowOriginY[r] = rowOriginY[r - 1] + rowMaxH[r - 1] + outerComboGap;
  }

  const positions: Record<string, { x: number; y: number }> = {};

  groupBoxes.forEach((box, gi) => {
    const macroCol = gi % macroCols;
    const macroRow = Math.floor(gi / macroCols);

    const originX = macroCol * cellW + COMBO_PADDING;
    const originY = rowOriginY[macroRow] + COMBO_PADDING;

    box.localPositions.forEach((localPos, nodeId) => {
      positions[nodeId] = {
        x: originX + localPos.x,
        y: originY + localPos.y,
      };
    });
  });

  return positions;
}

export function computeOutermostRingRadius(assetCount: number): number {
  if (assetCount === 0) {
    return 0;
  }
  const ASSET_NODE_DIAMETER = DATA_MODE_ASSET_CIRCLE_SIZE;
  const LABEL_HEIGHT = DATA_MODE_ASSET_LABEL_LAYOUT_STACK;
  const SAFETY_PAD = DATA_MODE_RING_SAFETY_PAD;
  const RING_GAP = ASSET_NODE_DIAMETER + LABEL_HEIGHT + SAFETY_PAD;
  const firstRingRadius =
    DATA_MODE_TERM_TO_FIRST_RING_GAP + ASSET_NODE_DIAMETER;

  let placed = 0;
  let ringIdx = 0;
  while (placed < assetCount) {
    const ringRadius = firstRingRadius + ringIdx * RING_GAP;
    const capacity = Math.max(
      1,
      Math.floor((ringRadius * 2 * Math.PI) / DATA_MODE_ASSET_SPACING_ALONG_ARC)
    );
    placed += Math.min(capacity, assetCount - placed);
    if (placed >= assetCount) {
      return ringRadius + ASSET_NODE_DIAMETER / 2;
    }
    ringIdx++;
  }

  return firstRingRadius + ASSET_NODE_DIAMETER / 2;
}

export function computeAssetRingPositions(
  termX: number,
  termY: number,
  assetIds: string[]
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  const M = assetIds.length;
  if (M === 0) {
    return positions;
  }

  const ASSET_NODE_DIAMETER = DATA_MODE_ASSET_CIRCLE_SIZE;
  const LABEL_HEIGHT = DATA_MODE_ASSET_LABEL_LAYOUT_STACK;
  const SAFETY_PAD = DATA_MODE_RING_SAFETY_PAD;
  const RING_GAP = ASSET_NODE_DIAMETER + LABEL_HEIGHT + SAFETY_PAD;

  const assetsPerArc = (radius: number): number => {
    const arcLen = radius * 2 * Math.PI;

    return Math.max(1, Math.floor(arcLen / DATA_MODE_ASSET_SPACING_ALONG_ARC));
  };

  let placed = 0;
  let ringIdx = 0;

  while (placed < M) {
    const firstAssetRingRadius =
      DATA_MODE_TERM_TO_FIRST_RING_GAP + ASSET_NODE_DIAMETER;
    const ringRadius = firstAssetRingRadius + ringIdx * RING_GAP;
    const capacity = assetsPerArc(ringRadius);
    const toPlace = Math.min(capacity, M - placed);

    for (let k = 0; k < toPlace; k++) {
      const assetId = assetIds[placed + k];
      const assetAngle =
        toPlace === 1
          ? -Math.PI / 2
          : -Math.PI / 2 + (2 * Math.PI * k) / toPlace;
      positions[assetId] = {
        x: termX + ringRadius * Math.cos(assetAngle),
        y: termY + ringRadius * Math.sin(assetAngle),
      };
    }

    placed += toPlace;
    ringIdx += 1;
  }

  return positions;
}
