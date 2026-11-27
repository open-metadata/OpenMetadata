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
import { act, render } from '@testing-library/react';
import { Node, ReactFlowProvider, useStoreApi } from 'reactflow';
import UncontrolledDragFlow from './UncontrolledDragFlow';

type FlowStore = ReturnType<typeof useStoreApi>;

const NODE: Node = { id: 'a', position: { x: 0, y: 0 }, data: {} };

const renderFlow = () => {
  const onNodesChange = jest.fn();
  const flow: { store?: FlowStore } = {};
  const CaptureStore = () => {
    flow.store = useStoreApi();

    return null;
  };
  const view = (nodes: Node[]) => (
    <div style={{ width: 400, height: 400 }}>
      <ReactFlowProvider>
        <UncontrolledDragFlow nodes={nodes} onNodesChange={onNodesChange} />
        <CaptureStore />
      </ReactFlowProvider>
    </div>
  );
  const { rerender } = render(view([NODE]));

  return {
    onNodesChange,
    getStore: () => flow.store,
    rerenderWith: (nodes: Node[]) => rerender(view(nodes)),
  };
};

const dragItem = {
  id: 'a',
  position: { x: 40, y: 60 },
  positionAbsolute: { x: 40, y: 60 },
  distance: { x: 0, y: 0 },
  delta: { x: 0, y: 0 },
  extent: undefined,
  parentNode: undefined,
  dimensions: { width: 0, height: 0 },
};

describe('UncontrolledDragFlow', () => {
  it('keeps drag frames inside React Flow and reports only the drop', () => {
    const { onNodesChange, getStore } = renderFlow();
    const store = getStore();
    act(() => {
      store?.getState().updateNodePositions([dragItem], true, true);
    });

    expect(onNodesChange).not.toHaveBeenCalled();

    act(() => {
      store?.getState().updateNodePositions([dragItem], false, false);
    });

    expect(onNodesChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'a',
        type: 'position',
        dragging: false,
        position: { x: 40, y: 60 },
      }),
    ]);
  });

  it('keeps the dragged node in place when the parent re-renders mid-drag, and saves the drop', () => {
    const { onNodesChange, getStore, rerenderWith } = renderFlow();
    const store = getStore();

    act(() => {
      store?.getState().updateNodePositions([dragItem], true, true);
    });
    // A hover highlight rebuilds the parent's nodes, still at the start.
    rerenderWith([{ ...NODE, className: 'lineage-path-highlight' }]);

    expect(store?.getState().nodeInternals.get('a')).toMatchObject({
      position: { x: 40, y: 60 },
      dragging: true,
    });

    act(() => {
      store?.getState().updateNodePositions([dragItem], false, false);
    });

    expect(onNodesChange).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'a',
        dragging: false,
        position: { x: 40, y: 60 },
      }),
    ]);
  });
});
