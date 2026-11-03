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
import {
  applyNodeChanges,
  Node,
  NodeChange,
  ReactFlowProvider,
  useStoreApi,
} from 'reactflow';
import { useUncontrolledNodeDrag } from './useUncontrolledNodeDrag';

const wrapper = ({ children }: { children?: ReactNode }) => (
  <ReactFlowProvider>{children}</ReactFlowProvider>
);

const setup = (
  nodes: Node[] = [{ id: 'a', position: { x: 0, y: 0 }, data: {} }],
  onNodesChange: (changes: NodeChange[]) => void = jest.fn()
) => {
  const { result } = renderHook(
    () => ({
      handleNodesChange: useUncontrolledNodeDrag(onNodesChange),
      store: useStoreApi(),
    }),
    { wrapper }
  );
  act(() => {
    result.current.store.getState().setNodes(nodes);
  });

  return { result };
};

describe('useUncontrolledNodeDrag', () => {
  it('moves the node in React Flow only while dragging, then commits the final position once', () => {
    const onNodesChange = jest.fn();
    const { result } = setup(undefined, onNodesChange);

    act(() => {
      for (const y of [10, 20, 30]) {
        result.current.handleNodesChange([
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
      result.current.store.getState().nodeInternals.get('a')?.dragging
    ).toBe(true);
    expect(
      result.current.store.getState().nodeInternals.get('a')?.position
    ).toEqual({ x: 5, y: 30 });

    act(() => {
      result.current.handleNodesChange([
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

  it('passes non-drag changes through unchanged', () => {
    const onNodesChange = jest.fn();
    const { result } = setup(undefined, onNodesChange);
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
      result.current.handleNodesChange(changes);
    });

    expect(onNodesChange).toHaveBeenCalledWith(changes);
  });

  it('keeps a dragged node in place when the caller re-syncs mid-drag, and saves the dropped position', () => {
    let parentNodes: Node[] = [
      { id: 'a', position: { x: 0, y: 0 }, data: {} },
      { id: 'b', position: { x: 100, y: 0 }, data: {} },
    ];
    // A controlled parent: it applies what it receives, then React Flow's
    // StoreUpdater rebuilds the flow store from the parent's nodes.
    const flow: { store?: ReturnType<typeof useStoreApi> } = {};
    const parent = jest.fn((changes: NodeChange[]) => {
      parentNodes = applyNodeChanges(changes, parentNodes);
      flow.store?.getState().setNodes(parentNodes);
    });
    const { result } = setup(parentNodes, parent);
    flow.store = result.current.store;
    const getA = () => result.current.store.getState().nodeInternals.get('a');

    act(() => {
      result.current.handleNodesChange([
        {
          id: 'a',
          type: 'position',
          dragging: true,
          position: { x: 5, y: 30 },
          positionAbsolute: { x: 5, y: 30 },
        },
      ]);
      // Auto-pan revealed `b`; React Flow reports its measured size.
      result.current.handleNodesChange([
        {
          id: 'b',
          type: 'dimensions',
          dimensions: { width: 200, height: 80 },
        },
      ]);
    });

    expect(getA()?.position).toEqual({ x: 5, y: 30 });
    expect(getA()?.dragging).toBe(true);

    act(() => {
      result.current.handleNodesChange([
        { id: 'a', type: 'position', dragging: false },
      ]);
    });

    expect(parentNodes.find((node) => node.id === 'a')).toMatchObject({
      position: { x: 5, y: 30 },
      dragging: false,
    });
  });
});
