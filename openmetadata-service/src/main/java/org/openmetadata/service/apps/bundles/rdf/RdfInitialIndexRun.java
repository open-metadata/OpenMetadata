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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.function.BooleanSupplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.service.apps.ApplicationHandler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.TimeSeriesDAOs.AppExtensionTimeSeries;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.search.SearchRepository;

/**
 * Queues one {@code RdfIndexApp} run on a stack that has never run it. The app is scheduled weekly,
 * and until its first run the projection reports REBUILDING, which blocks the agent SPARQL path
 * for up to a week on a new install.
 *
 * <p>The run record is the idempotency key: a restart, an upgrade or a reinstall that finds one
 * queues nothing.
 */
@Slf4j
public final class RdfInitialIndexRun {
  public static final String TRIGGERED_BY = "system:rdf-initial-index";
  static final String RDF_INDEX_APP = "RdfIndexApp";

  private final AppExtensionTimeSeries runStore;
  private final BooleanSupplier rdfEnabled;
  private final Runnable enqueue;

  RdfInitialIndexRun(
      final AppExtensionTimeSeries runStore,
      final BooleanSupplier rdfEnabled,
      final Runnable enqueue) {
    this.runStore = runStore;
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
      new RdfInitialIndexRun(
              dao.appExtensionTimeSeriesDao(),
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
      if (rdfEnabled.getAsBoolean() && !hasRunRecord()) {
        enqueue.run();
        queued = true;
        LOG.info("Queued the first {} run; no run record exists", RDF_INDEX_APP);
      }
    } catch (RuntimeException e) {
      LOG.warn(
          "Could not queue the first {} run; the weekly schedule will build the projection",
          RDF_INDEX_APP,
          e);
    }
    return queued;
  }

  private boolean hasRunRecord() {
    final List<String> latest =
        runStore.listAppExtensionByName(
            RDF_INDEX_APP, 1, 0, AppExtension.ExtensionType.STATUS.toString());
    return !nullOrEmpty(latest);
  }
}
