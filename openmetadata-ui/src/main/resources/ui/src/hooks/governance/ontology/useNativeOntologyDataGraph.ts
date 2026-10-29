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
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NativeOntologyDataGraphPage } from '../../../generated/api/data/nativeOntologyDataGraphPage';
import { NativeOntologyDataGraphPageRequest } from '../../../generated/api/data/nativeOntologyDataGraphPageRequest';
import { getNativeOntologyDataGraphPage } from '../../../rest/ontologyAPI';
import {
  applyBindingsPage,
  applyClustersPage,
  bindingsRequest,
  classifyPageFailure,
  clustersRequest,
  EMPTY_NATIVE_DATA_GRAPH,
  EMPTY_NATIVE_TOPOLOGY,
  NativeDataGraph,
  PageFailure,
  stageTopologyPage,
  topologyRequest,
} from '../../../utils/governance/ontology/OntologyNativeDataGraph.utils';
import { subscribeToConceptBindingWrites } from './useOntologyConceptBindings';

export type NativeDataGraphRetry =
  | { kind: 'reload' }
  | { kind: 'clusters' }
  | { kind: 'assets'; conceptId: string };

export interface NativeDataGraphFailure {
  reason: PageFailure;
  retry: NativeDataGraphRetry;
}

export interface NativeDataGraphOptions {
  /** A hidden surface sends nothing, so edits made meanwhile cost one reload when it shows. */
  isActive?: boolean;
  /** Bumped by the owner whenever the model the graph projects changes. */
  revision?: number;
}

export interface NativeDataGraphView {
  graph: NativeDataGraph;
  isLoading: boolean;
  isLoadingClusters: boolean;
  loadingConceptIds: ReadonlySet<string>;
  failure?: NativeDataGraphFailure;
}

type Apply = (
  graph: NativeDataGraph,
  page: NativeOntologyDataGraphPage
) => NativeDataGraph;

type Read =
  | { ok: true; page: NativeOntologyDataGraphPage }
  | { ok: false; reason: PageFailure };

type Settled = 'ok' | 'continue' | 'failed' | 'cancelled';

type Attempt = { done: Settled } | { again: SelectionPlan };

interface Generation {
  controller: AbortController;
  hasRestartedTopology: boolean;
  staleReloads: number;
}

interface SelectionPlan {
  request: NativeOntologyDataGraphPageRequest;
  apply: Apply;
  readFailureRetry: NativeDataGraphRetry;
  continuesPast?: (page: NativeOntologyDataGraphPage) => boolean;
  followedBy?: (page: NativeOntologyDataGraphPage) => SelectionPlan | undefined;
}

const RELOAD: NativeDataGraphRetry = { kind: 'reload' };
const CLUSTERS: NativeDataGraphRetry = { kind: 'clusters' };

const hasEmptyClustersTail = (page: NativeOntologyDataGraphPage) =>
  (page.clusters ?? []).length === 0 &&
  page.nextClusterOffset !== undefined &&
  !page.contextFull;

// The server drops a cluster the caller cannot view but still advertises the
// next offset, so an empty page is not the end while the offset moves forward.
const clustersPlan = (
  loaded: NativeOntologyDataGraphPageRequest['loaded'],
  offset: number,
  readFailureRetry: NativeDataGraphRetry,
  apply: Apply = applyClustersPage
): SelectionPlan => ({
  request: clustersRequest(loaded, offset),
  apply,
  readFailureRetry,
  followedBy: (page) =>
    hasEmptyClustersTail(page) && (page.nextClusterOffset ?? 0) > offset
      ? clustersPlan(page.loaded, page.nextClusterOffset ?? 0, CLUSTERS)
      : undefined,
});

const replaceClusters: Apply = (graph, page) =>
  applyClustersPage(
    { ...EMPTY_NATIVE_DATA_GRAPH, topology: graph.topology },
    page
  );

