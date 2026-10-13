/*
 *  Copyright 2025 Collate.
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
import { Edge } from 'reactflow';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { onColumnMouseEnter } from './columnInteractions';

describe('onColumnMouseEnter', () => {
  beforeEach(() => useLineageStore.getState().reset());

  it('sets tracedColumns to the connected column set for the given fqn', () => {
    useLineageStore.setState({
      columnEdges: [
        {
          id: 'e1',
          source: 'nodeA',
          target: 'nodeB',
          sourceHandle: 'colA',
          targetHandle: 'colB',
        } as unknown as Edge,
        {
          id: 'e2',
          source: 'nodeB',
          target: 'nodeC',
          sourceHandle: 'colB',
          targetHandle: 'colC',
        } as unknown as Edge,
      ],
    });

    onColumnMouseEnter('colB');

    const traced = useLineageStore.getState().tracedColumns;

    expect(traced.has('colA')).toBe(true);
    expect(traced.has('colB')).toBe(true);
    expect(traced.has('colC')).toBe(true);
  });
});
