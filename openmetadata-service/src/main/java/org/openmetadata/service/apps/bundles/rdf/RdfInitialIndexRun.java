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

package org.openmetadata.service.apps.bundles.rdf;

import java.util.function.BooleanSupplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.rdf.RdfProjectionHealth;
import org.openmetadata.service.rdf.RdfProjectionStateResolver;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.search.SearchRepository;

/**
 * Queues one {@code RdfIndexApp} run at start-up when nothing has indexed the graph since RDF was
 * last off: on a stack that has never run it, and on one whose server started with RDF off, where
 * every change since went unprojected. The app is scheduled weekly, and until a run indexes, the
 * projection reports REBUILDING or DEGRADED, which blocks the agent SPARQL path for up to a week.
 *
 * <p>A run record that started after the last RDF-off start is the idempotency key, whatever its
 * status: a restart, an upgrade or a reinstall that finds one queues nothing, so a failed run is not
 * retried at every restart.
 */
@Slf4j
public final class RdfInitialIndexRun {
  public static final String TRIGGERED_BY = "system:rdf-initial-index";
  static final String RDF_INDEX_APP = "RdfIndexApp";

  private final BooleanSupplier hasProjectedSinceRdfWasOff;
  private final BooleanSupplier rdfEnabled;
  private final Runnable enqueue;

  RdfInitialIndexRun(
      final BooleanSupplier hasProjectedSinceRdfWasOff,
      final BooleanSupplier rdfEnabled,
      final Runnable enqueue) {
    this.hasProjectedSinceRdfWasOff = hasProjectedSinceRdfWasOff;
    this.rdfEnabled = rdfEnabled;
    this.enqueue = enqueue;
  }

  /**
   * Call after the app entity is persisted: the run's job listener loads the app by name, so a run
   * queued earlier can start before the row exists. Never throws; a failed enqueue leaves the
   * weekly schedule as the fallback.
   */
  public static void enqueueIfNeverRun(
      final App app, final CollectionDAO dao, final SearchRepository searchRepository) {
    if (RDF_INDEX_APP.equals(app.getName())) {
      final RdfProjectionStateResolver resolver =
          new RdfProjectionStateResolver(
              dao.appExtensionTimeSeriesDao(),
              RdfProjectionHealth::isDegraded,
              RdfProjectionHealth::rdfDisabledAt);
      new RdfInitialIndexRun(
              resolver::hasProjectedSinceRdfWasOff,
              RdfInitialIndexRun::isRdfEnabled,
              () ->
                  ApplicationHandler.getInstance()
                      .triggerApplicationOnDemand(app, dao, searchRepository, null, TRIGGERED_BY))
          .run();
    }
  }

  private static boolean isRdfEnabled() {
    final RdfRepository repository = RdfRepository.getInstanceOrNull();
    return repository != null && repository.isEnabled();
  }

  /** @return true when a run was queued */
  boolean run() {
    boolean queued = false;
    try {
      if (rdfEnabled.getAsBoolean() && !hasProjectedSinceRdfWasOff.getAsBoolean()) {
        enqueue.run();
        queued = true;
        LOG.info(
            "Queued an {} run at start-up; nothing has indexed since RDF was last off",
            RDF_INDEX_APP);
      }
    } catch (RuntimeException e) {
      LOG.warn(
          "Could not queue an {} run at start-up; the weekly schedule will build the projection",
          RDF_INDEX_APP,
          e);
    }
    return queued;
  }
}
