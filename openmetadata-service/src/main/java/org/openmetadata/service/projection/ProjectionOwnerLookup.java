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

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.Entity;
import org.openmetadata.service.projection.MutationFacts.Kind;

/** Resolves retained hashes from current catalog rows and transactional rename/deletion history. */
public final class ProjectionOwnerLookup {
  static final int MAX_RESOLVED_HASHES = 1000;
  private static final int MAX_HASH_LENGTH = 768;
  private final Jdbi jdbi;

  public ProjectionOwnerLookup(final Jdbi jdbi) {
    this.jdbi = Objects.requireNonNull(jdbi);
  }

  /**
   * Returns candidate owners for one repository's declared source. Empty results are unresolved,
   * not proof of delivery. Historical facts must outlive the dependency work that needs them.
   */
  public List<Owner> page(
      final Source source, final String targetHash, final UUID after, final int limit) {
    validateLimit(limit);
    final List<String> hashes = hashes(targetHash, source.ownsNestedFields());
    return jdbi.withHandle(
        handle ->
            List.copyOf(
                handle
                    .createQuery(ownerQuery(source))
                    .bind("entityType", source.entityType())
                    .bind("entityKind", Kind.ENTITY.name())
                    .bindList("hashes", withPrefixRewrites(handle, source.entityType(), hashes))
                    .bind("after", after == null ? "" : after.toString())
                    .bind("limit", limit)
                    .map(
                        (row, context) ->
                            new Owner(
                                UUID.fromString(row.getString("entityId")), source.entityType()))
                    .list()));
  }

  private static String ownerQuery(final Source source) {
    return "SELECT entityId FROM (SELECT CAST(id AS CHAR(36)) AS entityId FROM "
        + source.table()
        + " WHERE "
        + source.hashColumn()
        + " IN (<hashes>) UNION "
        + "SELECT CAST(entityId AS CHAR(36)) FROM metadata_projection_mutation WHERE mutationType = :entityKind AND entityType = :entityType AND beforeFqnHash IN (<hashes>) UNION "
        + "SELECT CAST(entityId AS CHAR(36)) FROM metadata_projection_mutation WHERE mutationType = :entityKind AND entityType = :entityType AND afterFqnHash IN (<hashes>)) owners "
        + "WHERE entityId > :after ORDER BY entityId LIMIT :limit";
  }

  /**
   * Adds the hashes a locator acquired through later descendant prefix rewrites. A hop applies only
   * rewrites allocated after the one that produced it: a rewrite that moved a subtree waited for the
   * earlier rewrite's commit before inserting its own fact. Repeated renames therefore terminate.
   */
  static List<String> withPrefixRewrites(
      final Handle handle, final String entityType, final List<String> hashes) {
    final Set<String> resolved = new LinkedHashSet<>(hashes);
    final Deque<Hop> pending = new ArrayDeque<>();
    hashes.forEach(hash -> pending.addLast(new Hop(hash, 0)));
    while (!pending.isEmpty()) {
      final Hop hop = pending.removeFirst();
      for (final PrefixRewrite rewrite : rewrites(handle, entityType, hop)) {
        final String rewritten = rewrite.apply(hop.hash());
        if (resolved.add(rewritten)) {
          requireBounded(resolved);
          pending.addLast(new Hop(rewritten, rewrite.id()));
        }
      }
    }
    return List.copyOf(resolved);
  }

  private static List<PrefixRewrite> rewrites(
      final Handle handle, final String entityType, final Hop hop) {
    final List<String> ancestors = ancestors(hop.hash());
    if (ancestors.isEmpty()) {
      return List.of();
    }
    return handle
        .createQuery(
            """
        SELECT id, beforeFqnHash, afterFqnHash FROM metadata_projection_mutation
        WHERE mutationType = :prefixKind AND entityType = :entityType
          AND beforeFqnHash IN (<ancestors>) AND id > :after
        ORDER BY id LIMIT :limit
        """)
        .bind("prefixKind", Kind.ENTITY_PREFIX.name())
        .bind("entityType", entityType)
        .bindList("ancestors", ancestors)
        .bind("after", hop.afterId())
        .bind("limit", MAX_RESOLVED_HASHES)
        .map(
            (row, context) ->
                new PrefixRewrite(
                    row.getLong("id"),
                    row.getString("beforeFqnHash"),
                    row.getString("afterFqnHash")))
        .list();
  }

  /** Strict ancestors at segment boundaries; a prefix rewrite never changes its own root. */
  static List<String> ancestors(final String hash) {
    final List<String> ancestors = new ArrayList<>();
    for (int end = hash.indexOf(Entity.SEPARATOR);
        end >= 0;
        end = hash.indexOf(Entity.SEPARATOR, end + 1)) {
      ancestors.add(hash.substring(0, end));
    }
    return List.copyOf(ancestors);
  }

  private static void requireBounded(final Set<String> resolved) {
    if (resolved.size() > MAX_RESOLVED_HASHES) {
      throw new IllegalStateException(
          "Owner lookup exceeded " + MAX_RESOLVED_HASHES + " historical locators");
    }
  }

  static List<String> hashes(final String targetHash, final boolean nested) {
    if (targetHash == null
        || targetHash.length() > MAX_HASH_LENGTH
        || !targetHash.matches("[0-9a-f]{32}(\\.[0-9a-f]{32})*")) {
      throw new IllegalArgumentException("Owner lookup requires a valid FQN hash");
    }
    final List<String> hashes = nested ? new ArrayList<>(ancestors(targetHash)) : new ArrayList<>();
    hashes.add(targetHash);
    return List.copyOf(hashes);
  }

  private static void validateLimit(final int limit) {
    if (limit < 1 || limit > 1000) {
      throw new IllegalArgumentException("Owner lookup pages require 1 to 1000 rows");
    }
  }

  /** Supplied by the owning repository's dependency rule, not inferred from an arbitrary FQN. */
  public record Source(
      String entityType, String table, String hashColumn, boolean ownsNestedFields) {
    public Source {
      if (entityType == null
          || entityType.isBlank()
          || entityType.length() > 128
          || !identifier(table)
          || !identifier(hashColumn)) {
        throw new IllegalArgumentException(
            "Owner source requires an entity type and SQL identifiers");
      }
    }

    private static boolean identifier(final String value) {
      return value != null && value.matches("[a-zA-Z][a-zA-Z0-9_]*");
    }
  }

  public record Owner(UUID id, String entityType) {}

  private record Hop(String hash, long afterId) {}

  private record PrefixRewrite(long id, String beforeHash, String afterHash) {
    String apply(final String hash) {
      return afterHash + hash.substring(beforeHash.length());
    }
  }
}
