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
    type LayoutEngineType
} from '../OntologyExplorer.constants';
import {
    HierarchyGraphResult,
    MergedEdge,
    OntologyNode
} from '../OntologyExplorer.interface';
import {
    BADGE_MIN_NODE_WIDTH,
    DAGRE_NODE_SEP,
    DAGRE_RANK_SEP,
    NODE_HEIGHT,
    NODE_WIDTH
} from './graphConfig';

const COMBO_PADDING = 56;
const HULL_GAP = 72;
const MIN_NODE_SPACING = 40;

const DATA_MODE_ASSET_SPACING_ALONG_ARC = 90;
const DATA_MODE_RING_SAFETY_PAD = 45;

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

export function computeGlossaryGroupPositions(
  inputNodes: OntologyNode[],
  layoutType: LayoutEngineType
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
  const H_STEP = isDagre
    ? NODE_WIDTH + DAGRE_NODE_SEP
    : NODE_WIDTH + MIN_NODE_SPACING;
  const V_STEP = isDagre
    ? NODE_HEIGHT + DAGRE_RANK_SEP
    : NODE_HEIGHT + MIN_NODE_SPACING;

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

export function computeHierarchyComboPositions(
  data: HierarchyGraphResult
): Record<string, { x: number; y: number }> {
  const { nodes, edges, combos } = data;
  const positions: Record<string, { x: number; y: number }> = {};
  if (combos.length === 0) {
    return positions;
  }

  const minNodeWidth = Math.max(NODE_WIDTH, BADGE_MIN_NODE_WIDTH);
  const H_STEP = minNodeWidth + DAGRE_NODE_SEP;
  const RANK_SEP = DAGRE_RANK_SEP;
  const COMBO_HEADER = COMBO_HEADER_HEIGHT;

  const nodesByCombo = new Map<string, typeof nodes>();
  nodes.forEach((n) => {
    const list = nodesByCombo.get(n.glossaryId) ?? [];
    list.push(n);
    nodesByCombo.set(n.glossaryId, list);
  });

  interface ComboLayout {
    glossaryId: string;
    localPositions: Map<string, { x: number; y: number }>;
    width: number;
    height: number;
  }

  const comboLayouts: ComboLayout[] = [];
  combos.forEach((combo) => {
    const comboNodes = nodesByCombo.get(combo.glossaryId) ?? [];
    if (comboNodes.length === 0) {
      return;
    }

    const nodeIds = new Set(comboNodes.map((n) => n.id));
    const childToParent = new Map<string, string>();
    edges.forEach((e) => {
      if (nodeIds.has(e.from) && nodeIds.has(e.to)) {
        const parent = e.from;
        const child = e.to;
        childToParent.set(child, parent);
      }
    });
    const roots = comboNodes.filter((n) => !childToParent.has(n.id));
    const rankByNode = new Map<string, number>();
    roots.forEach((r) => rankByNode.set(r.id, 0));
    const queue = roots.map((r) => r.id);
    let i = 0;
    while (i < queue.length) {
      const id = queue[i];
      const r = rankByNode.get(id) ?? 0;
      edges.forEach((e) => {
        if (e.from === id && nodeIds.has(e.to) && !rankByNode.has(e.to)) {
          rankByNode.set(e.to, r + 1);
          queue.push(e.to);
        }
      });
      i++;
    }
    comboNodes.forEach((n) => {
      if (!rankByNode.has(n.id)) {
        rankByNode.set(n.id, 0);
      }
    });

    const rankToNodes = new Map<number, typeof comboNodes>();
    comboNodes.forEach((n) => {
      const rank = rankByNode.get(n.id) ?? 0;
      const list = rankToNodes.get(rank) ?? [];
      list.push(n);
      rankToNodes.set(rank, list);
    });
    const ranks = Array.from(rankToNodes.keys()).sort((a, b) => a - b);

    const localPositions = new Map<string, { x: number; y: number }>();
    let minX = 0;
    let maxX = 0;
    let minY = 0;
    let maxY = 0;
    ranks.forEach((rank) => {
      const list = rankToNodes.get(rank) ?? [];
      list.forEach((node, idx) => {
        const x = idx * H_STEP + minNodeWidth / 2;
        const y = COMBO_HEADER + rank * RANK_SEP + NODE_HEIGHT / 2;
        localPositions.set(node.id, { x, y });
        minX = Math.min(minX, x - minNodeWidth / 2);
        maxX = Math.max(maxX, x + minNodeWidth / 2);
        minY = Math.min(minY, y - NODE_HEIGHT / 2);
        maxY = Math.max(maxY, y + NODE_HEIGHT / 2);
      });
    });

    const width = maxX - minX + COMBO_PADDING * 2;
    const height = maxY - minY + COMBO_PADDING * 2;
    comboLayouts.push({
      glossaryId: combo.glossaryId,
      localPositions,
      width,
      height,
    });
  });

  const numGroups = comboLayouts.length;
  const macroCols = getMacroCols(numGroups);
  const maxW = Math.max(...comboLayouts.map((c) => c.width), NODE_WIDTH);
  const maxH = Math.max(...comboLayouts.map((c) => c.height), NODE_HEIGHT);
  const cellW = maxW + HULL_GAP;
  const cellH = maxH + HULL_GAP;

  comboLayouts.forEach((layout, gi) => {
    const macroCol = gi % macroCols;
    const macroRow = Math.floor(gi / macroCols);
    const originX = macroCol * cellW + COMBO_PADDING;
    const originY = macroRow * cellH + COMBO_PADDING;

    let boxMinX = Infinity;
    let boxMinY = Infinity;
    const halfW = minNodeWidth / 2;
    layout.localPositions.forEach((pos) => {
      boxMinX = Math.min(boxMinX, pos.x - halfW);
      boxMinY = Math.min(boxMinY, pos.y - NODE_HEIGHT / 2);
    });
    layout.localPositions.forEach((pos, nodeId) => {
      positions[nodeId] = {
        x: originX + (pos.x - boxMinX),
        y: originY + (pos.y - boxMinY),
      };
    });
  });

  return positions;
}

export function computeDataModePositions(
  termNodes: OntologyNode[],
  edges: MergedEdge[],
  assetNodeIds: Set<string>
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  const N = termNodes.length;
  if (N === 0) {
    return positions;
  }

  const ASSET_NODE_DIAMETER = DATA_MODE_ASSET_CIRCLE_SIZE;
  const LABEL_HEIGHT = DATA_MODE_ASSET_LABEL_LAYOUT_STACK;
  const SAFETY_PAD = DATA_MODE_RING_SAFETY_PAD;
  const RING_GAP = ASSET_NODE_DIAMETER + LABEL_HEIGHT + SAFETY_PAD;

  const assetsPerArc = (radius: number, arcFraction: number): number => {
    const arcLen = radius * arcFraction * 2 * Math.PI;

    return Math.max(1, Math.floor(arcLen / DATA_MODE_ASSET_SPACING_ALONG_ARC));
  };

  const termIdSet = new Set(termNodes.map((t) => t.id));

  const termAssets = new Map<string, string[]>();
  termNodes.forEach((t) => termAssets.set(t.id, []));
  edges.forEach((edge) => {
    const fromIsTerm = termIdSet.has(edge.from);
    const toIsTerm = termIdSet.has(edge.to);
    if (fromIsTerm && assetNodeIds.has(edge.to)) {
      termAssets.get(edge.from)?.push(edge.to);
    } else if (toIsTerm && assetNodeIds.has(edge.from)) {
      termAssets.get(edge.to)?.push(edge.from);
    }
  });

  const MIN_TERM_SPACING = 200;
  const termRadius =
    N === 1 ? 0 : Math.max(280, (N * MIN_TERM_SPACING) / (2 * Math.PI));

  termNodes.forEach((term, i) => {
    const termAngle =
      N === 1 ? -Math.PI / 2 : (i / N) * 2 * Math.PI - Math.PI / 2;
    const tx = termRadius * Math.cos(termAngle);
    const ty = termRadius * Math.sin(termAngle);
    positions[term.id] = { x: tx, y: ty };

    const assets = termAssets.get(term.id) ?? [];
    const M = assets.length;
    if (M === 0) {
      return;
    }

    let placed = 0;
    let ringIdx = 0;

    while (placed < M) {
      const firstAssetRingRadius =
        DATA_MODE_TERM_TO_FIRST_RING_GAP + ASSET_NODE_DIAMETER;
      const ringRadius = firstAssetRingRadius + ringIdx * RING_GAP;

      const capacity = assetsPerArc(ringRadius, 1);
      const toPlace = Math.min(capacity, M - placed);

      for (let k = 0; k < toPlace; k++) {
        const assetId = assets[placed + k];
        const assetAngle =
          toPlace === 1
            ? -Math.PI / 2
            : -Math.PI / 2 + (2 * Math.PI * k) / toPlace;
        positions[assetId] = {
          x: tx + ringRadius * Math.cos(assetAngle),
          y: ty + ringRadius * Math.sin(assetAngle),
        };
      }

      placed += toPlace;
      ringIdx += 1;
    }
  });

  return positions;
}
