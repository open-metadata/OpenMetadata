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
  DAGRE_NODE_SEP,
  DAGRE_RANK_SEP,
  NODE_HEIGHT,
  NODE_WIDTH,
} from './graphConfig';

const COMBO_PADDING = 56;
const HULL_GAP = 72;
const MIN_NODE_SPACING = 40;

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
const CIRCLE_NODE_SPACING = 80;

const DATA_MODE_ASSET_SPACING_ALONG_ARC = 90;
const DATA_MODE_RING_SAFETY_PAD = 45;

export function computeGlossaryGroupPositions(
  inputNodes: OntologyNode[],
  layoutType: LayoutEngineType,
  nodeSpacing?: number
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

  const nodesPerRow = (count: number): number => {
    if (layoutType === LayoutEngine.Dagre) {
      return Math.max(1, Math.ceil(Math.sqrt(count / 2)));
    }

    return Math.max(1, Math.ceil(Math.sqrt(count)));
  };

  const isDagre = layoutType === LayoutEngine.Dagre;
  const isCircular = layoutType === LayoutEngine.Circular;
  const isRadial = layoutType === LayoutEngine.Radial;
  const H_STEP =
    nodeSpacing ??
    (isDagre ? NODE_WIDTH + DAGRE_NODE_SEP : NODE_WIDTH + MIN_NODE_SPACING);
  const V_STEP =
    nodeSpacing ??
    (isDagre ? NODE_HEIGHT + DAGRE_RANK_SEP : NODE_HEIGHT + MIN_NODE_SPACING);

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
    const radius =
      n <= 1
        ? NODE_WIDTH / 2
        : Math.max(
            CIRCLE_MIN_RADIUS,
            (n * CIRCLE_NODE_SPACING) / (2 * Math.PI)
          );
    const cx = radius + COMBO_PADDING;
    const cy = radius + COMBO_HEADER_HEIGHT;

    nodes.forEach((node, i) => {
      const angle = n === 1 ? 0 : (i / n) * 2 * Math.PI - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      localPositions.set(node.id, { x, y });
    });

    const width = 2 * radius + COMBO_PADDING * 2;
    const height = 2 * radius + COMBO_HEADER_HEIGHT + COMBO_PADDING;

    return { nodes, localPositions, width, height };
  };

  const buildGroupBoxRadial = (nodes: OntologyNode[]): GroupBox => {
    const n = nodes.length;
    const localPositions = new Map<string, { x: number; y: number }>();
    if (n === 0) {
      return { nodes, localPositions, width: 0, height: 0 };
    }
    const ringRadius =
      n <= 1
        ? NODE_WIDTH / 2
        : Math.max(
            CIRCLE_MIN_RADIUS,
            (n * CIRCLE_NODE_SPACING) / (2 * Math.PI)
          );
    const cx = ringRadius + COMBO_PADDING;
    const cy = ringRadius + COMBO_HEADER_HEIGHT;

    nodes.forEach((node, i) => {
      if (i === 0) {
        localPositions.set(node.id, { x: cx, y: cy });
      } else {
        const angle = ((i - 1) / (n - 1)) * 2 * Math.PI - Math.PI / 2;
        const x = cx + ringRadius * Math.cos(angle);
        const y = cy + ringRadius * Math.sin(angle);
        localPositions.set(node.id, { x, y });
      }
    });

    const width = 2 * ringRadius + COMBO_PADDING * 2;
    const height = 2 * ringRadius + COMBO_HEADER_HEIGHT + COMBO_PADDING;

    return { nodes, localPositions, width, height };
  };

  const buildGroupBox = (nodes: OntologyNode[]): GroupBox => {
    if (isCircular) {
      return buildGroupBoxCircle(nodes);
    }
    if (isRadial) {
      return buildGroupBoxRadial(nodes);
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
  const macroCols = getMacroCols(numGroups);

  const maxW =
    Math.max(...groupBoxes.map((g) => g.width), NODE_WIDTH) + COMBO_PADDING * 2;
  const maxH =
    Math.max(...groupBoxes.map((g) => g.height), NODE_HEIGHT) +
    COMBO_PADDING * 2;

  const cellW = maxW + HULL_GAP;
  const cellH = maxH + HULL_GAP;

  const positions: Record<string, { x: number; y: number }> = {};

  groupBoxes.forEach((box, gi) => {
    const macroCol = gi % macroCols;
    const macroRow = Math.floor(gi / macroCols);

    const originX = macroCol * cellW + COMBO_PADDING;
    const originY = macroRow * cellH + COMBO_PADDING;

    box.localPositions.forEach((localPos, nodeId) => {
      positions[nodeId] = {
        x: originX + localPos.x,
        y: originY + localPos.y,
      };
    });
  });

  return positions;
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
