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
import type { Edge, Node } from 'reactflow';
import { isEdgeOnDraggedNode } from './EdgeMidpointUtils';

const nodes: Record<string, Node> = {
  dragged: {
    id: 'dragged',
    position: { x: 0, y: 0 },
    data: {},
    dragging: true,
  },
  still: { id: 'still', position: { x: 0, y: 0 }, data: {} },
  other: { id: 'other', position: { x: 0, y: 0 }, data: {} },
};
const getNode = (id: string) => nodes[id];
const edge = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
});

describe('isEdgeOnDraggedNode', () => {
  it('flags an edge whose source or target is being dragged', () => {
    expect(isEdgeOnDraggedNode(edge('dragged', 'still'), getNode)).toBe(true);
    expect(isEdgeOnDraggedNode(edge('still', 'dragged'), getNode)).toBe(true);
  });

  it('leaves edges between nodes that are not dragged', () => {
    expect(isEdgeOnDraggedNode(edge('still', 'other'), getNode)).toBe(false);
    expect(isEdgeOnDraggedNode(edge('still', 'missing'), getNode)).toBe(false);
  });
});
