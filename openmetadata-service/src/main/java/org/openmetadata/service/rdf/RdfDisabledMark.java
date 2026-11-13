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
import lombok.extern.slf4j.Slf4j;
import org.eclipse.jetty.util.component.LifeCycle;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;

/**
 * Records, from the configuration, that this server runs with RDF off: when it starts, when it
 * begins to stop, and once more at the end of its stop. The configuration is the source because the tools that load seed data
 * without starting a server (the ops CLI) never initialize RDF, and would otherwise report a server
 * that is not running as having it off.
 */
@Slf4j
public final class RdfDisabledMark {
  private RdfDisabledMark() {}

  /** Never throws: a server with RDF off must still start when the mark cannot be written. */
  public static void recordIfDisabled(final RdfConfiguration config, final Jdbi jdbi) {
    recordIfDisabled(config, new RdfLiveWriteStore(jdbi, Clock.systemUTC()));
  }

  /**
   * Records the mark as soon as the server begins to stop, before Jetty waits for open requests. A
   * shutdown that outlasts the platform's grace period is killed before {@link #atStop} runs, and
   * this mark is already written by then. It still follows any rebuild that began while the server
   * was up, which is what keeps that rebuild from repairing the projection.
   */
  public static LifeCycle.Listener whenStopBegins(final RdfConfiguration config, final Jdbi jdbi) {
    return whenStopBegins(config, new RdfLiveWriteStore(jdbi, Clock.systemUTC()));
  }

  static LifeCycle.Listener whenStopBegins(
      final RdfConfiguration config, final RdfLiveWriteStore store) {
    return new LifeCycle.Listener() {
      @Override
      public void lifeCycleStopping(final LifeCycle server) {
        recordIfDisabled(config, store);
      }
    };
  }

  /**
   * Records the mark again at the end of the stop, after the writes the server made while it
   * drained. A server with RDF off drops its writes for as
   * long as it runs, so a rebuild that began while it was still up must not repair the projection:
   * the mark written at start is older than that rebuild, and this one is not.
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
                + "this server's changes are not in it, and enabling RDF later may not queue a "
                + "start-up index run, so run RdfIndexApp with Recreate once after enabling it",
            exception);
      }
    }
  }

  private static boolean isDisabled(final RdfConfiguration config) {
    return config == null || !Boolean.TRUE.equals(config.getEnabled());
  }
}
