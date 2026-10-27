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
import { act, renderHook, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { NativeOntologyDataGraphPage } from '../../../generated/api/data/nativeOntologyDataGraphPage';
import { getNativeOntologyDataGraphPage } from '../../../rest/ontologyAPI';
import {
  pageFixture,
  prefixFixture,
} from '../../../utils/governance/ontology/OntologyNativeDataGraph.mock';
import { useNativeOntologyDataGraph } from './useNativeOntologyDataGraph';

jest.mock('../../../rest/ontologyAPI', () => ({
  getNativeOntologyDataGraphPage: jest.fn(),
}));

const fetchPage = getNativeOntologyDataGraphPage as jest.MockedFunction<
  typeof getNativeOntologyDataGraphPage
>;
const FIRST_CLUSTERS_REQUEST = {
  loaded: [],
  page: { kind: 'clusters', limit: 12, offset: 0 },
};
const LOADED = [prefixFixture('transfer', 'a2'), prefixFixture('account')];

const rejection = (status: number) =>
  new AxiosError('failed', String(status), undefined, undefined, {
    status,
    statusText: '',
    data: {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

const clustersPage = (
  overrides: Parameters<typeof pageFixture>[0] = {}
): NativeOntologyDataGraphPage =>
  pageFixture({
    clusters: [
      {
        id: 'transfer',
        name: 'Funds Transfer',
        count: 150,
        after: 'cursor-2',
        assets: [
          { id: 'a1', name: 'transfers', serviceType: 'Snowflake' },
          { id: 'a2', name: 'payments', serviceType: 'BigQuery' },
        ],
      },
      {
        id: 'account',
        name: 'Account',
        count: 1,
        assets: [{ id: 'a3', name: 'accounts', serviceType: 'Mysql' }],
      },
    ],
    loaded: LOADED,
    ...overrides,
  });

const requests = () => fetchPage.mock.calls.map(([, request]) => request);
const kinds = () => requests().map((request) => request.page.kind);
const settle = () =>
  act(async () => {
    for (let turn = 0; turn < 50; turn++) {
      await Promise.resolve();
    }
  });

const render = (ontologyId = 'ontology-1') =>
  renderHook(({ id }) => useNativeOntologyDataGraph(id), {
    initialProps: { id: ontologyId },
  });

beforeEach(() => {
  fetchPage.mockReset();
});

describe('first load', () => {
  it('asks for the first clusters page, then follows every topology cursor with the returned context', async () => {
    fetchPage
      .mockResolvedValueOnce(
        clustersPage({
          topologyAfter: 'topology-1',
          conceptEdges: [{ from: 'transfer', to: 'account', label: 'part of' }],
        })
      )
      .mockResolvedValueOnce(
        pageFixture({
          loaded: LOADED,
          topologyAfter: 'topology-2',
          lineageEdges: [{ from: 'a1', to: 'a3' }],
        })
      )
      .mockResolvedValueOnce(pageFixture({ loaded: LOADED }));
    const { result } = render();

    await waitFor(() =>
      expect(result.current.graph.topology.lineageEdges).toHaveLength(1)
    );

    expect(requests()).toEqual([
      FIRST_CLUSTERS_REQUEST,
      { loaded: LOADED, page: { kind: 'topology', after: 'topology-1' } },
      { loaded: LOADED, page: { kind: 'topology', after: 'topology-2' } },
    ]);
    expect(result.current.graph.topology.conceptEdges).toHaveLength(1);
    expect(result.current.graph.clusters.map((c) => c.assetCount)).toEqual([
      150, 1,
    ]);
    expect(result.current.failure).toBeUndefined();
  });

  it('keeps the edges it showed before until the replacement topology ends', async () => {
    let finish!: (page: NativeOntologyDataGraphPage) => void;
    fetchPage
      .mockResolvedValueOnce(
        clustersPage({
          topologyAfter: 'topology-1',
          conceptEdges: [{ from: 'transfer', to: 'account', label: 'part of' }],
        })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          })
      );
    const { result } = render();

    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));

    expect(result.current.graph.clusters).toHaveLength(2);
    expect(result.current.graph.topology.conceptEdges).toEqual([]);

    await act(async () => finish(pageFixture({ loaded: LOADED })));

    expect(result.current.graph.topology.conceptEdges).toHaveLength(1);
  });
});

