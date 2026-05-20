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
  type Combo,
  type Node,
  type PolylineStyleProps,
} from '@antv/g6';

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
