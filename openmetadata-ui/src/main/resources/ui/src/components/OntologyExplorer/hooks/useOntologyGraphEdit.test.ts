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
import { findNearestNode, useOntologyGraphEdit } from './useOntologyGraphEdit';

const NODE_POSITIONS = {
  a: { x: 0, y: 0 },
  b: { x: 100, y: 0 },
  c: { x: 400, y: 400 },
};

const identityLocal = (x: number, y: number) => ({ x, y });

const move = (clientX: number, clientY: number) =>
  window.dispatchEvent(new MouseEvent('pointermove', { clientX, clientY }));

describe('findNearestNode', () => {
  it('returns the closest node within the hit radius, excluding the source', () => {
    expect(findNearestNode(NODE_POSITIONS, { x: 100, y: 0 }, 'a')).toBe('b');
  });

  it('excludes the source node even when the cursor is over it', () => {
    expect(findNearestNode(NODE_POSITIONS, { x: 0, y: 0 }, 'a')).toBeNull();
  });

  it('returns null when no node is within the hit radius', () => {
    expect(findNearestNode(NODE_POSITIONS, { x: 250, y: 250 }, 'a')).toBeNull();
  });
});

describe('useOntologyGraphEdit', () => {
  const setup = (onCreateRelation = jest.fn()) =>
    renderHook(() =>
      useOntologyGraphEdit({
        isEditMode: true,
        nodePositions: NODE_POSITIONS,
        toLocalPoint: identityLocal,
        onCreateRelation,
      })
    );

  it('arms from a source node and tracks the candidate target on move', () => {
    const { result } = setup();

    act(() => result.current.startArm('a', { x: 0, y: 0 }));

    expect(result.current.armedFromId).toBe('a');

    act(() => move(100, 0));

    expect(result.current.candidateTargetId).toBe('b');
    expect(result.current.cursor).toEqual({ x: 100, y: 0 });
  });

  it('creates a pending relation when a valid target is selected', () => {
    const { result } = setup();

    act(() => result.current.startArm('a', { x: 0, y: 0 }));
    act(() => result.current.selectTarget('b'));

    expect(result.current.pendingRelation).toEqual({
      from: { x: 0, y: 0 },
      fromId: 'a',
      to: { x: 100, y: 0 },
      toId: 'b',
      at: { x: 50, y: 0 },
    });
    expect(result.current.armedFromId).toBeNull();
  });

  it('uses the current rendered target point supplied by the graph', () => {
    const { result } = setup();

    act(() => result.current.startArm('a', { x: 20, y: 30 }));
    act(() => result.current.selectTarget('b', { x: 220, y: 130 }));

    expect(result.current.pendingRelation).toMatchObject({
      at: { x: 120, y: 80 },
      from: { x: 20, y: 30 },
      to: { x: 220, y: 130 },
    });
  });

  it('does not create a pending relation when the source is selected', () => {
    const { result } = setup();

    act(() => result.current.startArm('a', { x: 0, y: 0 }));
    act(() => result.current.selectTarget('a'));

    expect(result.current.pendingRelation).toBeNull();
    expect(result.current.armedFromId).toBe('a');
  });

  it('cancels the gesture on Escape', () => {
    const { result } = setup();

    act(() => result.current.startArm('a', { x: 0, y: 0 }));
    act(() =>
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    );

    expect(result.current.armedFromId).toBeNull();
    expect(result.current.pendingRelation).toBeNull();
  });

  it('confirmRelationType calls onCreateRelation and clears the pending relation', async () => {
    const onCreateRelation = jest.fn().mockResolvedValue(undefined);
    const { result } = setup(onCreateRelation);

    act(() => result.current.startArm('a', { x: 0, y: 0 }));
    act(() => result.current.selectTarget('b'));

    await act(async () => {
      await result.current.confirmRelationType('broader');
    });

    expect(onCreateRelation).toHaveBeenCalledWith('a', 'b', 'broader');
    expect(result.current.pendingRelation).toBeNull();
  });

  it('does not arm when edit mode is off', () => {
    const { result } = renderHook(() =>
      useOntologyGraphEdit({
        isEditMode: false,
        nodePositions: NODE_POSITIONS,
        toLocalPoint: identityLocal,
        onCreateRelation: jest.fn(),
      })
    );

    act(() => result.current.startArm('a', { x: 0, y: 0 }));

    expect(result.current.armedFromId).toBeNull();
  });
});
