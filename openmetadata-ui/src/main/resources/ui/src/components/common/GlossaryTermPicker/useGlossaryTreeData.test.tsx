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

jest.mock('../../../rest/glossaryAPI', () => ({
  getGlossariesList: (...args: unknown[]) => mockGetGlossariesList(...args),
  queryGlossaryTerms: jest.fn(),
  searchGlossaryTerms: (...args: unknown[]) => mockSearchGlossaryTerms(...args),
}));

jest.mock('./useGlossaryMutualExclusivity', () => ({
  useGlossaryMutualExclusivity: () => ({
    getExclusivity: jest.fn(),
    setExclusivity: jest.fn(),
  }),
}));

const fetchRoots = async (rootIsValue?: boolean, rootCascades?: boolean) => {
  const { result } = renderHook(() =>
    useGlossaryTreeData(rootIsValue, rootCascades)
  );

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

  // A glossary is never a term, so ticking an empty one would select nothing.
  it('marks a glossary with no terms unselectable', async () => {
    const { nodes } = await fetchRoots();

    expect(nodes.map(({ allowSelection }) => allowSelection)).toEqual([
      false,
      true,
      true,
    ]);
  });

  // Single-select has no cascade, so a click on a glossary could only clear the pick.
  it('marks every glossary unselectable when a single-select picks terms', async () => {
    const { nodes } = await fetchRoots(false, false);

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
    const { result } = renderHook(() => useGlossaryTreeData(false, false));

    const { nodes } = await result.current({ searchTerm: 'fi' });

    expect(nodes[0].allowSelection).toBe(false);
  });

  // ChangeParent picks the glossary itself, so an empty one is still a target.
  it('keeps every glossary selectable when glossaries are the value', async () => {
    const { nodes } = await fetchRoots(true);

    expect(nodes.every(({ allowSelection }) => allowSelection)).toBe(true);
  });
});
