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
  ExtensionCategory,
  idOf,
  Polyline,
  register,
  type Point,
  type PolylineStyleProps,
} from '@antv/g6';
import { orth } from '@antv/g6/esm/utils/router/orth';
import { aStarSearch } from '@antv/g6/esm/utils/router/shortest-path';

const COMBO_HIERARCHY = 'combo' as const;

export const ONTOLOGY_COMBO_AWARE_POLYLINE_EDGE_TYPE =
  'ontology-combo-aware-polyline';

type ParsedPolylineStyle = Required<PolylineStyleProps>;

/**
 * Polyline edge whose shortest-path router treats glossary combo hulls as
 * obstacles (built-in {@link Polyline} only avoids other nodes).
 */
export class OntologyComboAwarePolyline extends Polyline {
  private buildRoutingObstacles(
    sourceNode: { id: string },
    targetNode: { id: string },
    nodes: unknown[]
  ): unknown[] {
    const { element, model } = this.context;
    const skipComboIds = new Set<string>();
    model.getAncestorsData(sourceNode.id, COMBO_HIERARCHY).forEach((d) => {
      skipComboIds.add(idOf(d));
    });
    model.getAncestorsData(targetNode.id, COMBO_HIERARCHY).forEach((d) => {
      skipComboIds.add(idOf(d));
    });

    const comboElements = (element?.getCombos() ?? []).filter(
      (c): c is NonNullable<typeof c> =>
        Boolean(c) && !c.destroyed && c.isVisible() && !skipComboIds.has(c.id)
    );

    return [...nodes, ...comboElements];
  }

  protected getControlPoints(attributes: ParsedPolylineStyle): Point[] {
    const { router } = attributes;
    const { sourceNode, targetNode } = this;
    const [sourcePoint, targetPoint] = this.getEndpoints(attributes, false);
    let controlPoints: Point[] = [];

    if (!router) {
      controlPoints = attributes.controlPoints ?? [];
    } else if (router.type === 'shortest-path') {
      const element = this.context.element;
      const nodes = element?.getNodes() ?? [];
      const routingNodes =
        router.enableObstacleAvoidance === true
          ? this.buildRoutingObstacles(sourceNode, targetNode, nodes)
          : nodes;

      controlPoints = aStarSearch(
        sourceNode,
        targetNode,
        routingNodes as Parameters<typeof aStarSearch>[2],
        router
      );
      if (!controlPoints.length) {
        controlPoints = orth(
          sourcePoint,
          targetPoint,
          sourceNode,
          targetNode,
          attributes.controlPoints,
          { padding: router.offset }
        );
      }
    } else if (router.type === 'orth') {
      controlPoints = orth(
        sourcePoint,
        targetPoint,
        sourceNode,
        targetNode,
        attributes.controlPoints,
        router
      );
    }

    return controlPoints;
  }
}

register(
  ExtensionCategory.EDGE,
  ONTOLOGY_COMBO_AWARE_POLYLINE_EDGE_TYPE,
  OntologyComboAwarePolyline
);
