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
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TreeSelectNode } from './tree-select.types';
import { useTreeSelectData } from './use-tree-select-data';

const root: TreeSelectNode[] = [
  {
    id: 'empty-glossary',
    label: 'Taxation',
    value: 'Taxation',
    // Declared expandable: the count is unknown until the children load.
    isLeaf: false,
    lazyLoad: true,
  },
];

describe('useTreeSelectData', () => {
  it('should keep a lazy node expandable when its children come back empty', async () => {
    const fetchData = vi
      .fn()
      .mockImplementation(async ({ parentId }: { parentId?: string }) => ({
        nodes: parentId ? [] : root,
      }));

    const { result } = renderHook(() => useTreeSelectData({ fetchData }));

    await waitFor(() => expect(result.current.treeData).toHaveLength(1));

    await act(async () => {
      await result.current.loadChildren('empty-glossary');
    });

    const node = result.current.treeData[0];

    expect(node.children).toEqual([]);
    // Flipping this to true would drop the chevron and strand the node open.
    expect(node.isLeaf).toBe(false);
  });

  it('should mark a lazy node non-leaf once it has children', async () => {
    const child: TreeSelectNode = {
      id: 'term',
      label: 'Term',
      value: 'Term',
    };
    const fetchData = vi
      .fn()
      .mockImplementation(async ({ parentId }: { parentId?: string }) => ({
        nodes: parentId ? [child] : root,
      }));

    const { result } = renderHook(() => useTreeSelectData({ fetchData }));

    await waitFor(() => expect(result.current.treeData).toHaveLength(1));

    await act(async () => {
      await result.current.loadChildren('empty-glossary');
    });

    expect(result.current.treeData[0].children).toEqual([child]);
    expect(result.current.treeData[0].isLeaf).toBe(false);
  });
});
