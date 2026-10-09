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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { TreeSelectNode } from './tree-select.types';
import { TreeSelect } from './tree-select';

// jsdom ships no ResizeObserver; the open dropdown measures its trigger with one.
beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

const fetchNodes = () =>
  vi.fn().mockResolvedValue({
    nodes: [{ id: 'a', label: 'Node A', value: 'a', isLeaf: true }],
  });

const renderCustomTrigger = (
  fetchData: ReturnType<typeof fetchNodes>,
  isOpen: boolean
) =>
  render(
    <TreeSelect
      fetchData={fetchData}
      isOpen={isOpen}
      renderTrigger={() => <span>trigger</span>}
    />
  );

describe('TreeSelect', () => {
  it('does not fetch while a custom-trigger picker stays closed', () => {
    const fetchData = fetchNodes();

    renderCustomTrigger(fetchData, false);

    expect(screen.getByText('trigger')).toBeInTheDocument();
    expect(fetchData).not.toHaveBeenCalled();
  });

  it('fetches the root when the picker first opens', async () => {
    const fetchData = fetchNodes();
    const { rerender } = renderCustomTrigger(fetchData, false);

    rerender(
      <TreeSelect
        isOpen
        fetchData={fetchData}
        renderTrigger={() => <span>trigger</span>}
      />
    );

    expect(await screen.findByText('Node A')).toBeInTheDocument();
    expect(fetchData).toHaveBeenCalledTimes(1);
  });

  it('keeps the loaded tree across a close and reopen', async () => {
    const fetchData = fetchNodes();
    const { rerender } = renderCustomTrigger(fetchData, true);

    await screen.findByText('Node A');

    rerender(
      <TreeSelect
        fetchData={fetchData}
        isOpen={false}
        renderTrigger={() => <span>trigger</span>}
      />
    );
    rerender(
      <TreeSelect
        isOpen
        fetchData={fetchData}
        renderTrigger={() => <span>trigger</span>}
      />
    );

    expect(await screen.findByText('Node A')).toBeInTheDocument();
    expect(fetchData).toHaveBeenCalledTimes(1);
  });

  it('opens the dropdown below the trigger by default', async () => {
    renderCustomTrigger(fetchNodes(), true);

    const node = await screen.findByText('Node A');

    expect(node.closest('[data-placement]')).toHaveAttribute(
      'data-placement',
      'bottom'
    );
  });

  it('opens the dropdown at a fixed placement when one is given', async () => {
    render(
      <TreeSelect
        isOpen
        fetchData={fetchNodes()}
        placement="right top"
        renderTrigger={() => <span>trigger</span>}
      />
    );

    const node = await screen.findByText('Node A');

    expect(node.closest('[data-placement]')).toHaveAttribute(
      'data-placement',
      'right'
    );
  });

  it('walks defaultExpandedKeys down a lazy tree to reveal a nested selection', async () => {
    // 'a.b.c' is selected, so the ancestor chain is ['a', 'a.b']. 'a.b' does not
    // exist until 'a' is expanded *and* fetched, so this only passes if default
    // expansion keeps draining the list and loads each lazy node it opens.
    const childrenById: Record<string, TreeSelectNode[]> = {
      a: [{ id: 'a.b', label: 'Node B', value: 'a.b' }],
      'a.b': [{ id: 'a.b.c', label: 'Node C', value: 'a.b.c', isLeaf: true }],
    };
    const fetchData = vi
      .fn()
      .mockImplementation(({ parentId }: { parentId?: string }) =>
        Promise.resolve({
          nodes: parentId
            ? childrenById[parentId] ?? []
            : [{ id: 'a', label: 'Node A', value: 'a' }],
        })
      );

    render(
      <TreeSelect
        isOpen
        lazyLoad
        defaultExpandedKeys={['a', 'a.b']}
        fetchData={fetchData}
        renderTrigger={() => <span>trigger</span>}
        value={[{ id: 'a.b.c', label: 'Node C', value: 'a.b.c' }]}
      />
    );

    expect(await screen.findByText('Node C')).toBeInTheDocument();
  });

  it('fetches on mount for the button variant, whose badge needs the roots', async () => {
    const fetchData = fetchNodes();

    render(
      <TreeSelect
        fetchData={fetchData}
        label="Glossary"
        triggerVariant="button"
      />
    );

    await waitFor(() => expect(fetchData).toHaveBeenCalledTimes(1));
  });

  // The row carries the keyboard affordance: inside a react-aria Tree, arrow
  // keys move between rows and never reach the button inside one.
  it('loads the next page when the load-more row is activated', async () => {
    const fetchData = vi
      .fn()
      .mockImplementation(
        async ({ parentId, after }: { parentId?: string; after?: string }) => {
          if (!parentId) {
            return {
              nodes: [{ id: 'a', label: 'Node A', value: 'a', isLeaf: false }],
            };
          }

          return after
            ? {
                nodes: [
                  { id: 'a.2', label: 'Second', value: 'a.2', isLeaf: true },
                ],
                hasMore: false,
                total: 2,
              }
            : {
                nodes: [
                  { id: 'a.1', label: 'First', value: 'a.1', isLeaf: true },
                ],
                hasMore: true,
                total: 2,
                nextCursor: 'cursor-1',
              };
        }
      );

    render(
      <TreeSelect
        isOpen
        lazyLoad
        defaultExpandedKeys={['a']}
        fetchData={fetchData}
        renderTrigger={() => <span>trigger</span>}
      />
    );

    const row = await screen.findByTestId('tree-node-load-more-a');
    const treeItem = row.closest('[role="row"], [role="treeitem"]');

    expect(treeItem).not.toBeNull();

    fireEvent.keyDown(treeItem as Element, { key: 'Enter' });
    fireEvent.keyUp(treeItem as Element, { key: 'Enter' });

    await waitFor(() =>
      expect(fetchData).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: 'a', after: 'cursor-1' })
      )
    );
  });

  it('loads the next root page when its load-more row is activated', async () => {
    const fetchData = vi
      .fn()
      .mockImplementation(async ({ after }: { after?: string }) =>
        after
          ? {
              nodes: [{ id: 'g2', label: 'Second', value: 'g2', isLeaf: true }],
              hasMore: false,
              total: 2,
            }
          : {
              nodes: [{ id: 'g1', label: 'First', value: 'g1', isLeaf: true }],
              hasMore: true,
              total: 2,
              nextCursor: 'root-cursor-1',
            }
      );

    render(
      <TreeSelect
        isOpen
        fetchData={fetchData}
        renderTrigger={() => <span>trigger</span>}
      />
    );

    const row = await screen.findByTestId('tree-node-load-more-root');
    const treeItem = row.closest('[role="row"], [role="treeitem"]');

    expect(treeItem).not.toBeNull();

    fireEvent.keyDown(treeItem as Element, { key: 'Enter' });
    fireEvent.keyUp(treeItem as Element, { key: 'Enter' });

    await waitFor(() =>
      expect(fetchData).toHaveBeenCalledWith(
        expect.objectContaining({ after: 'root-cursor-1' })
      )
    );
    expect(await screen.findByTestId('tree-node-g2')).toBeInTheDocument();
    expect(screen.getByTestId('tree-node-g1')).toBeInTheDocument();
  });

  // A container row is not pickable, but it is not blocked either — only a
  // genuinely disabled row may read as forbidden.
  it('keeps the plain cursor on an unselectable container row', async () => {
    const fetchData = vi.fn().mockResolvedValue({
      nodes: [
        { id: 'g', label: 'Glossary', value: 'g', allowSelection: false },
        { id: 'd', label: 'Blocked', value: 'd', disabled: true },
      ],
    });

    render(
      <TreeSelect
        isOpen
        fetchData={fetchData}
        renderTrigger={() => <span>trigger</span>}
      />
    );

    const container = await screen.findByTestId('tree-node-g');

    expect(container.className).toContain('cursor-default');
    expect(container.className).not.toContain('cursor-not-allowed');
    expect(screen.getByTestId('tree-node-d').className).toContain(
      'cursor-not-allowed'
    );
  });
});
