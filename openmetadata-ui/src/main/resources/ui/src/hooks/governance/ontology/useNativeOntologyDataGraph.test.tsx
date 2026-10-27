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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { ReactNode } from 'react';
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

type HookOptions = Parameters<typeof useNativeOntologyDataGraph>[1];

let queryClient: QueryClient;

const Providers = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const render = (ontologyId = 'ontology-1', options?: HookOptions) =>
  renderHook(
    ({ id, hookOptions }) => useNativeOntologyDataGraph(id, hookOptions),
    {
      initialProps: { id: ontologyId, hookOptions: options },
      wrapper: Providers,
    }
  );

const writeBinding = (kind: 'confirmed' | 'not-ready') =>
  act(async () => {
    await queryClient
      .getMutationCache()
      .build(queryClient, {
        mutationKey: ['ontology-concept-bindings-write', 'transfer'],
        mutationFn: async () => ({ kind }),
      })
      .execute(undefined);
  });

beforeEach(() => {
  fetchPage.mockReset();
  queryClient = new QueryClient();
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

describe('an empty clusters page that advertises more clusters', () => {
  const emptyPage = (offset?: number, isLast = false) =>
    pageFixture({
      clusters: [],
      loaded: [],
      nextClusterOffset: offset,
      topologyAfter: isLast ? undefined : 'must-not-be-followed',
    });
  const clustersAt = (offset: number) => ({
    loaded: [],
    page: { kind: 'clusters', limit: 12, offset },
  });

  it('keeps asking for the advertised offset and never shows an empty graph meanwhile', async () => {
    let answerSecond!: (page: NativeOntologyDataGraphPage) => void;
    fetchPage.mockResolvedValueOnce(emptyPage(12)).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answerSecond = resolve;
        })
    );
    const { result } = render();
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.graph.clusters).toEqual([]);

    await act(async () => answerSecond(clustersPage()));

    expect(requests()).toEqual([FIRST_CLUSTERS_REQUEST, clustersAt(12)]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.graph.clusters).toHaveLength(2);
  });

  it('follows a run of two empty pages to the first visible cluster', async () => {
    fetchPage
      .mockResolvedValueOnce(emptyPage(12))
      .mockResolvedValueOnce(emptyPage(24))
      .mockResolvedValueOnce(clustersPage());
    const { result } = render();

    await waitFor(() => expect(result.current.graph.clusters).toHaveLength(2));

    expect(requests()).toEqual([
      FIRST_CLUSTERS_REQUEST,
      clustersAt(12),
      clustersAt(24),
    ]);
  });

  it('stops when the server repeats an offset', async () => {
    fetchPage
      .mockResolvedValueOnce(emptyPage(12))
      .mockResolvedValueOnce(emptyPage(12, true));
    const { result } = render();
    await settle();

    expect(requests()).toEqual([FIRST_CLUSTERS_REQUEST, clustersAt(12)]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.failure).toBeUndefined();
  });

  it('stops when the offset is gone', async () => {
    fetchPage
      .mockResolvedValueOnce(emptyPage(12))
      .mockResolvedValueOnce(emptyPage(undefined, true));
    const { result } = render();
    await settle();

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(result.current.isLoading).toBe(false);
  });

  it('stops at a full context even when a stray offset comes with it', async () => {
    fetchPage.mockResolvedValue(
      pageFixture({
        clusters: [],
        contextFull: true,
        loaded: [],
        nextClusterOffset: 12,
      })
    );
    const { result } = render();
    await settle();

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result.current.isLoading).toBe(false);
  });
});

describe('a full context', () => {
  it('sends no cluster request even when a stray offset comes with it', async () => {
    fetchPage.mockResolvedValueOnce(
      clustersPage({ contextFull: true, nextClusterOffset: 12 })
    );
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.loadMoreClusters());
    await settle();

    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});

describe('a graph that the model or the bindings made stale', () => {
  const changedClusters = () =>
    clustersPage({
      clusters: [
        {
          id: 'transfer',
          name: 'Funds Transfer',
          count: 151,
          after: 'cursor-9',
          assets: [{ id: 'a1', name: 'transfers', serviceType: 'Snowflake' }],
        },
      ],
      loaded: [prefixFixture('transfer', 'a1')],
    });

  it('reloads from the first page when the revision changes, keeping the old graph until it arrives', async () => {
    let answerReload!: (page: NativeOntologyDataGraphPage) => void;
    fetchPage.mockResolvedValueOnce(clustersPage()).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answerReload = resolve;
        })
    );
    const { result, rerender } = render('ontology-1', {
      isActive: true,
      revision: 0,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({
      id: 'ontology-1',
      hookOptions: { isActive: true, revision: 1 },
    });
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));

    expect(requests()[1]).toEqual(FIRST_CLUSTERS_REQUEST);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.graph.clusters).toHaveLength(2);

    await act(async () => answerReload(changedClusters()));

    expect(result.current.isLoading).toBe(false);
    expect(
      result.current.graph.clusters.map((c) => [c.concept.id, c.assetCount])
    ).toEqual([['transfer', 151]]);
  });

  it('costs one reload for ten edits made while the surface is hidden', async () => {
    fetchPage.mockResolvedValue(clustersPage());
    const { result, rerender } = render('ontology-1', {
      isActive: true,
      revision: 0,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    for (let revision = 1; revision <= 10; revision++) {
      rerender({
        id: 'ontology-1',
        hookOptions: { isActive: false, revision },
      });
    }
    await settle();

    expect(fetchPage).toHaveBeenCalledTimes(1);

    rerender({
      id: 'ontology-1',
      hookOptions: { isActive: true, revision: 10 },
    });
    await settle();

    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('reloads after a binding write succeeds, and not after one that did not run', async () => {
    fetchPage
      .mockResolvedValueOnce(clustersPage())
      .mockResolvedValueOnce(changedClusters());
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await writeBinding('not-ready');
    await settle();

    expect(fetchPage).toHaveBeenCalledTimes(1);

    await writeBinding('confirmed');
    await waitFor(() =>
      expect(result.current.graph.clusters.map((c) => c.assetCount)).toEqual([
        151,
      ])
    );

    expect(requests()[1]).toEqual(FIRST_CLUSTERS_REQUEST);
  });
});

describe('leaving the page', () => {
  it('aborts the requests of a generation that a retry started', async () => {
    fetchPage
      .mockRejectedValueOnce(rejection(500))
      .mockImplementationOnce(() => new Promise(() => undefined));
    const { result, unmount } = render();
    await waitFor(() => expect(result.current.failure).toBeDefined());

    act(() => result.current.retry());
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    const retrySignal = fetchPage.mock.calls[1][2] as AbortSignal;

    expect(retrySignal.aborted).toBe(false);

    unmount();

    expect(retrySignal.aborted).toBe(true);
  });
});
