/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.sink;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;

/**
 * Fetches the entities of a batch sink one sub-batch ahead, so the next sub-batch is loaded while
 * the current one is being written. A sub-batch is split into up to {@link #FETCH_THREADS}
 * contiguous slices loaded in parallel by a small pool; {@link #take} joins them back in input
 * order. At most one sub-batch is pending at a time: {@link #prefetch} may only be called again
 * once {@link #take} has returned.
 */
@Slf4j
final class SubBatchPrefetcher implements AutoCloseable {

  static final String THREAD_NAME_PREFIX = "sink-prefetch-";
  static final int FETCH_THREADS = 4;

  private final ExecutorService executor;
  private final Function<String, EntityInterface<?>> entityLoader;
  private List<String> pendingLinks;
  private List<Future<FetchedSubBatch>> pendingSlices;

  SubBatchPrefetcher(String workflowName, Function<String, EntityInterface<?>> entityLoader) {
    this.entityLoader = entityLoader;
    AtomicInteger threadNumber = new AtomicInteger();
    this.executor =
        Executors.newFixedThreadPool(
            FETCH_THREADS,
            runnable -> {
              Thread thread =
                  new Thread(
                      runnable,
                      "%s%s-%d"
                          .formatted(
                              THREAD_NAME_PREFIX, workflowName, threadNumber.incrementAndGet()));
              thread.setDaemon(true);
              return thread;
            });
  }

  /** Starts loading the entities behind {@code entityLinks} on the pool. */
  void prefetch(List<String> entityLinks) {
    if (pendingSlices != null) {
      throw new IllegalStateException("A sub-batch fetch is already pending");
    }
    pendingLinks = List.copyOf(entityLinks);
    pendingSlices = new ArrayList<>();
    for (List<String> slice : slices(pendingLinks)) {
      pendingSlices.add(executor.submit(() -> fetch(slice)));
    }
  }

  /** Contiguous slices of roughly equal size, at most {@link #FETCH_THREADS} of them. */
  static List<List<String>> slices(List<String> links) {
    int sliceSize = Math.max(1, (links.size() + FETCH_THREADS - 1) / FETCH_THREADS);
    List<List<String>> slices = new ArrayList<>();
    for (int from = 0; from < links.size(); from += sliceSize) {
      slices.add(links.subList(from, Math.min(from + sliceSize, links.size())));
    }
    return slices;
  }

  boolean hasPending() {
    return pendingSlices != null;
  }

  /** Waits for the pending fetch and returns its entities in input order. */
  FetchedSubBatch take() {
    List<Future<FetchedSubBatch>> slices = pendingSlices;
    List<String> links = pendingLinks;
    pendingSlices = null;
    pendingLinks = null;
    List<EntityInterface<?>> entities = new ArrayList<>();
    List<SinkResult.SinkError> fetchErrors = new ArrayList<>();
    for (Future<FetchedSubBatch> slice : slices) {
      FetchedSubBatch fetched = await(slice);
      entities.addAll(fetched.entities());
      fetchErrors.addAll(fetched.fetchErrors());
    }
    return new FetchedSubBatch(links, entities, fetchErrors);
  }

  private static FetchedSubBatch await(Future<FetchedSubBatch> slice) {
    try {
      return slice.get();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Interrupted while fetching sink entities", e);
    } catch (ExecutionException e) {
      throw new IllegalStateException(
          "Fetching sink entities failed: %s".formatted(e.getCause().getMessage()), e.getCause());
    }
  }

  private FetchedSubBatch fetch(List<String> entityLinks) {
    List<EntityInterface<?>> entities = new ArrayList<>();
    List<SinkResult.SinkError> fetchErrors = new ArrayList<>();
    for (String entityLink : entityLinks) {
      try {
        entities.add(entityLoader.apply(entityLink));
      } catch (RuntimeException e) {
        LOG.error("Failed to fetch entity: {}", entityLink, e);
        fetchErrors.add(
            SinkResult.SinkError.builder()
                .entityFqn(entityLink)
                .errorMessage("Failed to fetch entity: %s".formatted(e.getMessage()))
                .build());
      }
    }
    return new FetchedSubBatch(entityLinks, entities, fetchErrors);
  }

  /**
   * Stops the pool and drops the result of a fetch still pending. Fetches already running are not
   * interrupted, so their database reads are not cut off mid-query; the threads exit once they
   * return.
   */
  @Override
  public void close() {
    if (pendingSlices != null) {
      pendingSlices.forEach(slice -> slice.cancel(false));
      pendingSlices = null;
      pendingLinks = null;
    }
    executor.shutdown();
  }

  /** The entities loaded for one sub-batch and the links that could not be loaded. */
  record FetchedSubBatch(
      List<String> entityLinks,
      List<EntityInterface<?>> entities,
      List<SinkResult.SinkError> fetchErrors) {}
}
