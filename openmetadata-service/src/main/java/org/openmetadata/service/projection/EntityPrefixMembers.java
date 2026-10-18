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

import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.projection.ProjectionOwnerLookup.Source;

/**
 * Pages the committed descendants of a prefix rewrite with the locator each had before it. The set
 * is a superset: rows already under the new prefix are included, and expansion refreshes by ID.
 */
public final class EntityPrefixMembers {
  private static final int MAX_PAGE_SIZE = 1000;
  private final Jdbi jdbi;
  private final String fqnExpression;

  public EntityPrefixMembers(final Jdbi jdbi, final ConnectionType dialect) {
    this.jdbi = Objects.requireNonNull(jdbi);
    this.fqnExpression = EntityLocatorQuery.fqnExpression(Objects.requireNonNull(dialect));
  }

  /**
   * Keyset-paged by the source's hash column, so every page is one bounded index range read even
   * for very large subtrees. Pass the last member's hash to continue, or null for the first page.
   */
  public List<Member> page(
      final Source source,
      final EntityPrefixMutation rewrite,
      final String afterHash,
      final int limit) {
    validate(source, rewrite, limit);
    return jdbi.withHandle(
        handle ->
            List.copyOf(
                handle
                    .createQuery(query(source))
                    .bind("pattern", rewrite.newPrefixHash() + Entity.SEPARATOR + "%")
                    .bind("after", afterHash == null ? "" : afterHash)
                    .bind("limit", limit)
                    .map(
                        (row, context) -> {
                          final String afterFqn = row.getString("fqn");
                          return new Member(
                              UUID.fromString(row.getString("id")),
                              row.getString("hash"),
                              rewrite.beforeFqnOf(afterFqn),
                              afterFqn);
                        })
                    .list()));
  }

  private String query(final Source source) {
    final String hash = source.hashColumn();
    return "SELECT id, "
        + fqnExpression
        + " AS fqn, "
        + hash
        + " AS hash FROM "
        + source.table()
        + " WHERE "
        + hash
        + " LIKE :pattern AND "
        + hash
        + " > :after ORDER BY "
        + hash
        + " LIMIT :limit";
  }

  private static void validate(
      final Source source, final EntityPrefixMutation rewrite, final int limit) {
    if (!source.entityType().equals(rewrite.entityType())) {
      throw new IllegalArgumentException(
          "Prefix rewrite for " + rewrite.entityType() + " cannot page " + source.entityType());
    }
    if (limit < 1 || limit > MAX_PAGE_SIZE) {
      throw new IllegalArgumentException("Prefix member pages require 1 to 1000 rows");
    }
  }

  /** {@code beforeFqn} is null when the stored locator is not under the rewritten prefix. */
  public record Member(UUID id, String hash, String beforeFqn, String afterFqn) {}
}