describe('paging', () => {
  it('requests more clusters at the advertised offset and never past a full context', async () => {
    fetchPage
      .mockResolvedValueOnce(clustersPage({ nextClusterOffset: 12 }))
      .mockResolvedValueOnce(
        pageFixture({
          clusters: [
            {
              id: 'ledger',
              name: 'Ledger',
              count: 3,
              assets: [{ id: 'a7', name: 'ledger' }],
            },
          ],
          loaded: [...LOADED, prefixFixture('ledger', 'a7')],
          contextFull: true,
        })
      );
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.loadMoreClusters());
    await waitFor(() => expect(result.current.graph.clusters).toHaveLength(3));

    expect(requests()[1]).toEqual({
      loaded: LOADED,
      page: { kind: 'clusters', limit: 12, offset: 12 },
    });
    expect(result.current.graph.contextFull).toBe(true);

    act(() => result.current.loadMoreClusters());
    await settle();

    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('loads the next assets of one concept from its cursor', async () => {
    fetchPage.mockResolvedValueOnce(clustersPage()).mockResolvedValueOnce(
      pageFixture({
        bindings: {
          assets: [
            { id: 'a4', name: 'ledger', serviceType: 'Snowflake', columns: 2 },
          ],
          after: 'cursor-3',
        },
        loaded: [prefixFixture('transfer', 'a4'), prefixFixture('account')],
      })
    );
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.loadMoreAssets('transfer'));

    await waitFor(() =>
      expect(result.current.graph.clusters[0].assets).toHaveLength(3)
    );

    expect(requests()[1]).toEqual({
      loaded: LOADED,
      page: {
        kind: 'bindings',
        conceptId: 'transfer',
        after: 'cursor-2',
        limit: 25,
      },
    });
    expect(result.current.graph.clusters[0].after).toBe('cursor-3');
    expect(result.current.loadingConceptIds.size).toBe(0);
  });

  it('follows a non-null cursor past an empty page until a visible asset arrives', async () => {
    fetchPage
      .mockResolvedValueOnce(clustersPage())
      .mockResolvedValueOnce(
        pageFixture({
          bindings: { assets: [], after: 'cursor-hidden' },
          loaded: [
            prefixFixture('transfer', 'hidden-tail'),
            prefixFixture('account'),
          ],
          topologyAfter: 'must-not-be-followed',
        })
      )
      .mockResolvedValueOnce(
        pageFixture({
          bindings: { assets: [{ id: 'a8', name: 'visible_after_gap' }] },
          loaded: [prefixFixture('transfer', 'a8'), prefixFixture('account')],
        })
      );
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.loadMoreAssets('transfer'));

    await waitFor(() =>
      expect(
        result.current.graph.clusters[0].assets.map((asset) => asset.id)
      ).toEqual(['a1', 'a2', 'a8'])
    );

    expect(kinds()).toEqual(['clusters', 'bindings', 'bindings']);
    expect(requests()[2]).toEqual({
      loaded: [
        prefixFixture('transfer', 'hidden-tail'),
        prefixFixture('account'),
      ],
      page: {
        kind: 'bindings',
        conceptId: 'transfer',
        after: 'cursor-hidden',
        limit: 25,
      },
    });
    expect(result.current.graph.clusters[0].after).toBeUndefined();
  });

  it('stops following cursors when the server repeats one', async () => {
    fetchPage.mockResolvedValueOnce(clustersPage()).mockResolvedValue(
      pageFixture({
        bindings: { assets: [], after: 'cursor-2' },
        loaded: LOADED,
      })
    );
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.loadMoreAssets('transfer'));
    await settle();

    expect(kinds()).toEqual(['clusters', 'bindings']);
  });
});

describe('a topology continuation that the server refuses with 400', () => {
  const firstAttempt = () =>
    clustersPage({
      topologyAfter: 'topology-1',
      conceptEdges: [{ from: 'transfer', to: 'account', label: 'part of' }],
    });

  it('restarts the topology once from the first page and recovers', async () => {
    fetchPage
      .mockResolvedValueOnce(firstAttempt())
      .mockRejectedValueOnce(rejection(400))
      .mockResolvedValueOnce(firstAttempt())
      .mockResolvedValueOnce(pageFixture({ loaded: LOADED }));
    const { result } = render();

    await waitFor(() =>
      expect(result.current.graph.topology.conceptEdges).toHaveLength(1)
    );

    expect(kinds()).toEqual(['clusters', 'topology', 'clusters', 'topology']);
    expect(requests()[2]).toEqual(requests()[0]);
    expect(result.current.failure).toBeUndefined();
    expect(result.current.graph.clusters).toHaveLength(2);
  });

  it('shows the error after a second refusal and sends no third attempt', async () => {
    fetchPage
      .mockResolvedValueOnce(firstAttempt())
      .mockRejectedValueOnce(rejection(400))
      .mockResolvedValueOnce(firstAttempt())
      .mockRejectedValueOnce(rejection(400));
    const { result } = render();

    await waitFor(() => expect(result.current.failure).toBeDefined());
    await settle();

    expect(kinds()).toEqual(['clusters', 'topology', 'clusters', 'topology']);
    expect(result.current.failure).toEqual({
      reason: 'invalid',
      retry: { kind: 'reload' },
    });
    expect(result.current.graph.topology.conceptEdges).toEqual([]);
    expect(result.current.graph.clusters).toHaveLength(2);
  });

  it('gives a retry the user starts a fresh generation with its own restart', async () => {
    fetchPage
      .mockResolvedValueOnce(firstAttempt())
      .mockRejectedValueOnce(rejection(400))
      .mockResolvedValueOnce(firstAttempt())
      .mockRejectedValueOnce(rejection(400))
      .mockResolvedValueOnce(firstAttempt())
      .mockRejectedValueOnce(rejection(400))
      .mockResolvedValueOnce(firstAttempt())
      .mockResolvedValueOnce(pageFixture({ loaded: LOADED }));
    const { result } = render();
    await waitFor(() => expect(result.current.failure).toBeDefined());

    act(() => result.current.retry());

    await waitFor(() =>
      expect(result.current.graph.topology.conceptEdges).toHaveLength(1)
    );

    expect(fetchPage).toHaveBeenCalledTimes(8);
    expect(requests()[4]).toEqual(FIRST_CLUSTERS_REQUEST);
    expect(result.current.failure).toBeUndefined();
  });

  it('does not restart a refusal of the first selection itself', async () => {
    fetchPage.mockRejectedValueOnce(rejection(400));
    const { result } = render();

    await waitFor(() => expect(result.current.failure).toBeDefined());
    await settle();

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result.current.failure?.reason).toBe('invalid');
  });
});

