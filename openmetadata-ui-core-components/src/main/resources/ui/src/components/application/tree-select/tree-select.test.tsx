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

// A mutually-exclusive (radio) group: `PII` is the group parent and each child
// is a radio sibling. Select All and per-row toggles must keep these radio
// siblings from being co-selected.
const PII_EMAIL: TreeSelectNode = {
  id: 'PII.Email',
  label: 'Email',
  value: 'PII.Email',
  isLeaf: true,
  isParentMutuallyExclusive: true,
  parentId: 'PII',
};
const PII_SSN: TreeSelectNode = {
  id: 'PII.SSN',
  label: 'SSN',
  value: 'PII.SSN',
  isLeaf: true,
  isParentMutuallyExclusive: true,
  parentId: 'PII',
};
const PII_PHONE: TreeSelectNode = {
  id: 'PII.Phone',
  label: 'Phone',
  value: 'PII.Phone',
  isLeaf: true,
  isParentMutuallyExclusive: true,
  parentId: 'PII',
};
const PII_RADIO_IDS = [PII_EMAIL.id, PII_SSN.id, PII_PHONE.id];

// A plain (checkbox) node beside the exclusive group, so "Select All" still
// has something to select and is not silently a no-op.
const FINANCE: TreeSelectNode = {
  id: 'Finance',
  label: 'Finance',
  value: 'Finance',
  isLeaf: true,
};

// `useCoreTranslation` returns keys literally in the test environment, so the
// Select All control reads as its i18n key.
const SELECT_ALL_LABEL = 'label.select-all';

const emittedAt = (onChange: ReturnType<typeof vi.fn>, call: number) =>
  onChange.mock.calls[call][0] as TreeSelectNode[];

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

