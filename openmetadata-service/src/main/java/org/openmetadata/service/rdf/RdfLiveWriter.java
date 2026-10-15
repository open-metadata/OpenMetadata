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
package org.openmetadata.service.rdf;

import io.micrometer.core.instrument.Timer;
import java.time.Duration;
import java.util.concurrent.Executor;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.monitoring.OntologyMetrics;
import org.openmetadata.service.monitoring.RequestLatencyContext;
import org.openmetadata.service.util.PerRequestContextCleaner;

/** One bounded drain task per server; the database fence permits one cluster-wide writer. */
@Slf4j
public final class RdfLiveWriter implements AutoCloseable {
  private static final int MAX_WRITES_PER_DRAIN = 100;
  private static final int MAX_REPLAYS_PER_RUN = 50;
  private static final long REPLAY_INTERVAL_MILLIS = Duration.ofMinutes(5).toMillis();
  private final RdfLiveWriteStore store;
  private final Target target;
  private final Executor executor;
  private final AtomicBoolean draining = new AtomicBoolean();
  private volatile boolean closed;
  private volatile long lastReplayAt;
  private ScheduledFuture<?> poll;

  /**
   * Where queued writes go.
   *
   * @param write delivers a live write
   * @param replay delivers a dead-lettered write after later writes may have changed its data
   * @param reachable whether the store answers, asked only after a write failed or before a replay
   */
  public record Target(
      Consumer<RdfLiveWrite> write, Consumer<RdfLiveWrite> replay, BooleanSupplier reachable) {
    /**
     * Live writes are delivered like replays, against the database's current state, so a write
     * delivered late, after a retry or a replay, cannot put back older data.
     */
    public static Target of(final RdfRepository repository) {
      return new Target(
          command -> command.replay(repository),
          command -> command.replay(repository),
          repository::isStorageReachable);
    }
  }

  public RdfLiveWriter(
      final RdfLiveWriteStore store, final Target target, final Executor executor) {
    this.store = store;
    this.target = target;
    this.executor = executor;
  }

  public void start() {
    poll =
        RdfBackgroundScheduler.getInstance()
            .scheduleWithFixedDelay(this::wake, 0, 1, TimeUnit.SECONDS);
  }

  public void enqueue(final RdfLiveWrite command) {
    try {
      store.enqueue(JsonUtils.pojoToJson(command));
    } catch (RuntimeException exception) {
      RdfProjectionHealth.markDegraded(exception);
      throw exception;
    }
    wake();
  }

  void wake() {
    if (!closed && draining.compareAndSet(false, true)) {
      try {
        executor.execute(this::drain);
      } catch (RuntimeException exception) {
        draining.set(false);
        LOG.warn(
            "Could not dispatch live RDF writes; the durable queue will be polled again",
            exception);
      }
    }
  }

  private void drain() {
    boolean continueDraining = false;
    try {
      RdfProjectionHealth.flushLocalFailures();
      int processed = 0;
      for (; !closed && processed < MAX_WRITES_PER_DRAIN; processed++) {
        if (!store.processNext(this::apply)) {
          break;
        }
      }
      continueDraining = processed == MAX_WRITES_PER_DRAIN;
      OntologyMetrics.recordRdfQueueDepth((int) Math.min(Integer.MAX_VALUE, store.pendingWrites()));
      if (processed == 0) {
        replayDeadLettersIfDue();
      }
    } catch (RuntimeException exception) {
      LOG.warn("Could not drain live RDF writes; pending writes remain in SQL", exception);
    } finally {
      draining.set(false);
    }
    if (continueDraining) {
      wake();
    }
  }

  /** While the live queue is idle, retries dead letters every few minutes once the store answers. */
  private void replayDeadLettersIfDue() {
    final long now = System.currentTimeMillis();
    if (now - lastReplayAt >= REPLAY_INTERVAL_MILLIS) {
      lastReplayAt = now;
      if (store.hasDeadLettersToReplay() && target.reachable().getAsBoolean()) {
        final int replayed = store.replayDeadLetters(MAX_REPLAYS_PER_RUN, this::replay);
        LOG.info("Replayed {} dead-lettered RDF writes", replayed);
      }
    }
  }

  private void apply(final String payload) {
    deliver(payload, target.write());
  }

  private void replay(final String payload) {
    deliver(payload, target.replay());
  }

  private void deliver(final String payload, final Consumer<RdfLiveWrite> delivery) {
    // Each queued write is its own unit of work: a read cached by an earlier write in this drain
    // would project a stale entity, so start and leave every write with a clean request context.
    PerRequestContextCleaner.clear();
    final Timer.Sample sample = RequestLatencyContext.startRdfOperation();
    try {
      RdfProjectionHealth.withDurableRecovery(
          () -> delivery.accept(JsonUtils.readValue(payload, RdfLiveWrite.class)));
    } catch (RuntimeException failure) {
      throw unreachableStoreOr(failure);
    } finally {
      RequestLatencyContext.endRdfOperation(sample);
      PerRequestContextCleaner.clear();
    }
  }

  /** A failure while the store does not answer says nothing about the write itself. */
  private RuntimeException unreachableStoreOr(final RuntimeException failure) {
    return RdfStoreUnavailableException.isAvailabilityFailure(failure)
            && !target.reachable().getAsBoolean()
        ? new RdfStoreUnavailableException(failure)
        : failure;
  }

  @Override
  public void close() {
    closed = true;
    if (poll != null) {
      poll.cancel(false);
    }
  }
}
