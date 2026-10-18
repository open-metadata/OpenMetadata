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
package org.openmetadata.service.projection;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.transaction.TransactionIsolationLevel;
import org.openmetadata.service.projection.MutationFacts.Kind;

/** Bounded cleanup of expanded facts, preserving historical owner locators and delivery state. */
public final class ProjectionJournalRetention {
  private static final int SCAN_PAGE_SIZE = 100;
  private static final int MAX_ROW_BUDGET = 1000;
  private static final int MAX_CONSUMERS = ProjectionTarget.values().length;
  private final Jdbi jdbi;
  private final Clock clock;

  public ProjectionJournalRetention(final Jdbi jdbi, final Clock clock) {
    this.jdbi = Objects.requireNonNull(jdbi);
    this.clock = Objects.requireNonNull(clock);
  }

  /**
   * Deletes at most {@code rowBudget} rows in one transaction. Restart at zero after each completed
   * pass: allocation order is not commit order, and skipped leases must be revisited.
   */
  public Result purgePage(final Duration minimumAge, final long afterId, final int rowBudget) {
    validate(minimumAge, afterId, rowBudget);
    final long cutoff = clock.instant().minus(minimumAge).toEpochMilli();
    return jdbi.inTransaction(
        TransactionIsolationLevel.READ_COMMITTED,
        handle -> sweep(handle, cutoff, afterId, rowBudget));
  }

  /**
   * Examines one page of facts that still have consumer rows. Rows another sweeper holds are
   * skipped, and the cursor still moves past them, so overlapping sweepers split the work.
   */
  private static Result sweep(
      final Handle handle, final long cutoff, final long afterId, final int rowBudget) {
    final List<Long> page = pendingPage(handle, afterId);
    final Progress progress = new Progress(afterId, rowBudget);
    for (final Candidate candidate : lockUnclaimed(handle, page)) {
      if (candidate.eligible(cutoff) && !settle(handle, candidate, progress)) {
        return progress.result(false);
      }
      progress.cursor = candidate.id();
    }
    progress.cursor = page.isEmpty() ? afterId : page.getLast();
    return progress.result(page.size() < SCAN_PAGE_SIZE);
  }

  /**
   * Purges a disposable fact, or archives a locator anchor by deleting its completed consumers so
   * later passes never scan it again. Returns false when the row budget is exhausted.
   */
  private static boolean settle(
      final Handle handle, final Candidate candidate, final Progress progress) {
    if (candidate.kind() == Kind.ENTITY && !compactOlderAnchors(handle, candidate, progress)) {
      return false;
    }
    return disposable(handle, candidate)
        ? purge(handle, candidate, progress)
        : archive(handle, candidate, progress);
  }

  private static boolean archive(
      final Handle handle, final Candidate candidate, final Progress progress) {
    if (progress.remaining() < candidate.consumers()) {
      return false;
    }
    progress.consumersDeleted +=
        handle
            .createUpdate(
                "DELETE FROM metadata_projection_consumer WHERE mutationId = :id AND completed = TRUE")
            .bind("id", candidate.id())
            .execute();
    return true;
  }

  /**
   * An archived anchor is never revisited, so a newer fact for the same entity retires the older
   * archived anchors whose locators it carries itself. Older-only deletion keeps compaction
   * acyclic. If the covered anchors do not fit the budget, the fact stays pending for a later pass.
   */
  private static boolean compactOlderAnchors(
      final Handle handle, final Candidate candidate, final Progress progress) {
    final int available = progress.remaining() - candidate.consumers() - 1;
    if (available < 0) {
      return false;
    }
    final List<Long> covered = coveredOlderAnchors(handle, candidate, available + 1);
    final List<Long> page = covered.subList(0, Math.min(covered.size(), available));
    if (!page.isEmpty()) {
      progress.mutationsDeleted +=
          handle
              .createUpdate("DELETE FROM metadata_projection_mutation WHERE id IN (<ids>)")
              .bindList("ids", page)
              .execute();
    }
    return covered.size() <= available;
  }

