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
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TreeSelectNode } from './tree-select.types';
import { useTreeSelectData } from './use-tree-select-data';

const nodes: TreeSelectNode[] = [
  { id: 'a', label: 'a', value: 'a', isLeaf: true },
];

const renderData = (enabled?: boolean) => {
  const fetchData = vi.fn().mockResolvedValue({ nodes });
  const hook = renderHook(
    (props: { enabled?: boolean }) =>
      useTreeSelectData({ fetchData, enabled: props.enabled }),
    { initialProps: { enabled } }
  );

  return { fetchData, ...hook };
};

describe('useTreeSelectData', () => {
  it('fetches the root on mount by default', async () => {
    const { fetchData, result } = renderData();

    await waitFor(() => expect(result.current.treeData).toEqual(nodes));

    expect(fetchData).toHaveBeenCalledTimes(1);
  });

  it('does not fetch while disabled', () => {
    const { fetchData, result } = renderData(false);

    expect(fetchData).not.toHaveBeenCalled();
    expect(result.current.treeData).toEqual([]);
  });

  it('fetches the root once it becomes enabled', async () => {
    const { fetchData, result, rerender } = renderData(false);

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.treeData).toEqual(nodes));

    expect(fetchData).toHaveBeenCalledTimes(1);
    expect(fetchData).toHaveBeenCalledWith(
      expect.objectContaining({ searchTerm: '' })
    );
  });
});