const reloadPlan = (): SelectionPlan =>
  clustersPlan([], 0, RELOAD, replaceClusters);

const newGeneration = (): Generation => ({
  controller: new AbortController(),
  hasRestartedTopology: false,
  staleReloads: 0,
});

const findCluster = (graph: NativeDataGraph, conceptId: string) =>
  graph.clusters.find((item) => item.concept.id === conceptId);

const hasEmptyBindingsTail = (page: NativeOntologyDataGraphPage) =>
  Boolean(page.bindings?.after) && page.bindings?.assets.length === 0;

/**
 * Loads the native Data mode graph one page at a time and keeps the loaded
 * context the server needs on every request. Requests run one at a time,
 * because each response replaces the context the next request must carry.
 */
export const useNativeOntologyDataGraph = (
  ontologyId: string,
  { isActive = true, revision = 0 }: NativeDataGraphOptions = {}
) => {
  const client = useQueryClient();
  const [bindingWrites, setBindingWrites] = useState(0);
  const staleKey = `${revision}:${bindingWrites}`;
  const staleKeyRef = useRef(staleKey);
  staleKeyRef.current = staleKey;
  const loadedKeyRef = useRef(staleKey);
  const graphRef = useRef<NativeDataGraph>(EMPTY_NATIVE_DATA_GRAPH);
  const isLoadingRef = useRef(true);
  const isLoadingClustersRef = useRef(false);
  const loadingConceptIdsRef = useRef<ReadonlySet<string>>(new Set());
  const pagedConceptIdsRef = useRef(new Set<string>());
  const failureRef = useRef<NativeDataGraphFailure>();
  const generationRef = useRef<Generation>(newGeneration());
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const [view, setView] = useState<NativeDataGraphView>({
    graph: EMPTY_NATIVE_DATA_GRAPH,
    isLoading: true,
    isLoadingClusters: false,
    loadingConceptIds: loadingConceptIdsRef.current,
  });

  const publish = useCallback(
    () =>
      setView({
        graph: graphRef.current,
        isLoading: isLoadingRef.current,
        isLoadingClusters: isLoadingClustersRef.current,
        loadingConceptIds: loadingConceptIdsRef.current,
        failure: failureRef.current,
      }),
    []
  );

  const isCurrent = useCallback(
    (generation: Generation) => generationRef.current === generation,
    []
  );

  const read = useCallback(
    async (
      generation: Generation,
      request: NativeOntologyDataGraphPageRequest
    ): Promise<Read> => {
      try {
        const page = await getNativeOntologyDataGraphPage(
          ontologyId,
          request,
          generation.controller.signal
        );

        return { ok: true, page };
      } catch (error) {
        return { ok: false, reason: classifyPageFailure(error) };
      }
    },
    [ontologyId]
  );

  const drainTopology = useCallback(
    async (
      generation: Generation,
      page: NativeOntologyDataGraphPage
    ): Promise<PageFailure | 'done' | 'cancelled'> => {
      let staged = stageTopologyPage(EMPTY_NATIVE_TOPOLOGY, page.topology);
      let after = page.topology.after;
      while (after) {
        const next = await read(
          generation,
          topologyRequest(page.loaded, after)
        );
        if (!isCurrent(generation)) {
          return 'cancelled';
        }
        if (!next.ok) {
          return next.reason;
        }
        staged = stageTopologyPage(staged, next.page.topology);
        after = next.page.topology.after;
      }
      graphRef.current = { ...graphRef.current, topology: staged };

      return 'done';
    },
    [isCurrent, read]
  );

  const fail = useCallback(
    (reason: PageFailure, retry: NativeDataGraphRetry): Settled => {
      isLoadingRef.current = false;
      failureRef.current = { reason, retry };
      publish();

      return 'failed';
    },
    [publish]
  );

  const failAttempt = useCallback(
    (
      generation: Generation,
      reason: PageFailure,
      retry: NativeDataGraphRetry
    ): Attempt => {
      if (reason !== 'stale') {
        return { done: fail(reason, retry) };
      }
      if (generation.staleReloads >= 1) {
        return { done: fail(reason, RELOAD) };
      }
      generation.staleReloads += 1;
      isLoadingRef.current = true;
      publish();

      return { again: reloadPlan() };
    },
    [fail, publish]
  );

  const attempt = useCallback(
    async (generation: Generation, plan: SelectionPlan): Promise<Attempt> => {
      const first = await read(generation, plan.request);
      if (!isCurrent(generation)) {
        return { done: 'cancelled' };
      }
      if (!first.ok) {
        return failAttempt(generation, first.reason, plan.readFailureRetry);
      }
      graphRef.current = plan.apply(graphRef.current, first.page);
      const followed = plan.followedBy?.(first.page);
      isLoadingRef.current = isLoadingRef.current && Boolean(followed);
      publish();
      if (followed) {
        return { again: followed };
      }
      if (plan.continuesPast?.(first.page)) {
        return { done: 'continue' };
      }
      const drained = await drainTopology(generation, first.page);
      if (drained === 'cancelled') {
        return { done: 'cancelled' };
      }
      if (drained === 'done') {
        generation.staleReloads = 0;
        publish();

        return { done: 'ok' };
      }
      if (drained === 'invalid' && !generation.hasRestartedTopology) {
        generation.hasRestartedTopology = true;

        return { again: plan };
      }

      return failAttempt(generation, drained, RELOAD);
    },
    [drainTopology, failAttempt, isCurrent, publish, read]
  );

  const runSelection = useCallback(
    async (generation: Generation, initialPlan: SelectionPlan) => {
      let next: Attempt = { again: initialPlan };
      while ('again' in next) {
        next = await attempt(generation, next.again);
      }

      return next.done;
    },
    [attempt]
  );

  const runMoreAssets = useCallback(
    async (generation: Generation, conceptId: string) => {
      const markLoading = (isLoading: boolean) => {
        const ids = new Set(loadingConceptIdsRef.current);
        if (isLoading) {
          ids.add(conceptId);
        } else {
          ids.delete(conceptId);
        }
        loadingConceptIdsRef.current = ids;
        publish();
      };
      markLoading(true);
      pagedConceptIdsRef.current.add(conceptId);
      let previousCursor: string | undefined;
      try {
        for (;;) {
          const cluster = findCluster(graphRef.current, conceptId);
          if (!cluster?.after || cluster.after === previousCursor) {
            return;
          }
          previousCursor = cluster.after;
          const settled = await runSelection(generation, {
            request: bindingsRequest(
              graphRef.current.loaded,
              conceptId,
              cluster.after
            ),
            apply: (graph, page) => applyBindingsPage(graph, conceptId, page),
            readFailureRetry: { kind: 'assets', conceptId },
            continuesPast: hasEmptyBindingsTail,
          });
          if (settled !== 'continue') {
            return;
          }
        }
      } finally {
        markLoading(false);
      }
    },
    [publish, runSelection]
  );

  const runMoreClusters = useCallback(
    async (generation: Generation) => {
      const { nextClusterOffset, contextFull, loaded } = graphRef.current;
      if (nextClusterOffset === undefined || contextFull) {
        return;
      }
      isLoadingClustersRef.current = true;
      publish();
      try {
        await runSelection(
          generation,
          clustersPlan(loaded, nextClusterOffset, CLUSTERS)
        );
      } finally {
        isLoadingClustersRef.current = false;
        publish();
      }
    },
    [publish, runSelection]
  );

  const enqueue = useCallback(
    (generation: Generation, task: () => Promise<void>) => {
      queueRef.current = queueRef.current.then(async () => {
        if (!isCurrent(generation)) {
          return;
        }
        try {
          await task();
        } catch {
          if (isCurrent(generation)) {
            fail('other', RELOAD);
          }
        }
      });
    },
    [fail, isCurrent]
  );

  const beginGeneration = useCallback(() => {
    generationRef.current.controller.abort();
    const generation = newGeneration();
    generationRef.current = generation;
    queueRef.current = Promise.resolve();

    return generation;
  }, []);

  const restoreRows = useCallback(
    async (generation: Generation, conceptId: string, rowCount: number) => {
      for (;;) {
        const before = findCluster(graphRef.current, conceptId);
        if (
          !isCurrent(generation) ||
          failureRef.current ||
          !before?.after ||
          before.assets.length >= rowCount
        ) {
          return;
        }
        await runMoreAssets(generation, conceptId);
        const after = findCluster(graphRef.current, conceptId);
        if ((after?.assets.length ?? 0) <= before.assets.length) {
          return;
        }
      }
    },
    [isCurrent, runMoreAssets]
  );

  const reload = useCallback(
    (generation: Generation, keepGraph = false) =>
      enqueue(generation, async () => {
        const pagedRowCounts = keepGraph
          ? graphRef.current.clusters
              .filter((item) => pagedConceptIdsRef.current.has(item.concept.id))
              .map((item) => [item.concept.id, item.assets.length] as const)
          : [];
        pagedConceptIdsRef.current = new Set();
        if (!keepGraph) {
          graphRef.current = EMPTY_NATIVE_DATA_GRAPH;
        }
        isLoadingRef.current = true;
        loadingConceptIdsRef.current = new Set();
        isLoadingClustersRef.current = false;
        publish();
        if ((await runSelection(generation, reloadPlan())) !== 'ok') {
          return;
        }
        for (const [conceptId, rowCount] of pagedRowCounts) {
          await restoreRows(generation, conceptId, rowCount);
        }
      }),
    [enqueue, publish, restoreRows, runSelection]
  );

  useEffect(() => {
    failureRef.current = undefined;
    graphRef.current = EMPTY_NATIVE_DATA_GRAPH;
    isLoadingRef.current = true;
    loadedKeyRef.current = staleKeyRef.current;
    reload(beginGeneration());

    return () => {
      generationRef.current.controller.abort();
      const dead = newGeneration();
      dead.controller.abort();
      generationRef.current = dead;
    };
  }, [beginGeneration, reload]);

  useEffect(
    () =>
      subscribeToConceptBindingWrites(client, () =>
        setBindingWrites((count) => count + 1)
      ),
    [client]
  );

  useEffect(() => {
    if (!isActive || loadedKeyRef.current === staleKey) {
      return;
    }
    loadedKeyRef.current = staleKey;
    failureRef.current = undefined;
    reload(beginGeneration(), true);
  }, [beginGeneration, isActive, reload, staleKey]);

  const loadMoreClusters = useCallback(() => {
    const generation = generationRef.current;
    enqueue(generation, () => runMoreClusters(generation));
  }, [enqueue, runMoreClusters]);

  const loadMoreAssets = useCallback(
    (conceptId: string) => {
      if (loadingConceptIdsRef.current.has(conceptId)) {
        return;
      }
      const generation = generationRef.current;
      enqueue(generation, () => runMoreAssets(generation, conceptId));
    },
    [enqueue, runMoreAssets]
  );

  const retry = useCallback(() => {
    const failure = failureRef.current;
    if (!failure) {
      return;
    }
    failureRef.current = undefined;
    const generation = beginGeneration();
    publish();
    if (failure.retry.kind === 'reload') {
      reload(generation);
    } else if (failure.retry.kind === 'clusters') {
      enqueue(generation, () => runMoreClusters(generation));
    } else {
      const { conceptId } = failure.retry;
      enqueue(generation, () => runMoreAssets(generation, conceptId));
    }
  }, [
    beginGeneration,
    enqueue,
    publish,
    reload,
    runMoreAssets,
    runMoreClusters,
  ]);

  return { ...view, loadMoreAssets, loadMoreClusters, retry };
};