  private static List<Long> coveredOlderAnchors(
      final Handle handle, final Candidate candidate, final int limit) {
    return handle
        .createQuery(
            """
        SELECT older.id FROM metadata_projection_mutation older
        WHERE older.entityType = :entityType AND older.entityId = :entityId AND older.id < :id
          AND older.mutationType = :kind AND older.formatVersion = 1
          AND NOT EXISTS (SELECT 1 FROM metadata_projection_consumer c WHERE c.mutationId = older.id)
          AND (older.beforeFqnHash IS NULL OR older.beforeFqnHash IN (:before, :after))
          AND (older.afterFqnHash IS NULL OR older.afterFqnHash IN (:before, :after))
        ORDER BY older.id LIMIT :limit
        """)
        .bind("entityType", candidate.locators().entityType())
        .bind("entityId", candidate.locators().entityId())
        .bind("id", candidate.id())
        .bind("kind", Kind.ENTITY.name())
        .bind("before", candidate.locators().beforeHash())
        .bind("after", candidate.locators().afterHash())
        .bind("limit", limit)
        .mapTo(Long.class)
        .list();
  }

  /** Archived anchors have no consumer rows, so a pass never rescans the facts it kept. */
  private static List<Long> pendingPage(final Handle handle, final long afterId) {
    return handle
        .createQuery(
            """
        SELECT DISTINCT mutationId FROM metadata_projection_consumer
        WHERE mutationId > :after ORDER BY mutationId LIMIT :limit
        """)
        .bind("after", afterId)
        .bind("limit", SCAN_PAGE_SIZE)
        .mapTo(Long.class)
        .list();
  }

  private static List<Candidate> lockUnclaimed(final Handle handle, final List<Long> page) {
    if (page.isEmpty()) {
      return List.of();
    }
    return handle
        .createQuery(
            """
        SELECT m.id, m.mutationType, m.formatVersion, m.createdAt, m.operation,
          m.entityType, m.entityId, m.beforeFqnHash, m.afterFqnHash,
          (SELECT COUNT(*) FROM metadata_projection_consumer c WHERE c.mutationId = m.id) AS consumers,
          (SELECT COUNT(*) FROM metadata_projection_consumer c WHERE c.mutationId = m.id AND c.completed = FALSE) AS incomplete
        FROM metadata_projection_mutation m WHERE m.id IN (<ids>)
        ORDER BY m.id FOR UPDATE OF m SKIP LOCKED
        """)
        .bindList("ids", page)
        .map(
            (row, context) ->
                new Candidate(
                    row.getLong("id"),
                    kind(row.getString("mutationType")),
                    row.getInt("formatVersion"),
                    row.getLong("createdAt"),
                    new Obligations(row.getInt("consumers"), row.getInt("incomplete")),
                    Locators.of(row)))
        .list();
  }

  private static Kind kind(final String name) {
    return Arrays.stream(Kind.values())
        .filter(kind -> kind.name().equals(name))
        .findFirst()
        .orElse(null);
  }

  private static boolean disposable(final Handle handle, final Candidate candidate) {
    return switch (candidate.kind()) {
      case ENTITY -> candidate.locators().addNoFormerLocator()
          || hasLaterLocatorAnchor(handle, candidate.id());
        // Prefix rewrites are the only record of descendants' former names.
      case ENTITY_PREFIX -> false;
      case RELATIONSHIPS, TAG_USAGE, FIELD_RELATIONSHIPS, EXTENSIONS -> true;
    };
  }

  private static boolean hasLaterLocatorAnchor(final Handle handle, final long id) {
    // Strictly increasing anchors make compaction acyclic even when sweepers overlap. Every
    // surviving anchor preserves both locators transitively, including old names of deleted assets.
    return handle
        .createQuery(
            """
        SELECT 1 FROM metadata_projection_mutation newer
        JOIN metadata_projection_mutation older ON older.id = :id
        WHERE newer.entityType = older.entityType AND newer.entityId = older.entityId
          AND newer.id > older.id AND newer.mutationType = :kind AND newer.formatVersion = 1
          AND (older.beforeFqnHash IS NULL OR older.beforeFqnHash = newer.beforeFqnHash OR older.beforeFqnHash = newer.afterFqnHash)
          AND (older.afterFqnHash IS NULL OR older.afterFqnHash = newer.beforeFqnHash OR older.afterFqnHash = newer.afterFqnHash)
        LIMIT 1
        """)
        .bind("id", id)
        .bind("kind", Kind.ENTITY.name())
        .mapTo(Integer.class)
        .findOne()
        .isPresent();
  }

