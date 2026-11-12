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

import java.time.Clock;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;

/**
 * Records, from the configuration, that this server started with RDF off. The configuration is the
 * source because the tools that load seed data without starting a server (the ops CLI) never
 * initialize RDF, and would otherwise report a server that is not running as having it off.
 */
@Slf4j
public final class RdfDisabledMark {
  private RdfDisabledMark() {}

  /** Never throws: a server with RDF off must still start when the mark cannot be written. */
  public static void recordIfDisabled(final RdfConfiguration config, final Jdbi jdbi) {
    recordIfDisabled(config, new RdfLiveWriteStore(jdbi, Clock.systemUTC()));
  }

  static void recordIfDisabled(final RdfConfiguration config, final RdfLiveWriteStore store) {
    if (isDisabled(config)) {
      try {
        store.recordRdfDisabled();
      } catch (RuntimeException exception) {
        LOG.warn(
            "Could not record that RDF is disabled; enabling it later will neither report the "
                + "graph as out of date nor queue a start-up index run, so run RdfIndexApp with "
                + "Recreate once after enabling it",
            exception);
      }
    }
  }

  private static boolean isDisabled(final RdfConfiguration config) {
    return config == null || !Boolean.TRUE.equals(config.getEnabled());
  }
}
