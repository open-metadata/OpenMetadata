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
import { ReactFlowProvider, useStoreApi } from 'reactflow';
import { useUncontrolledNodeDrag } from './useUncontrolledNodeDrag';

const wrapper = ({ children }: { children?: ReactNode }) => (
  <ReactFlowProvider>{children}</ReactFlowProvider>
);

const setup = () => {
  const onNodesChange = jest.fn();
  const { result } = renderHook(
    () => ({
      handleNodesChange: useUncontrolledNodeDrag(onNodesChange),
      store: useStoreApi(),
    }),
    { wrapper }
  );
  act(() => {
    result.current.store
      .getState()
      .setNodes([{ id: 'a', position: { x: 0, y: 0 }, data: {} }]);
  });

  return { onNodesChange, result };
};

describe('useUncontrolledNodeDrag', () => {
  it('moves the node in React Flow only while dragging, then commits the final position once', () => {
    const { onNodesChange, result } = setup();

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
      result.current.handleNodesChange(changes);
    });

    expect(onNodesChange).toHaveBeenCalledWith(changes);
  });
});
