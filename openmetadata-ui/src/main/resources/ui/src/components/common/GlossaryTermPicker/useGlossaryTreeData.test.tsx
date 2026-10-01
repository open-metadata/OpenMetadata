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
import { renderHook } from '@testing-library/react';
import { useGlossaryTreeData } from './useGlossaryTreeData';

const mockGetGlossariesList = jest.fn();

const mockSearchGlossaryTerms = jest.fn();

const mockGetGlossaryTermChildrenLazy = jest.fn();

jest.mock('../../../rest/glossaryAPI', () => ({
  getGlossariesList: (...args: unknown[]) => mockGetGlossariesList(...args),
  getGlossaryTermChildrenLazy: (...args: unknown[]) =>
    mockGetGlossaryTermChildrenLazy(...args),
  searchGlossaryTerms: (...args: unknown[]) => mockSearchGlossaryTerms(...args),
}));

// `useGlossaryMutualExclusivity` is not mocked — the real chain is under test.

const page = (data: unknown[], paging: { total: number; after?: string }) => ({
  data,
  paging,
});

const fetchRoots = async (rootIsValue?: boolean) => {
  const { result } = renderHook(() => useGlossaryTreeData(rootIsValue));

  return result.current({});
};

describe('useGlossaryTreeData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetGlossariesList.mockResolvedValue({
      data: [
        { name: 'Empty', fullyQualifiedName: 'Empty', termCount: 0 },
        { name: 'Filled', fullyQualifiedName: 'Filled', termCount: 3 },
        { name: 'Unknown', fullyQualifiedName: 'Unknown' },
      ],
    });
  });

  // Nothing cascades, so a glossary row can only ever be a container.
  it('never checks a glossary row, whatever its term count', async () => {
    const { nodes } = await fetchRoots();

    expect(nodes.some(({ allowSelection }) => allowSelection)).toBe(false);
  });

  // A glossary whose own name matches has no term hit to carry it into results.
  it('surfaces a glossary whose name matches the search', async () => {
    mockSearchGlossaryTerms.mockResolvedValue([]);
    const { result } = renderHook(() => useGlossaryTreeData());

    await result.current({});
    const { nodes } = await result.current({ searchTerm: 'fill' });

    expect(nodes.map(({ id }) => id)).toEqual(['Filled']);
  });

  // Search results take the same rule; otherwise typing re-enables the rows.
  it('applies the rule to searched glossaries too', async () => {
    mockSearchGlossaryTerms.mockResolvedValue([
      {
        name: 'Filled',
        fullyQualifiedName: 'Filled',
        children: [{ name: 't1' }],
      },
    ]);
    const { result } = renderHook(() => useGlossaryTreeData());

    const { nodes } = await result.current({ searchTerm: 'fi' });

    expect(nodes[0].allowSelection).toBe(false);
  });

  // ChangeParent picks the glossary itself, so an empty one is still a target.
  it('keeps every glossary selectable when glossaries are the value', async () => {
    const { nodes } = await fetchRoots(true);

    expect(nodes.every(({ allowSelection }) => allowSelection)).toBe(true);
  });

  describe('expanding a branch', () => {
    const expand = async (
      params: Parameters<ReturnType<typeof useGlossaryTreeData>>[0]
    ) => {
      const { result } = renderHook(() => useGlossaryTreeData());
      // Roots first: that is where each glossary's FQN gets recorded.
      await result.current({});

      return result.current(params);
    };

    it('asks for one page of direct children, not the whole glossary', async () => {
      mockGetGlossaryTermChildrenLazy.mockResolvedValue(
        page([{ name: 't1', fullyQualifiedName: 'Filled.t1' }], { total: 1 })
      );

      const { nodes, hasMore } = await expand({
        parentId: 'Filled',
        pageSize: 100,
      });

      expect(mockGetGlossaryTermChildrenLazy).toHaveBeenCalledWith(
        'Filled',
        100,
        undefined,
        expect.objectContaining({ fields: ['childrenCount'] })
      );
      expect(nodes.map(({ id }) => id)).toEqual(['Filled.t1']);
      expect(hasMore).toBe(false);
    });

    // The cursor is what the "Show N more" row spends; total is what it counts.
    it('reports the cursor and total of a truncated branch', async () => {
      mockGetGlossaryTermChildrenLazy.mockResolvedValue(
        page([{ name: 't1', fullyQualifiedName: 'Filled.t1' }], {
          total: 137,
          after: 'cursor-1',
        })
      );

      const response = await expand({ parentId: 'Filled', pageSize: 100 });

      expect(response).toMatchObject({
        hasMore: true,
        total: 137,
        nextCursor: 'cursor-1',
      });
    });

    it('passes the cursor back when loading more', async () => {
      mockGetGlossaryTermChildrenLazy.mockResolvedValue(page([], { total: 1 }));

      await expand({ parentId: 'Filled', pageSize: 100, after: 'cursor-1' });

      expect(mockGetGlossaryTermChildrenLazy).toHaveBeenCalledWith(
        'Filled',
        100,
        'cursor-1',
        expect.anything()
      );
    });

    // An exclusive glossary allows one term, so its children are radios.
    it('marks the children of an exclusive glossary as radio choices', async () => {
      mockGetGlossariesList.mockResolvedValue({
        data: [
          {
            name: 'Colours',
            fullyQualifiedName: 'Colours',
            termCount: 3,
            mutuallyExclusive: true,
          },
        ],
      });
      mockGetGlossaryTermChildrenLazy.mockResolvedValue(
        page(
          [
            { name: 'Red', fullyQualifiedName: 'Colours.Red' },
            { name: 'Green', fullyQualifiedName: 'Colours.Green' },
          ],
          { total: 2 }
        )
      );

      const { nodes } = await expand({ parentId: 'Colours' });

      expect(
        nodes.map(({ isParentMutuallyExclusive }) => isParentMutuallyExclusive)
      ).toEqual([true, true]);
    });

    // Declared, not inferred: a lazy branch has no children to infer from.
    it('marks an exclusive term as the group above its radios', async () => {
      mockGetGlossaryTermChildrenLazy.mockResolvedValue(
        page(
          [
            {
              name: 'Region',
              fullyQualifiedName: 'Filled.Region',
              mutuallyExclusive: true,
              childrenCount: 2,
            },
            {
              name: 'Childless',
              fullyQualifiedName: 'Filled.Childless',
              mutuallyExclusive: true,
              childrenCount: 0,
            },
            { name: 'Plain', fullyQualifiedName: 'Filled.Plain' },
          ],
          { total: 3 }
        )
      );

      const { nodes } = await expand({ parentId: 'Filled' });

      // The childless one keeps its own control — it has no group to stand for.
      expect(
        nodes.map(({ hasExclusiveChildren }) => hasExclusiveChildren)
      ).toEqual([true, false, false]);
    });

    // childrenCount is a nested count, so any non-zero value means a chevron.
    it('derives the chevron from childrenCount', async () => {
      mockGetGlossaryTermChildrenLazy.mockResolvedValue(
        page(
          [
            { name: 'leaf', fullyQualifiedName: 'Filled.leaf' },
            {
              name: 'branch',
              fullyQualifiedName: 'Filled.branch',
              childrenCount: 4,
            },
          ],
          { total: 2 }
        )
      );

      const { nodes } = await expand({ parentId: 'Filled' });

      expect(nodes.map(({ isLeaf }) => isLeaf)).toEqual([true, false]);
    });
  });
});
