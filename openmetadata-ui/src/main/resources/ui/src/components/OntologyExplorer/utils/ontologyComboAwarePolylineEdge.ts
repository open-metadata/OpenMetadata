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
import { Group, Text as GText } from '@antv/g';
import {
  ExtensionCategory,
  idOf,
  Polyline,
  register,
  type Combo,
  type Node,
  type PolylineStyleProps,
} from '@antv/g6';

const CARDINALITY_LABEL_FONT_SIZE = 10;
const CARDINALITY_LABEL_FILL = '#8C93AE';
const CARDINALITY_ALONG_PX = 24;
const CARDINALITY_PERP_PX = 11;

const COMBO_HIERARCHY = 'combo' as const;

export const ONTOLOGY_COMBO_AWARE_POLYLINE_EDGE_TYPE =
  'ontology-combo-aware-polyline';

type ParsedPolylineStyle = Required<PolylineStyleProps>;

type ElementLike = {
  getCombos: () => Combo[];
  getNodes: () => Node[];
};

/**
 * Polyline edge whose shortest-path router treats glossary combo hulls as
 * obstacles (built-in {@link Polyline} only avoids other nodes).
 */
export class OntologyComboAwarePolyline extends Polyline {
  override render(
    attributes: ParsedPolylineStyle,
    container: Group
  ): void {
    super.render(attributes, container);
    this.drawCardinalityLabel(attributes, container, 'start');
    this.drawCardinalityLabel(attributes, container, 'end');
  }

  private drawCardinalityLabel(
    attributes: ParsedPolylineStyle,
    container: Group,
    end: 'start' | 'end'
  ): void {
    const attrs = attributes as Record<string, unknown>;
    const key = end === 'start' ? 'startLabelText' : 'endLabelText';
    const text = typeof attrs[key] === 'string' ? (attrs[key] as string) : '';
    if (!text) {
      this.upsert(`cardinality-${end}`, GText, false, container);

      return;
    }

    const endpoints = this.getEndpoints(attributes);
    const [sx, sy] = endpoints[0];
    const [ex, ey] = endpoints[1];
    const edgeDx = ex - sx;
    const edgeDy = ey - sy;
    const len = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy);

    let labelX: number;
    let labelY: number;

    if (len < 1) {
      labelX = end === 'start' ? sx : ex;
      labelY = end === 'start' ? sy : ey;
    } else {
      const ux = edgeDx / len;
      const uy = edgeDy / len;
      const along = Math.min(CARDINALITY_ALONG_PX, len * 0.3);
      const px = -uy;
      const py = ux;

      if (end === 'start') {
        labelX = sx + ux * along + px * CARDINALITY_PERP_PX;
        labelY = sy + uy * along + py * CARDINALITY_PERP_PX;
      } else {
        labelX = ex - ux * along + px * CARDINALITY_PERP_PX;
        labelY = ey - uy * along + py * CARDINALITY_PERP_PX;
      }
    }

    this.upsert(
      `cardinality-${end}`,
      GText,
      {
        x: labelX,
        y: labelY,
        text,
        fontSize: CARDINALITY_LABEL_FONT_SIZE,
        fill: CARDINALITY_LABEL_FILL,
        fontWeight: 700,
        textBaseline: 'middle',
        textAlign: 'center',
        zIndex: 10,
      },
      container
    );
  }

  private buildRoutingObstacleNodes(
    sourceNode: { id: string },
    targetNode: { id: string },
    nodes: Node[]
  ): Node[] {
    const { element, model } = this.context;
    const skipComboIds = new Set<string>();
    model.getAncestorsData(sourceNode.id, COMBO_HIERARCHY).forEach((d) => {
      skipComboIds.add(idOf(d));
    });
    model.getAncestorsData(targetNode.id, COMBO_HIERARCHY).forEach((d) => {
      skipComboIds.add(idOf(d));
    });

    const comboElements =
      (element as ElementLike | undefined)?.getCombos() ?? [];
    const comboObstacles = comboElements.filter(
      (c) =>
        Boolean(c) && !c.destroyed && c.isVisible() && !skipComboIds.has(c.id)
    );

    return [...nodes, ...comboObstacles] as Node[];
  }

  protected getControlPoints(attributes: ParsedPolylineStyle) {
    const { router } = attributes;
    const element = this.context.element as ElementLike | undefined;

    if (
      router &&
      router.type === 'shortest-path' &&
      router.enableObstacleAvoidance === true &&
      element
    ) {
      const { sourceNode, targetNode } = this;
      const originalGetNodes = element.getNodes.bind(element) as () => Node[];
      element.getNodes = () =>
        this.buildRoutingObstacleNodes(
          sourceNode,
          targetNode,
          originalGetNodes()
        );

      try {
        return super.getControlPoints(attributes);
      } finally {
        element.getNodes = originalGetNodes;
      }
    }

    return super.getControlPoints(attributes);
  }
}

register(
  ExtensionCategory.EDGE,
  ONTOLOGY_COMBO_AWARE_POLYLINE_EDGE_TYPE,
  OntologyComboAwarePolyline
);
