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
import java.util.concurrent.Executor;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.monitoring.OntologyMetrics;
import org.openmetadata.service.monitoring.RequestLatencyContext;

/** One bounded drain task per server; the database fence permits one cluster-wide writer. */
@Slf4j
public final class RdfLiveWriter implements AutoCloseable {
  private static final int MAX_WRITES_PER_DRAIN = 100;
  private final RdfLiveWriteStore store;
  private final Consumer<RdfLiveWrite> write;
  private final Executor executor;
  private final AtomicBoolean draining = new AtomicBoolean();
  private volatile boolean closed;
  private ScheduledFuture<?> poll;

  public RdfLiveWriter(
      final RdfLiveWriteStore store, final Consumer<RdfLiveWrite> write, final Executor executor) {
    this.store = store;
    this.write = write;
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
    } catch (RuntimeException exception) {
      LOG.warn("Could not drain live RDF writes; pending writes remain in SQL", exception);
    } finally {
      draining.set(false);
    }
    if (continueDraining) {
      wake();
    }
  }

  private void apply(final String payload) {
    final Timer.Sample sample = RequestLatencyContext.startRdfOperation();
    try {
      RdfProjectionHealth.withDurableRecovery(
          () -> write.accept(JsonUtils.readValue(payload, RdfLiveWrite.class)));
    } finally {
      RequestLatencyContext.endRdfOperation(sample);
    }
  }

  @Override
  public void close() {
    closed = true;
    if (poll != null) {
      poll.cancel(false);
    }
  }
}
