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
    'elk.spacing.nodeNode': '80',
    'elk.layered.spacing.nodeNodeBetweenLayers': '200',
    // Let ELK derive layers from edge topology instead of pinning nodes to a
    // backend-provided nodeDepth. Partitioning forced a multi-branch node into
    // the column of its first depth, misaligning its other edges.
    'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    // BALANCED averages Brandes-Köpf's four extreme alignments into a centroid.
    // Without it, a symmetric source (e.g. equal upstream/downstream branches)
    // has multiple optimal placements and ELK snaps to a top-aligned corner
    // instead of sitting vertically centered between its neighbors.
    'elk.layered.nodePlacement.bk.fixedAlignment': 'BALANCED',
  };

  constructor() {}

  static getElk() {
    if (!this.elk) {
      this.elk = new ELKGraph();
    }

    return this.elk;
  }

  static async layoutGraph(nodes: ElkNode[], edges: ElkExtendedEdge[]) {
    return ELKLayout.getElk().layout({
      id: 'root',
      layoutOptions: this.layoutOptions,
      children: nodes,
      edges: edges,
    });
  }
}

export default ELKLayout;
