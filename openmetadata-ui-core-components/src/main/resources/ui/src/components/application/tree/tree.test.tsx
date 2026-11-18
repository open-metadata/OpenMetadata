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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TreeItemMoveEvent } from './tree';
import { Tree } from './tree';

const DRAG_WARNING =
  'Draggable items in a Tree must contain a <Button slot="drag"> element so that keyboard and screen reader users can drag them.';

const renderDraggableTree = (options: {
  onItemMove: (event: TreeItemMoveEvent) => void;
  withDragButton?: boolean;
}) => {
  const { onItemMove, withDragButton = true } = options;

  return render(
    <Tree aria-label="Reorderable list" onItemMove={onItemMove}>
      {(['alpha', 'beta', 'gamma'] as const).map((id) => (
        <Tree.Item id={id} key={id} textValue={id}>
          <Tree.ItemContent showExpandIcon={false}>
            {withDragButton && <Tree.DragButton aria-label={`Move ${id}`} />}
            <span>{id}</span>
          </Tree.ItemContent>
        </Tree.Item>
      ))}
    </Tree>
  );
};

// React Aria's Tree emits a hidden drop-indicator `role="row"` between every
// pair of items (and at the top/bottom of the tree). The item rows themselves
// carry `data-key` so we can reliably target them regardless of indicator
// rows being interleaved in `getAllByRole('row')`.
const itemRow = (key: string) =>
  screen
    .getAllByRole('row')
    .find((row) => row.getAttribute('data-key') === key);

const pressEnter = (target: HTMLElement) => {
  fireEvent.keyDown(target, { key: 'Enter', keyCode: 13, code: 'Enter' });
  fireEvent.keyUp(target, { key: 'Enter', keyCode: 13, code: 'Enter' });
};

const flushRaf = () =>
  act(async () => {
    // React Aria's DragSession calls `setup()` (which auto-selects the first
    // drop target and announces instructions) inside `requestAnimationFrame`.
    // jsdom doesn't auto-pump rAF — give it a microtask + setTimeout window.
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
  });

describe('Tree.DragButton', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // React Aria's "must contain a `<Button slot=\"drag\">`" warning is dev-only
    // (guarded by `process.env.NODE_ENV !== 'production'`). Silence the noisy
    // output for the intentional "missing drag button" case and let the spy
    // re-read each call in the assertions.
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('is exposed as a compound sub-component (parity with Tree.ExpandButton)', () => {
    expect(Tree.DragButton).toBeDefined();
    expect(typeof Tree.DragButton).toBe('function');
  });

  it('does not emit the React Aria dev warning when each item renders a Tree.DragButton', async () => {
    const onItemMove = vi.fn();
    renderDraggableTree({ onItemMove, withDragButton: true });

    await waitFor(() =>
      expect(
        warnSpy.mock.calls.some((call) =>
          String(call[0]).includes(DRAG_WARNING)
        )
      ).toBe(false)
    );

    expect(
      warnSpy.mock.calls.some((call) => String(call[0]).includes(DRAG_WARNING))
    ).toBe(false);
  });

  it('emits the React Aria dev warning per draggable item when no Tree.DragButton is rendered', async () => {
    const onItemMove = vi.fn();
    renderDraggableTree({ onItemMove, withDragButton: false });

    await waitFor(() =>
      expect(
        warnSpy.mock.calls.filter((call) =>
          String(call[0]).includes(DRAG_WARNING)
        ).length
      ).toBe(3)
    );
  });

  it('renders a real focusable button (not an aria-hidden icon) with the consumer aria-label', () => {
    const onItemMove = vi.fn();
    renderDraggableTree({ onItemMove, withDragButton: true });

    const handle = screen.getByRole('button', { name: 'Move alpha' });

    expect(handle).toBeInTheDocument();
    expect(handle).toHaveAttribute('slot', 'drag');
    expect(handle.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('starts a keyboard drag session on Enter (source row marks itself data-dragging) and fires onItemMove after a second Enter drops', async () => {
    const onItemMove = vi.fn();
    renderDraggableTree({ onItemMove, withDragButton: true });

    const alphaRow = itemRow('alpha');
    expect(alphaRow).not.toBeNull();

    const alphaHandle = screen.getByRole('button', { name: 'Move alpha' });

    alphaHandle.focus();
    await waitFor(() => expect(alphaHandle).toHaveFocus());
    pressEnter(alphaHandle);

    await flushRaf();

    expect(alphaRow).toHaveAttribute('data-dragging', 'true');

    // DragSession drops on a capture-phase keyup listener it adds to `document`.
    pressEnter(document.activeElement as HTMLElement);

    await waitFor(() => expect(onItemMove).toHaveBeenCalledTimes(1));
    expect(onItemMove.mock.calls[0][0]).toMatchObject({
      sourceKey: 'alpha',
    });
  });

  it('cannot start a keyboard drag from the row when no Tree.DragButton is rendered (the bug)', async () => {
    const onItemMove = vi.fn();
    renderDraggableTree({ onItemMove, withDragButton: false });

    const alphaRow = itemRow('alpha');
    expect(alphaRow).not.toBeNull();

    alphaRow.focus();
    await waitFor(() => expect(alphaRow).toHaveFocus());
    pressEnter(alphaRow);
    await flushRaf();

    expect(alphaRow).not.toHaveAttribute('data-dragging');
    expect(onItemMove).not.toHaveBeenCalled();
  });
});