  private static boolean purge(
      final Handle handle, final Candidate candidate, final Progress progress) {
    final int parentRows = candidate.consumers() + 1;
    if (progress.remaining() < parentRows) {
      return false;
    }
    final SnapshotPage snapshots =
        deleteSnapshots(handle, candidate, progress.remaining() - parentRows);
    progress.snapshotsDeleted += snapshots.deleted();
    if (!snapshots.complete()) {
      return false;
    }
    progress.consumersDeleted +=
        handle
            .createUpdate(
                "DELETE FROM metadata_projection_consumer WHERE mutationId = :id AND completed = TRUE")
            .bind("id", candidate.id())
            .execute();
    progress.mutationsDeleted +=
        handle
            .createUpdate("DELETE FROM metadata_projection_mutation WHERE id = :id")
            .bind("id", candidate.id())
            .execute();
    return true;
  }

  private static SnapshotPage deleteSnapshots(
      final Handle handle, final Candidate candidate, final int limit) {
    final String table = snapshotTable(candidate.kind());
    if (table == null) {
      return new SnapshotPage(0, true);
    }
    final List<Long> ids =
        handle
            .createQuery(
                "SELECT id FROM " + table + " WHERE mutationId = :id ORDER BY id LIMIT :limit")
            .bind("id", candidate.id())
            .bind("limit", limit + 1)
            .mapTo(Long.class)
            .list();
    final List<Long> page = ids.subList(0, Math.min(ids.size(), limit));
    final int deleted =
        page.isEmpty()
            ? 0
            : handle
                .createUpdate("DELETE FROM " + table + " WHERE id IN (<ids>)")
                .bindList("ids", page)
                .execute();
    return new SnapshotPage(deleted, ids.size() <= limit);
  }

  private static String snapshotTable(final Kind kind) {
    return switch (kind) {
      case ENTITY, ENTITY_PREFIX -> null;
      case RELATIONSHIPS -> "metadata_projection_relationship";
      case TAG_USAGE -> "metadata_projection_tag_usage";
      case FIELD_RELATIONSHIPS -> "metadata_projection_field_relationship";
      case EXTENSIONS -> "metadata_projection_extension";
    };
  }

  private static void validate(final Duration minimumAge, final long afterId, final int rowBudget) {
    if (minimumAge == null || minimumAge.isNegative() || minimumAge.isZero()) {
      throw new IllegalArgumentException("Retention requires a positive minimum age");
    }
    if (afterId < 0 || rowBudget < MAX_CONSUMERS + 2 || rowBudget > MAX_ROW_BUDGET) {
      throw new IllegalArgumentException(
          "Retention requires a nonnegative cursor and a row budget of "
              + (MAX_CONSUMERS + 2)
              + " to "
              + MAX_ROW_BUDGET);
    }
  }

  public record Result(
      long nextCursor,
      boolean endOfPass,
      int mutationsDeleted,
      int snapshotsDeleted,
      int consumersDeleted) {}

  private record Candidate(
      long id, Kind kind, int version, long createdAt, Obligations obligations, Locators locators) {
    boolean eligible(final long cutoff) {
      return kind != null && version == 1 && createdAt < cutoff && obligations.settled();
    }

    int consumers() {
      return obligations.consumers();
    }
  }

  private record Obligations(int consumers, int incomplete) {
    boolean settled() {
      return incomplete == 0 && consumers > 0 && consumers <= MAX_CONSUMERS;
    }
  }

  private record Locators(
      String entityType, String entityId, String operation, String beforeHash, String afterHash) {
    static Locators of(final ResultSet row) throws SQLException {
      return new Locators(
          row.getString("entityType"),
          row.getString("entityId"),
          row.getString("operation"),
          row.getString("beforeFqnHash"),
          row.getString("afterFqnHash"));
    }

    /**
     * An insert, an unchanged-name update or a delete of a missing row records no former locator.
     * The entity's current row resolves its name; a later rename, delete or prefix rewrite records
     * its own former locator. Only facts that retire a locator need to outlive their consumers.
     */
    boolean addNoFormerLocator() {
      return beforeHash == null
          || (EntityMutation.Operation.UPSERT.name().equals(operation)
              && beforeHash.equals(afterHash));
    }
  }

  private record SnapshotPage(int deleted, boolean complete) {}

  private static final class Progress {
    private final int budget;
    private long cursor;
    private int mutationsDeleted;
    private int snapshotsDeleted;
    private int consumersDeleted;

    private Progress(final long afterId, final int budget) {
      cursor = afterId;
      this.budget = budget;
    }

    private int remaining() {
      return budget - mutationsDeleted - snapshotsDeleted - consumersDeleted;
    }

    private Result result(final boolean endOfPass) {
      return new Result(
          endOfPass ? 0 : cursor, endOfPass, mutationsDeleted, snapshotsDeleted, consumersDeleted);
    }
  }
}