describe('TreeSelect Select All and mutual exclusivity', () => {
  it('cascade + lazyLoad: Select All skips mutually-exclusive radio siblings', async () => {
    const fetchData = vi
      .fn()
      .mockImplementation(async ({ parentId }: { parentId?: string }) => {
        if (!parentId) {
          return {
            nodes: [
              {
                id: 'PII',
                label: 'PII',
                value: 'PII',
                allowSelection: true,
                lazyLoad: true,
                isLeaf: false,
                hasExclusiveChildren: true,
              },
              FINANCE,
            ],
          };
        }

        if (parentId === 'PII') {
          return { nodes: [PII_EMAIL, PII_SSN, PII_PHONE] };
        }

        return { nodes: [] };
      });

    const onChange = vi.fn();
    render(
      <TreeSelect
        cascadeSelection
        isOpen
        lazyLoad
        multiple
        showSelectAll
        fetchData={fetchData}
        renderTrigger={() => <span>trigger</span>}
        onChange={onChange}
      />
    );

    await screen.findByText('PII');
    fireEvent.click(screen.getByText(SELECT_ALL_LABEL));

    await waitFor(() => expect(onChange).toHaveBeenCalled());

    const emitted = emittedAt(onChange, 0);
    const piiSelected = emitted.filter((n) => PII_RADIO_IDS.includes(n.id));

    // Mutually-exclusive (radio) siblings must never be co-selected by Select All.
    expect(piiSelected).toHaveLength(0);
    // The exclusive-group parent carries no checkbox, so it is excluded too.
    expect(emitted.some((n) => n.id === 'PII')).toBe(false);
    // Every regular node is still selected.
    expect(emitted.some((n) => n.id === FINANCE.id)).toBe(true);
  });

  it('non-cascade: Select All skips mutually-exclusive radio siblings nested inline', async () => {
    const fetchData = vi
      .fn()
      .mockImplementation(async ({ parentId }: { parentId?: string }) => {
        if (!parentId) {
          return {
            nodes: [
              {
                id: 'PII',
                label: 'PII',
                value: 'PII',
                allowSelection: true,
                isLeaf: false,
                hasExclusiveChildren: true,
                children: [PII_EMAIL, PII_SSN, PII_PHONE],
              },
              FINANCE,
            ],
          };
        }

        return { nodes: [] };
      });

    const onChange = vi.fn();
    render(
      <TreeSelect
        isOpen
        multiple
        showSelectAll
        fetchData={fetchData}
        renderTrigger={() => <span>trigger</span>}
        onChange={onChange}
      />
    );

    // `selectableNodes` is derived from the data model, not the rendered DOM,
    // so the radio children are present while PII is collapsed.
    await screen.findByText('PII');
    fireEvent.click(screen.getByText(SELECT_ALL_LABEL));

    await waitFor(() => expect(onChange).toHaveBeenCalled());

    const emitted = emittedAt(onChange, 0);
    const piiSelected = emitted.filter((n) => PII_RADIO_IDS.includes(n.id));

    expect(piiSelected).toHaveLength(0);
    expect(emitted.some((n) => n.id === 'PII')).toBe(false);
    expect(emitted.some((n) => n.id === FINANCE.id)).toBe(true);
  });

  it('Select All still selects every regular (non-exclusive) node', async () => {
    const fetchData = vi.fn().mockResolvedValue({
      nodes: [
        {
          id: 'Glossary',
          label: 'Glossary',
          value: 'Glossary',
          isLeaf: false,
          children: [
            {
              id: 'TermA',
              label: 'Term A',
              value: 'TermA',
              isLeaf: true,
              parentId: 'Glossary',
            },
            {
              id: 'TermB',
              label: 'Term B',
              value: 'TermB',
              isLeaf: true,
              parentId: 'Glossary',
            },
          ],
        },
        FINANCE,
      ],
    });

    const onChange = vi.fn();
    render(
      <TreeSelect
        isOpen
        multiple
        showSelectAll
        fetchData={fetchData}
        renderTrigger={() => <span>trigger</span>}
        onChange={onChange}
      />
    );

    await screen.findByText('Glossary');
    fireEvent.click(screen.getByText(SELECT_ALL_LABEL));

    await waitFor(() => expect(onChange).toHaveBeenCalled());

    const ids = emittedAt(onChange, 0)
      .map((n) => n.id)
      .sort();

    expect(ids).toEqual(['Finance', 'Glossary', 'TermA', 'TermB']);
  });

  it('Select All skips an unselectable container but still selects its normal children', async () => {
    const fetchData = vi.fn().mockResolvedValue({
      nodes: [
        {
          id: 'Container',
          label: 'Container',
          value: 'Container',
          allowSelection: false,
          isLeaf: false,
          children: [
            {
              id: 'SelectableChild',
              label: 'Selectable',
              value: 'SelectableChild',
              isLeaf: true,
              parentId: 'Container',
            },
          ],
        },
        FINANCE,
      ],
    });

    const onChange = vi.fn();
    render(
      <TreeSelect
        isOpen
        multiple
        showSelectAll
        fetchData={fetchData}
        renderTrigger={() => <span>trigger</span>}
        onChange={onChange}
      />
    );

    await screen.findByText('Container');
    fireEvent.click(screen.getByText(SELECT_ALL_LABEL));

    await waitFor(() => expect(onChange).toHaveBeenCalled());

    const ids = emittedAt(onChange, 0).map((n) => n.id);
    const expected = ['SelectableChild', 'Finance'].sort();

    expect(ids).not.toContain('Container');
    expect([...ids].sort()).toEqual(expected);
  });

  it('Select All reads fully checked once every selectable node is selected (radio group excluded)', async () => {
    // FINANCE is the only selectable node once the PII radio group is excluded,
    // so seeding it must leave the Select All checkbox fully checked. Clicking
    // a checked box clears the selection rather than adding the radio group back.
    const fetchData = vi.fn().mockResolvedValue({
      nodes: [
        {
          id: 'PII',
          label: 'PII',
          value: 'PII',
          isLeaf: false,
          hasExclusiveChildren: true,
          children: [PII_EMAIL, PII_SSN, PII_PHONE],
        },
        FINANCE,
      ],
    });

    const onChange = vi.fn();
    render(
      <TreeSelect
        isOpen
        multiple
        showSelectAll
        fetchData={fetchData}
        renderTrigger={() => <span>trigger</span>}
        value={[FINANCE]}
        onChange={onChange}
      />
    );

    await screen.findByText('Finance');

    fireEvent.click(screen.getByText(SELECT_ALL_LABEL));

    await waitFor(() => expect(onChange).toHaveBeenCalled());

    // The box was checked, so toggling it cleared the selection — it did not
    // emit the radio siblings the buggy `allSelected` count would have demanded.
    const emitted = emittedAt(onChange, 0);
    const piiSelected = emitted.filter((n) => PII_RADIO_IDS.includes(n.id));

    expect(emitted).toEqual([]);
    expect(piiSelected).toHaveLength(0);
  });

  it('Select All skips a radio group nested under a regular parent', async () => {
    const fetchData = vi.fn().mockResolvedValue({
      nodes: [
        {
          id: 'Glossary',
          label: 'Glossary',
          value: 'Glossary',
          isLeaf: false,
          children: [
            {
              id: 'PII',
              label: 'PII',
              value: 'PII',
              allowSelection: true,
              isLeaf: false,
              hasExclusiveChildren: true,
              children: [PII_EMAIL, PII_SSN],
            },
            {
              id: 'TermA',
              label: 'Term A',
              value: 'TermA',
              isLeaf: true,
              parentId: 'Glossary',
            },
          ],
        },
        FINANCE,
      ],
    });

    const onChange = vi.fn();
    render(
      <TreeSelect
        isOpen
        multiple
        showSelectAll
        fetchData={fetchData}
        renderTrigger={() => <span>trigger</span>}
        onChange={onChange}
      />
    );

    await screen.findByText('Glossary');
    fireEvent.click(screen.getByText(SELECT_ALL_LABEL));

    await waitFor(() => expect(onChange).toHaveBeenCalled());

    const ids = emittedAt(onChange, 0).map((n) => n.id);
    const piiSelected = ids.filter((id) => PII_RADIO_IDS.includes(id));

    // The nested radio group and the radio siblings beneath it are skipped.
    expect(piiSelected).toHaveLength(0);
    expect(ids).not.toContain('PII');
    // The surrounding regular nodes are still selected (order reflects the walk).
    expect([...ids].sort()).toEqual(['Finance', 'Glossary', 'TermA']);
  });
});
