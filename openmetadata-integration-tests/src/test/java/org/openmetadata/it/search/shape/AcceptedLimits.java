package org.openmetadata.it.search.shape;

import java.util.List;
import java.util.Optional;

/**
 * Opt-in list of search-index shapes whose non-OK outcome is consciously accepted. A case listed
 * here is tolerated (the canary stays green and logs the reason); ANY case NOT listed must index
 * and be queryable (Outcome.OK) or {@link org.openmetadata.it.tests.EntityShapeIT} fails red.
 *
 * <p>Add an entry to accept a limit (e.g. "1M columns may fail"); remove it (or fix the root cause)
 * to make the case red again. Granularity is per (entityType, dimension, rung).
 */
public final class AcceptedLimits {

  public record Accepted(
      String entityType, String dimension, String rung, Outcome outcome, String reason) {}

  private static final List<Accepted> ACCEPTED =
      List.of(
          // Opt-in acceptances go here, e.g.:
          // new Accepted(
          //     org.openmetadata.service.Entity.TABLE, "columns.count", "100k",
          //     Outcome.REJECT_SIZE, "100k columns is unrealistic for a single table")
          );

  private AcceptedLimits() {}

  public static Optional<Accepted> find(
      final String entityType, final String dimension, final String rung) {
    return ACCEPTED.stream()
        .filter(
            a ->
                a.entityType().equals(entityType)
                    && a.dimension().equals(dimension)
                    && a.rung().equals(rung))
        .findFirst();
  }
}
