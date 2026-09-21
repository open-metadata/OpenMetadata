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
import { Node } from 'reactflow';
import { SourceType } from '../../../interface/source.interface';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { onPaneClick } from './nodeMutations';

describe('onPaneClick', () => {
  beforeEach(() => useLineageStore.getState().reset());

  it('clears node/column selection state and closes the drawer', () => {
    useLineageStore.setState({
      tracedNodes: new Set(['node1']),
      tracedColumns: new Set(['col1']),
      selectedColumn: 'col1',
      activeNode: { id: 'node1' } as unknown as Node,
      selectedNode: { id: 'node1' } as unknown as SourceType,
      isDrawerOpen: true,
    });

    onPaneClick();

    const state = useLineageStore.getState();

    expect(state.tracedNodes.size).toBe(0);
    expect(state.tracedColumns.size).toBe(0);
    expect(state.selectedColumn).toBe('');
    expect(state.activeNode).toBeUndefined();
    expect(state.selectedNode).toBeUndefined();
    expect(state.isDrawerOpen).toBe(false);
  });
});
