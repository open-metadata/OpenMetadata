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
import ELKGraph, {
  ELK,
  ElkExtendedEdge,
  ElkNode,
  LayoutOptions,
} from 'elkjs/lib/elk.bundled.js';

class ELKLayout {
  static elk: ELK;
  static layoutOptions: LayoutOptions = {
    'elk.algorithm': 'layered',
    'elk.direction': 'RIGHT',
    'elk.spacing.componentComponent': '180',
    'elk.spacing.edgeEdge': '24',
    'elk.spacing.edgeNode': '48',
    'elk.spacing.nodeNode': '110',
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    'elk.layered.crossingMinimization.semiInteractive': 'true',
    'elk.layered.mergeEdges': 'false',
    'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
    'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    'elk.layered.spacing.edgeEdgeBetweenLayers': '32',
    'elk.layered.spacing.edgeNodeBetweenLayers': '56',
    'elk.layered.spacing.nodeNodeBetweenLayers': '280',
    'elk.layered.thoroughness': '8',
    'elk.partitioning.activate': 'false',
  };

  constructor() {}

  static getElk() {
    if (!this.elk) {
      this.elk = new ELKGraph();
    }

    return this.elk;
  }

  static async layoutGraph(
    nodes: ElkNode[],
    edges: ElkExtendedEdge[],
    layoutOptions?: LayoutOptions
  ) {
    return ELKLayout.getElk().layout({
      id: 'root',
      layoutOptions: layoutOptions
        ? { ...this.layoutOptions, ...layoutOptions }
        : this.layoutOptions,
      children: nodes,
      edges: edges,
    });
  }
}

export default ELKLayout;