describe('a loaded context that the server calls stale with 412', () => {
  it('reloads from the first clusters page once and recovers', async () => {
    fetchPage
      .mockResolvedValueOnce(clustersPage())
      .mockRejectedValueOnce(rejection(412))
      .mockResolvedValueOnce(
        clustersPage({
          clusters: [
            {
              id: 'fresh',
              name: 'Fresh',
              count: 2,
              assets: [{ id: 'f1', name: 'fresh_table' }],
            },
          ],
          loaded: [prefixFixture('fresh', 'f1')],
        })
      );
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.loadMoreAssets('transfer'));

    await waitFor(() =>
      expect(result.current.graph.clusters.map((c) => c.concept.id)).toEqual([
        'fresh',
      ])
    );

    expect(requests()[2]).toEqual(FIRST_CLUSTERS_REQUEST);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(result.current.failure).toBeUndefined();
  });

  it('shows the error when the reload is stale too and sends nothing after it', async () => {
    fetchPage
      .mockResolvedValueOnce(clustersPage())
      .mockRejectedValueOnce(rejection(412))
      .mockRejectedValueOnce(rejection(412));
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.loadMoreAssets('transfer'));
    await waitFor(() => expect(result.current.failure).toBeDefined());
    await settle();

    expect(kinds()).toEqual(['clusters', 'bindings', 'clusters']);
    expect(result.current.failure).toEqual({
      reason: 'stale',
      retry: { kind: 'reload' },
    });
    expect(result.current.loadingConceptIds.size).toBe(0);
  });

  it('allows another reload once a reload has succeeded', async () => {
    fetchPage
      .mockResolvedValueOnce(clustersPage())
      .mockRejectedValueOnce(rejection(412))
      .mockResolvedValueOnce(clustersPage())
      .mockRejectedValueOnce(rejection(412))
      .mockResolvedValueOnce(clustersPage());
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.loadMoreAssets('transfer'));
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(3));
    await settle();
    act(() => result.current.loadMoreAssets('transfer'));
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(5));
    await settle();

    expect(result.current.failure).toBeUndefined();
  });
});

describe('a failed asset page', () => {
  it('offers a retry of the same page and keeps what was loaded', async () => {
    fetchPage
      .mockResolvedValueOnce(clustersPage())
      .mockRejectedValueOnce(rejection(500))
      .mockResolvedValueOnce(
        pageFixture({
          bindings: { assets: [{ id: 'a5', name: 'more' }] },
          loaded: LOADED,
        })
      );
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.loadMoreAssets('transfer'));
    await waitFor(() => expect(result.current.failure).toBeDefined());

    expect(result.current.failure).toEqual({
      reason: 'other',
      retry: { kind: 'assets', conceptId: 'transfer' },
    });
    expect(result.current.graph.clusters[0].assets).toHaveLength(2);

    act(() => result.current.retry());
    await waitFor(() =>
      expect(result.current.graph.clusters[0].assets).toHaveLength(3)
    );

    expect(result.current.failure).toBeUndefined();
    expect(kinds()).toEqual(['clusters', 'bindings', 'bindings']);
  });
});

describe('changing the ontology', () => {
  it('starts a new generation and ignores the answer to the old one', async () => {
    let answerOld!: (page: NativeOntologyDataGraphPage) => void;
    fetchPage
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            answerOld = resolve;
          })
      )
      .mockResolvedValueOnce(
        clustersPage({
          clusters: [
            {
              id: 'other',
              name: 'Other',
              count: 1,
              assets: [{ id: 'o1', name: 'other_table' }],
            },
          ],
          loaded: [prefixFixture('other', 'o1')],
        })
      );
    const { result, rerender } = render('ontology-1');
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));

    rerender({ id: 'ontology-2' });
    await waitFor(() =>
      expect(result.current.graph.clusters.map((c) => c.concept.id)).toEqual([
        'other',
      ])
    );
    await act(async () => answerOld(clustersPage()));

    expect(fetchPage.mock.calls.map(([id]) => id)).toEqual([
      'ontology-1',
      'ontology-2',
    ]);
    expect(result.current.graph.clusters.map((c) => c.concept.id)).toEqual([
      'other',
    ]);
  });
});
