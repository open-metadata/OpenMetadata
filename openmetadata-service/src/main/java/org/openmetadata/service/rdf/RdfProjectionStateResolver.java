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

import java.util.List;
import java.util.Optional;
import java.util.function.BooleanSupplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.rdf.RdfProjectionState;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TimeSeriesDAOs.AppExtensionTimeSeries;

@Slf4j
public final class RdfProjectionStateResolver {
  static final String RDF_INDEX_APP = "RdfIndexApp";
  static final int RUN_PAGE_SIZE = 10;
  // Every status read pages back through skipped runs; past this many it reports REBUILDING.
  static final int MAX_RUN_PAGES = 5;
  private static final String PROJECTION_UNCHANGED = "projectionUnchanged";
  private final AppExtensionTimeSeries runStore;
  private final BooleanSupplier isDegraded;

  public RdfProjectionStateResolver(final AppExtensionTimeSeries runStore) {
    this(runStore, RdfProjectionHealth::isDegraded);
  }

  public RdfProjectionStateResolver(
      final AppExtensionTimeSeries runStore, final BooleanSupplier isDegraded) {
    this.runStore = runStore;
    this.isDegraded = isDegraded;
  }

  /** Resolves the state from the server's own run store; the production wiring. */
  public static RdfProjectionState resolveConfigured() {
    return new RdfProjectionStateResolver(Entity.getCollectionDAO().appExtensionTimeSeriesDao())
        .resolve();
  }

  public RdfProjectionState resolve() {
    return applyRuntimeHealth(latestProjectingRunState().orElse(RdfProjectionState.REBUILDING));
  }

  /**
   * A run that ended before indexing (the reindex lock held or unavailable, or deferred behind a
   * search reindex) or that found RDF off never touched the projection, so the state comes from the
   * newest run that did.
   */
  private Optional<RdfProjectionState> latestProjectingRunState() {
    Optional<RdfProjectionState> state;
    List<String> page;
    int offset = 0;
    int pages = 0;
    do {
      page =
          runStore.listAppExtensionByName(
              RDF_INDEX_APP, RUN_PAGE_SIZE, offset, AppExtension.ExtensionType.STATUS.toString());
      state =
          page.stream()
              .map(RdfProjectionStateResolver::parse)
              .flatMap(Optional::stream)
              .findFirst();
      offset += RUN_PAGE_SIZE;
      pages++;
    } while (state.isEmpty() && page.size() == RUN_PAGE_SIZE && pages < MAX_RUN_PAGES);
    return state;
  }

  /** Builds the failure context of a run, flagging one that ended before touching the projection. */
  public static FailureContext failureContext(
      final IndexingError failure, final boolean projectionUnchanged) {
    final FailureContext context = new FailureContext().withAdditionalProperty("failure", failure);
    if (projectionUnchanged) {
      context.withAdditionalProperty(PROJECTION_UNCHANGED, true);
    }
    return context;
  }

  /** The success context of a run that completed without touching the projection. */
  public static SuccessContext successContextOfUnchangedProjection() {
    return new SuccessContext().withAdditionalProperty(PROJECTION_UNCHANGED, true);
  }

  private RdfProjectionState applyRuntimeHealth(final RdfProjectionState persistedState) {
    return persistedState == RdfProjectionState.READY && isDegraded.getAsBoolean()
        ? RdfProjectionState.DEGRADED
        : persistedState;
  }

  /** Empty for a run that left the projection unchanged. */
  private static Optional<RdfProjectionState> parse(final String runJson) {
    Optional<RdfProjectionState> state;
    try {
      final AppRunRecord run = JsonUtils.readValue(runJson, AppRunRecord.class);
      state =
          leftProjectionUnchanged(run)
              ? Optional.empty()
              : Optional.of(fromStatus(run == null ? null : run.getStatus()));
    } catch (JsonParsingException exception) {
      LOG.warn("RDF projection run state is malformed", exception);
      state = Optional.of(RdfProjectionState.DEGRADED);
    }
    return state;
  }

  private static boolean leftProjectionUnchanged(final AppRunRecord run) {
    return run != null && (failureFlagsUnchanged(run) || successFlagsUnchanged(run));
  }

  private static boolean failureFlagsUnchanged(final AppRunRecord run) {
    return run.getFailureContext() != null
        && Boolean.TRUE.equals(
            run.getFailureContext().getAdditionalProperties().get(PROJECTION_UNCHANGED));
  }

  private static boolean successFlagsUnchanged(final AppRunRecord run) {
    return run.getSuccessContext() != null
        && Boolean.TRUE.equals(
            run.getSuccessContext().getAdditionalProperties().get(PROJECTION_UNCHANGED));
  }

  static RdfProjectionState fromStatus(final AppRunRecord.Status status) {
    return switch (status) {
      case SUCCESS, COMPLETED -> RdfProjectionState.READY;
      case FAILED, ACTIVE_ERROR, STOPPED -> RdfProjectionState.DEGRADED;
      case null -> RdfProjectionState.REBUILDING;
      case STARTED, RUNNING, ACTIVE, STOP_IN_PROGRESS, PENDING -> RdfProjectionState.REBUILDING;
    };
  }
}
