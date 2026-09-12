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
import { getEntityGraphData } from '../../rest/rdfAPI';
import { GraphData } from '../../rest/rdfAPI.interface';
import { useKnowledgeGraphData } from './useKnowledgeGraphData';

jest.mock('../../rest/rdfAPI', () => ({ getEntityGraphData: jest.fn() }));
const fetchGraph = getEntityGraphData as jest.MockedFunction<
  typeof getEntityGraphData
>;
const query = { entityId: 'root', entityType: 'table', depth: 1 };
const graph: GraphData = {
  nodes: [
    { id: 'root', label: 'Orders', type: 'table' },
    { id: 'owner', label: 'Steward', type: 'user' },
  ],
  edges: [{ from: 'root', to: 'owner', label: 'Has Owner' }],
};
const deferred = () => {
  let resolve!: (data: GraphData) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<GraphData>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });

  return { promise, resolve, reject };
};

describe('useKnowledgeGraphData', () => {
  beforeEach(() => fetchGraph.mockReset());

  it('keeps the full traversal alongside server-filtered results', async () => {
    const filtered = { ...graph, nodes: [graph.nodes[0]], edges: [] };
    fetchGraph.mockImplementation(async (params) =>
      params.entityTypes?.length ? filtered : graph
    );
    const { result } = renderHook(() =>
      useKnowledgeGraphData({ ...query, entityTypes: ['table'] }, 0)
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual(filtered);
    expect(result.current.unfiltered).toEqual(graph);
  });

  it('ignores a stale response even when the transport does not honor cancellation', async () => {
    const old = deferred();
    const latest = deferred();
    fetchGraph
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(latest.promise);
    const { result, rerender } = renderHook(
      ({ depth }) => useKnowledgeGraphData({ ...query, depth }, 0),
      { initialProps: { depth: 1 } }
    );
    rerender({ depth: 2 });
    const extended = { ...graph, truncated: true };
    await act(async () => latest.resolve(extended));
    await act(async () => old.resolve(graph));

    expect(result.current.data).toEqual(extended);
    expect(result.current.appliedQuery?.depth).toBe(2);
    expect(result.current.loading).toBe(false);
  });

  it('retains previous results and export scope after a failed update', async () => {
    const update = deferred();
    fetchGraph.mockResolvedValueOnce(graph).mockReturnValueOnce(update.promise);
    const { result, rerender } = renderHook(
      ({ depth }) => useKnowledgeGraphData({ ...query, depth }, 0),
      { initialProps: { depth: 1 } }
    );
    await waitFor(() => expect(result.current.data).toEqual(graph));
    rerender({ depth: 2 });

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toEqual(graph);

    await act(async () => update.reject(new Error('Unavailable')));

    expect(result.current.error).toEqual(new Error('Unavailable'));
    expect(result.current.data).toEqual(graph);
    expect(result.current.appliedQuery?.depth).toBe(1);
  });

  it('does not show the previous entity while a different entity is loading', async () => {
    fetchGraph
      .mockResolvedValueOnce(graph)
      .mockReturnValueOnce(deferred().promise);
    const { result, rerender } = renderHook(
      ({ entityId }) => useKnowledgeGraphData({ ...query, entityId }, 0),
      { initialProps: { entityId: 'root' } }
    );
    await waitFor(() => expect(result.current.data).toEqual(graph));
    rerender({ entityId: 'different' });

    expect(result.current.data).toBeNull();
    expect(result.current.unfiltered).toBeNull();
    expect(result.current.appliedQuery).toBeUndefined();
  });

  it('reuses only the current unfiltered snapshot when filters change', async () => {
    fetchGraph.mockResolvedValue(graph);
    const { result, rerender } = renderHook(
      ({ entityTypes }) => useKnowledgeGraphData({ ...query, entityTypes }, 0),
      { initialProps: { entityTypes: [] as string[] } }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ entityTypes: ['table'] });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchGraph.mock.calls.map(([params]) => params.entityTypes)).toEqual(
      [undefined, ['table']]
    );
    expect(result.current.unfiltered).toEqual(graph);
  });

  it('refreshes both the layout snapshot and displayed results', async () => {
    fetchGraph
      .mockResolvedValueOnce(graph)
      .mockResolvedValueOnce({ ...graph, truncated: true });
    const { result, rerender } = renderHook(
      ({ refresh }) => useKnowledgeGraphData(query, refresh),
      { initialProps: { refresh: 0 } }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ refresh: 1 });
    await waitFor(() => expect(result.current.data?.truncated).toBe(true));

    expect(result.current.unfiltered?.truncated).toBe(true);
  });

  it('aborts an in-flight transport on unmount', () => {
    fetchGraph.mockReturnValue(deferred().promise);
    const { unmount } = renderHook(() => useKnowledgeGraphData(query, 0));
    const signal = fetchGraph.mock.calls[0][1]?.signal;
    unmount();

    expect(signal?.aborted).toBe(true);
  });
});
