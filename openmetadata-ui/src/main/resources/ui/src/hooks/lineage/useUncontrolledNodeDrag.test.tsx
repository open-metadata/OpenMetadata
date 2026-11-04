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
import { act, renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { Node, ReactFlowProvider, useStoreApi } from 'reactflow';
import { useUncontrolledNodeDrag } from './useUncontrolledNodeDrag';

const wrapper = ({ children }: { children?: ReactNode }) => (
  <ReactFlowProvider>{children}</ReactFlowProvider>
);

const NODES: Node[] = [{ id: 'a', position: { x: 0, y: 0 }, data: {} }];

const setup = () => {
  const onNodesChange = jest.fn();
  const { result, rerender } = renderHook(
    () => ({
      flow: useUncontrolledNodeDrag(NODES, onNodesChange),
      store: useStoreApi(),
    }),
    { wrapper }
  );
  act(() => {
    result.current.store.getState().setNodes(NODES);
  });

  return { onNodesChange, result, rerender };
};

describe('useUncontrolledNodeDrag', () => {
  it('moves the node in React Flow only while dragging, then commits the final position once', () => {
    const { onNodesChange, result } = setup();

    act(() => {
      for (const y of [10, 20, 30]) {
        result.current.flow.onNodesChange([
          {
            id: 'a',
            type: 'position',
            dragging: true,
            position: { x: 5, y },
            positionAbsolute: { x: 5, y },
          },
        ]);
      }
    });

    expect(onNodesChange).not.toHaveBeenCalled();
    expect(
      result.current.store.getState().nodeInternals.get('a')
    ).toMatchObject({ position: { x: 5, y: 30 }, dragging: true });

    act(() => {
      result.current.flow.onNodesChange([
        { id: 'a', type: 'position', dragging: false },
      ]);
    });

    expect(onNodesChange).toHaveBeenCalledTimes(1);
    expect(onNodesChange).toHaveBeenCalledWith([
      {
        id: 'a',
        type: 'position',
        dragging: false,
        position: { x: 5, y: 30 },
        positionAbsolute: { x: 5, y: 30 },
      },
    ]);
  });

  it('overlays in-flight drag positions on the nodes it returns until the drop', () => {
    const { result, rerender } = setup();

    expect(result.current.flow.nodes).toBe(NODES);

    act(() => {
      result.current.flow.onNodesChange([
        {
          id: 'a',
          type: 'position',
          dragging: true,
          position: { x: 5, y: 30 },
        },
      ]);
    });
    // A caller re-render mid-drag (hover, measured node) still has the
    // pre-drag nodes; the returned nodes must carry the drag position.
    rerender();

    expect(result.current.flow.nodes).toEqual([
      { ...NODES[0], position: { x: 5, y: 30 }, dragging: true },
    ]);

    act(() => {
      result.current.flow.onNodesChange([
        { id: 'a', type: 'position', dragging: false },
      ]);
    });
    rerender();

    expect(result.current.flow.nodes).toBe(NODES);
  });

  it('settles a drag cancelled without a drop once another drag starts', () => {
    const nodes: Node[] = [
      ...NODES,
      { id: 'b', position: { x: 100, y: 0 }, data: {} },
    ];
    const onNodesChange = jest.fn();
    const { result, rerender } = renderHook(
      () => ({
        flow: useUncontrolledNodeDrag(nodes, onNodesChange),
        store: useStoreApi(),
      }),
      { wrapper }
    );
    act(() => {
      result.current.store.getState().setNodes(nodes);
    });
    const getNode = (id: string) =>
      result.current.store.getState().nodeInternals.get(id);

    act(() => {
      result.current.flow.onNodesChange([
        { id: 'a', type: 'position', dragging: true, position: { x: 5, y: 5 } },
      ]);
    });
    // No drop for `a`: a second touch aborted the drag. Then `b` is dragged.
    act(() => {
      result.current.flow.onNodesChange([
        { id: 'b', type: 'position', dragging: true, position: { x: 9, y: 9 } },
      ]);
    });
    rerender();

    expect(getNode('a')).toMatchObject({
      position: { x: 5, y: 5 },
      dragging: false,
    });
    expect(getNode('b')?.dragging).toBe(true);
    expect(onNodesChange).toHaveBeenCalledTimes(1);
    expect(onNodesChange).toHaveBeenCalledWith([
      { id: 'a', type: 'position', dragging: false, position: { x: 5, y: 5 } },
    ]);
    expect(result.current.flow.nodes).toEqual([
      nodes[0],
      { ...nodes[1], position: { x: 9, y: 9 }, dragging: true },
    ]);
  });

  it('passes non-drag changes through unchanged', () => {
    const { onNodesChange, result } = setup();
    const changes = [
      { id: 'a', type: 'select' as const, selected: true },
      {
        id: 'a',
        type: 'position' as const,
        dragging: false,
        position: { x: 1, y: 2 },
      },
    ];

    act(() => {
      result.current.flow.onNodesChange(changes);
    });

    expect(onNodesChange).toHaveBeenCalledWith(changes);
  });
});
