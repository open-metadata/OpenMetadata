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

class ELKLayout {
  static elk = null;
  static layoutOptions = {
    'elk.algorithm': 'layered',
    'elk.direction': 'RIGHT',
    'elk.spacing.nodeNode': '100',
    'elk.layered.spacing.nodeNodeBetweenLayers': '150',
    'elk.layered.nodePlacement.strategy': 'SIMPLE',
    'elk.partitioning.activate': 'true',
  };

  static getElk() {
    return {
      layout: jest.fn().mockResolvedValue({
        id: 'root',
        children: [],
        edges: [],
      }),
    };
  }

  static async layoutGraph(nodes, edges) {
    return {
      id: 'root',
      layoutOptions: this.layoutOptions,
      children: nodes.map((node) => ({
        ...node,
        x: Math.random() * 100,
        y: Math.random() * 100,
        width: 100,
        height: 50,
      })),
      edges: edges.map((edge) => ({
        ...edge,
        sections: [
          {
            startPoint: { x: 0, y: 0 },
            endPoint: { x: 100, y: 100 },
          },
        ],
      })),
    };
  }
}

export default ELKLayout;
