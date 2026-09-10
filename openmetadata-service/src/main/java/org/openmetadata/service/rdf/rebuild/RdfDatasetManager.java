/*
 *  Copyright 2026 Collate
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
package org.openmetadata.service.rdf.rebuild;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Semaphore;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.RdfDatasetNames;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;

/** Owns stable dataset handles, durable mutation capture, and online rebuild cutover. */
public final class RdfDatasetManager implements AutoCloseable {
  private static final int HANDLE_LIMIT = 3;
  private static final int REPLAY_PAGE_SIZE = 16;
  private static final Duration REPLAY_BUDGET = Duration.ofMinutes(5);
  private final RdfDatasetNames names;
  private final RdfRebuildStore store;
  private final Clock clock;
  private final Function<String, RdfStorageInterface> factory;
  private final Cache<String, RdfStorageInterface> handles =
      Caffeine.newBuilder().maximumSize(HANDLE_LIMIT).build();
  private final Semaphore activePermit = new Semaphore(1, true);
  private final Semaphore buildPermit = new Semaphore(1, true);

  public RdfDatasetManager(
      final RdfDatasetNames names,
      final RdfRebuildStore store,
      final Clock clock,
      final Function<String, RdfStorageInterface> factory) {
    this.names = names;
    this.store = store;
    this.clock = clock;
    this.factory = factory;
    store.initialize(names.base());
  }

  public RdfStorageInterface routedStorage() {
    return new RebuildingRdfStorage(this, null);
  }

  public void registerConfiguredStorage(final RdfStorageInterface storage) {
    handles.put(names.base(), storage);
  }

  public String activeDataset() {
    final String active = store.activeDataset();
    names.requireKnown(active);
    return active;
  }

  RdfStorageInterface servingStorage() {
    return storage(activeDataset());
  }

  public RdfStorageInterface storage(final String dataset) {
    names.requireKnown(dataset);
    return handles.get(dataset, factory);
  }

  public BuildTarget begin() {
    return withPermit(
        activePermit,
        () ->
            store.withActiveLock(
                session -> {
                  final String target = names.alternate(session.activeDataset());
                  final RdfStorageInterface backend = storage(session.activeDataset());
                  backend.createDatasetIfMissing(target);
                  final BuildTarget build = new BuildTarget(UUID.randomUUID().toString(), target);
                  session.begin(build.id(), target);
                  return build;
                }));
  }

  public RdfStorageInterface buildStorage(final BuildTarget target) {
    requireTarget(target);
    return new RebuildingRdfStorage(this, target);
  }

  private void requireTarget(final BuildTarget target) {
    names.requireKnown(target.dataset());
    final RdfRebuildStore.State state = store.state();
    if (state == null
        || !state.rebuildId().equals(target.id())
        || !state.buildDataset().equals(target.dataset())) {
      throw new IllegalStateException("RDF rebuild target does not match the persisted run");
    }
  }

  void writeActive(
      final Consumer<RdfStorageInterface> mutation, final Supplier<RdfMutation> captured) {
    withPermit(
        activePermit,
        () ->
            store.withActiveLock(
                session -> {
                  final RdfRebuildStore.State state = session.state();
                  if (state != null && state.failure() == null) {
                    capture(session, state, captured);
                  }
                  mutation.accept(storage(session.activeDataset()));
                  return null;
                }));
  }

  private void capture(
      final RdfRebuildStore.Session session,
      final RdfRebuildStore.State state,
      final Supplier<RdfMutation> captured) {
    if (state.expiresAt() <= clock.millis()) {
      session.abort(state.rebuildId(), "RDF rebuild lease expired");
    } else {
      final String payload;
      try {
        payload = JsonUtils.pojoToJson(captured.get());
      } catch (RuntimeException exception) {
        session.abort(
            state.rebuildId(), "Could not capture a live RDF mutation: " + exception.getMessage());
        return;
      }
      if (!store.append(state.rebuildId(), payload)) {
        session.abort(
            state.rebuildId(), "RDF rebuild mutation journal reached its configured limit");
      }
    }
  }

  void writeBuild(final BuildTarget target, final Consumer<RdfStorageInterface> mutation) {
    withPermit(
        buildPermit,
        () -> {
          store.withBuildLock(target.id(), () -> mutation.accept(storage(target.dataset())));
          return null;
        });
  }

  public void heartbeat(final BuildTarget target) {
    withPermit(
        activePermit,
        () ->
            store.withActiveLock(
                session -> {
                  session.heartbeat(target.id());
                  return null;
                }));
  }

  public void promote(final BuildTarget target, final String updatedBy) {
    requireTarget(target);
    final long deadline = System.nanoTime() + REPLAY_BUDGET.toNanos();
    long cursor = 0;
    boolean promoted = false;
    while (!promoted && System.nanoTime() < deadline) {
      cursor = replayPage(target, cursor);
      final long replayedThrough = cursor;
      promoted =
          withPermit(
              activePermit,
              () ->
                  store.withActiveLock(
                      session ->
                          session.promoteIfCaughtUp(target.id(), replayedThrough, updatedBy)));
    }
    if (!promoted) {
      throw new IllegalStateException(
          "Live RDF mutations could not be caught up within the rebuild budget");
    }
  }

  private long replayPage(final BuildTarget target, final long cursor) {
    final List<RdfRebuildStore.Entry> entries = store.page(target.id(), cursor, REPLAY_PAGE_SIZE);
    long replayed = cursor;
    for (RdfRebuildStore.Entry entry : entries) {
      final RdfMutation mutation = JsonUtils.readValue(entry.payload(), RdfMutation.class);
      writeBuild(target, mutation::apply);
      replayed = entry.id();
    }
    return replayed;
  }

  public void abort(final BuildTarget target, final String reason) {
    withPermit(
        activePermit,
        () ->
            store.withActiveLock(
                session -> {
                  session.abort(target.id(), reason);
                  return null;
                }));
  }

  private static <T> T withPermit(final Semaphore permit, final Supplier<T> action) {
    try {
      permit.acquire();
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException(
          "Interrupted while waiting for the RDF dataset writer", exception);
    }
    try {
      return action.get();
    } finally {
      permit.release();
    }
  }

  @Override
  public void close() {
    handles.asMap().values().forEach(RdfStorageInterface::close);
    handles.invalidateAll();
  }

  public record BuildTarget(String id, String dataset) {}
}
