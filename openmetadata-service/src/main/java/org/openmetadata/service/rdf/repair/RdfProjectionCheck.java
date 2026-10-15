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
package org.openmetadata.service.rdf.repair;

import java.time.Duration;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.function.BooleanSupplier;
import java.util.function.LongSupplier;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.AppRunRecord;

/**
 * Starts a full RDF rebuild when the projection needs one as a whole, which the weekly RdfIndexApp
 * schedule used to cover:
 *
 * <ul>
 *   <li>it was never built: no RdfIndexApp run is on record, as on a fresh install or after an
 *       upgrade cleared the records;
 *   <li>the store came back without its data: its ontology graph is gone;
 *   <li>its last full build failed, at least {@link #FAILED_BUILD_RETRY} ago, so a build that
 *       always fails is retried daily rather than every pass.
 * </ul>
 *
 * A stopped build stays stopped: someone stopped it. A reason must still hold after {@link
 * #CONFIRMATION_DELAY}, and nothing starts while an RDF rebuild or a search reindex runs.
 */
@Slf4j
public class RdfProjectionCheck {
  static final Duration CONFIRMATION_DELAY = Duration.ofMinutes(1);
  static final Duration FAILED_BUILD_RETRY = Duration.ofDays(1);
  private static final Set<AppRunRecord.Status> FAILED =
      Set.of(AppRunRecord.Status.FAILED, AppRunRecord.Status.ACTIVE_ERROR);

  /**
   * What the check reads.
   *
   * @param latestRun the latest RdfIndexApp run on record
   * @param ontologyLoaded whether the store holds the ontology graph; throws if it cannot tell
   * @param rebuildRunning whether an RDF rebuild runs on any server
   * @param searchReindexRunning whether a search reindex runs on any server
   */
  public record Probes(
      Supplier<Optional<AppRunRecord>> latestRun,
      BooleanSupplier ontologyLoaded,
      BooleanSupplier rebuildRunning,
      BooleanSupplier searchReindexRunning) {}

  private final Probes probes;
  private final Runnable startFullRebuild;
  private final LongSupplier clock;
  private final Duration confirmationDelay;

  public RdfProjectionCheck(final Probes probes, final Runnable startFullRebuild) {
    this(probes, startFullRebuild, System::currentTimeMillis, CONFIRMATION_DELAY);
  }

  RdfProjectionCheck(
      final Probes probes,
      final Runnable startFullRebuild,
      final LongSupplier clock,
      final Duration confirmationDelay) {
    this.probes = probes;
    this.startFullRebuild = startFullRebuild;
    this.clock = clock;
    this.confirmationDelay = confirmationDelay;
  }

  /** Starts a full rebuild if the projection still needs one after the confirmation delay. */
  public void rebuildIfNeeded() throws InterruptedException {
    final Optional<String> reason = confirmedReason();
    if (reason.isPresent()) {
      startUnlessBusy(reason.get());
    }
  }

  private Optional<String> confirmedReason() throws InterruptedException {
    Optional<String> reason = reasonToRebuild();
    if (reason.isPresent()) {
      TimeUnit.MILLISECONDS.sleep(confirmationDelay.toMillis());
      reason = reasonToRebuild();
    }
    return reason;
  }

  /** Why the projection needs a full rebuild now, if it does. */
  Optional<String> reasonToRebuild() {
    final Optional<AppRunRecord> latest = probes.latestRun().get();
    final Optional<String> reason;
    if (latest.isEmpty()) {
      reason = Optional.of("it has never been built");
    } else if (!probes.ontologyLoaded().getAsBoolean()) {
      reason = Optional.of("the RDF store has lost its data: its ontology graph is gone");
    } else {
      reason = failedLongAgo(latest.get());
    }
    return reason;
  }

  private Optional<String> failedLongAgo(final AppRunRecord run) {
    final Long endedAt = run.getEndTime() != null ? run.getEndTime() : run.getTimestamp();
    final boolean retryDue =
        FAILED.contains(run.getStatus())
            && (endedAt == null || clock.getAsLong() - endedAt >= FAILED_BUILD_RETRY.toMillis());
    return retryDue ? Optional.of("its last full build failed") : Optional.empty();
  }

  private void startUnlessBusy(final String reason) {
    if (probes.rebuildRunning().getAsBoolean() || probes.searchReindexRunning().getAsBoolean()) {
      LOG.info(
          "The RDF projection needs a full rebuild because {}; waiting for the running rebuild",
          reason);
    } else {
      LOG.warn("The RDF projection needs a full rebuild because {}; starting one", reason);
      startFullRebuild.run();
    }
  }
}
