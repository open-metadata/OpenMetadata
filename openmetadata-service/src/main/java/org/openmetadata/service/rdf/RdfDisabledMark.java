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

import io.dropwizard.lifecycle.Managed;
import java.time.Clock;
import java.time.Duration;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.jetty.util.component.LifeCycle;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;

/**
 * Records, from the configuration, that this server runs with RDF off: when it starts, when it
 * begins to stop, and once more at the end of its stop. The configuration is the source because the
 * tools that load seed data without starting a server (the ops CLI) never initialize RDF, and would
 * otherwise report a server that is not running as having it off.
 */
@Slf4j
public final class RdfDisabledMark {
  private static final Duration STOP_BEGIN_WAIT = Duration.ofSeconds(5);

  private RdfDisabledMark() {}

  /** Never throws: a server with RDF off must still start when the mark cannot be written. */
  public static void recordIfDisabled(final RdfConfiguration config, final Jdbi jdbi) {
    recordIfDisabled(config, new RdfLiveWriteStore(jdbi, Clock.systemUTC()));
  }

  /**
   * Records the mark as soon as the server begins to stop, before Jetty waits for open requests. A
   * shutdown that outlasts the platform's grace period is killed before {@link #atStop} runs, and
   * this mark is already written by then. It follows any rebuild that began before the stop did,
   * which is what keeps that rebuild from repairing the projection.
   */
  public static LifeCycle.Listener whenStopBegins(final RdfConfiguration config, final Jdbi jdbi) {
    return whenStopBegins(config, new RdfLiveWriteStore(jdbi, Clock.systemUTC()), STOP_BEGIN_WAIT);
  }

  static LifeCycle.Listener whenStopBegins(
      final RdfConfiguration config, final RdfLiveWriteStore store, final Duration wait) {
    return new LifeCycle.Listener() {
      @Override
      public void lifeCycleStopping(final LifeCycle server) {
        if (isDisabled(config)) {
          recordWithin(wait, () -> recordIfDisabled(config, store));
        }
      }
    };
  }

  /**
   * Nothing has stopped yet when the stop begins, so a database that does not answer must not hold
   * the shutdown for its whole connection timeout: the platform would kill the server before any
   * of its hooks ran.
   */
  private static void recordWithin(final Duration wait, final Runnable record) {
    final FutureTask<Void> write = new FutureTask<>(record, null);
    Thread.ofPlatform().daemon().name("rdf-disabled-mark").start(write);
    try {
      write.get(wait.toMillis(), TimeUnit.MILLISECONDS);
    } catch (TimeoutException | ExecutionException exception) {
      LOG.warn(
          "Could not record that RDF is disabled within {} ms of the stop beginning; the stop goes "
              + "on and records it again at its end",
          wait.toMillis(),
          exception);
    } catch (InterruptedException exception) {
      LOG.warn(
          "Interrupted while recording that RDF is disabled; the stop goes on and records it "
              + "again at its end",
          exception);
      Thread.currentThread().interrupt();
    }
  }

  /**
   * Records the mark again at the end of the stop, after the writes the server made while it
   * drained. A server with RDF off drops its writes for as long as it runs, so a rebuild that began
   * while it was still up must not repair the projection: the mark written at start is older than
   * that rebuild, and this one is not.
   */
  public static Managed atStop(final RdfConfiguration config, final Jdbi jdbi) {
    return atStop(config, new RdfLiveWriteStore(jdbi, Clock.systemUTC()));
  }

  static Managed atStop(final RdfConfiguration config, final RdfLiveWriteStore store) {
    return new Managed() {
      @Override
      public void stop() {
        recordIfDisabled(config, store);
      }
    };
  }

  static void recordIfDisabled(final RdfConfiguration config, final RdfLiveWriteStore store) {
    if (isDisabled(config)) {
      try {
        store.recordRdfDisabled();
      } catch (RuntimeException exception) {
        LOG.warn(
            "Could not record that RDF is disabled; the graph may be reported as current although "
                + "this server's changes are not in it. Run RdfIndexApp with Recreate once after "
                + "enabling RDF",
            exception);
      }
    }
  }

  private static boolean isDisabled(final RdfConfiguration config) {
    return config == null || !Boolean.TRUE.equals(config.getEnabled());
  }
}
