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

package org.openmetadata.service.util;

import java.util.Collection;
import java.util.Set;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.DomainLineageRebuildStateDAO;

/**
 * Which domain lineage repairs are due. A domain write that leaves its descendants' rollups for the
 * rebuild counts itself here in its own transaction, so the record commits or rolls back with the
 * write. The rebuild and the forced domain reindex each record the version they started from, so
 * neither can clear a write that landed while it ran, and a reindex run before the rebuild clears
 * nothing.
 * ADR:2026-11-20-a-domain-lineage-edge-counts-the-edges-its-domains-assets-hold-in-effect
 */
public final class DomainLineageRecovery {

  public static final String REBUILD_COMMAND =
      "./bootstrap/openmetadata-ops.sh rebuild-domain-lineage";
  public static final String REINDEX_COMMAND =
      "./bootstrap/openmetadata-ops.sh reindex --force --entities=domain,dataProduct";

  private static final int MAX_REASON_LENGTH = 1024;
  private static final String ALL_ENTITIES = "all";
  private static final Set<String> REINDEXED_FOR_DOMAIN_LINEAGE =
      Set.of(Entity.DOMAIN, Entity.DATA_PRODUCT);

  private DomainLineageRecovery() {}

  public enum Status {
    HEALTHY,
    REBUILD_REQUIRED,
    REINDEX_REQUIRED
  }

  /** The stored versions and the times they last moved; times are epoch milliseconds, 0 if never. */
  public record State(
      long driftVersion,
      long rebuiltVersion,
      long reindexedVersion,
      long firstDriftedAt,
      long lastDriftedAt,
      long lastRebuiltAt,
      long lastReindexedAt,
      String lastReason) {

    public static final State NEVER_DRIFTED = new State(0, 0, 0, 0, 0, 0, 0, null);

    public Status status() {
      Status status = Status.HEALTHY;
      if (driftVersion > rebuiltVersion) {
        status = Status.REBUILD_REQUIRED;
      } else if (driftVersion > reindexedVersion) {
        status = Status.REINDEX_REQUIRED;
      }
      return status;
    }
  }

  /** Counts a domain write whose descendants' rollups were not moved; joins the caller's transaction. */
  public static void recordDrift(final String reason) {
    dao().recordDrift(System.currentTimeMillis(), truncate(reason));
  }

  public static State read() {
    final State state = dao().read();
    return state == null ? State.NEVER_DRIFTED : state;
  }

  /** Records a completed rebuild that began when the drift version was {@code startedAt}. */
  public static void markRebuilt(final long startedAt) {
    dao().markRebuilt(startedAt, System.currentTimeMillis());
  }

  /** Records a completed domain reindex that began when the rebuilt version was {@code startedAt}. */
  public static void markReindexed(final long startedAt) {
    dao().markReindexed(startedAt, System.currentTimeMillis());
  }

  /** Whether a reindex of these entity types rebuilds the documents the domain view reads. */
  public static boolean reindexCoversDomainLineage(final Collection<String> entities) {
    return entities.contains(ALL_ENTITIES) || entities.containsAll(REINDEXED_FOR_DOMAIN_LINEAGE);
  }

  /** One line for an operator: what is due and the commands that clear it. */
  public static String describe(final State state) {
    return switch (state.status()) {
      case HEALTHY -> "Domain lineage rollups are up to date.";
      case REBUILD_REQUIRED -> String.format(
          "Domain lineage rollups need a rebuild: %d domain write(s) since %d left them stale"
              + " (last: %s). Pause lineage and domain writes, run `%s`, then `%s`.",
          state.driftVersion() - state.rebuiltVersion(),
          state.firstDriftedAt(),
          state.lastReason(),
          REBUILD_COMMAND,
          REINDEX_COMMAND);
      case REINDEX_REQUIRED -> String.format(
          "Domain lineage rollups were rebuilt at %d, but the domain view has not been reindexed"
              + " since. Run `%s`.",
          state.lastRebuiltAt(), REINDEX_COMMAND);
    };
  }

  private static String truncate(final String reason) {
    return reason == null || reason.length() <= MAX_REASON_LENGTH
        ? reason
        : reason.substring(0, MAX_REASON_LENGTH);
  }

  private static DomainLineageRebuildStateDAO dao() {
    return Entity.getCollectionDAO().domainLineageRebuildStateDAO();
  }
}
