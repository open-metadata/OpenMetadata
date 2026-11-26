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

package org.openmetadata.it.tests.security.scale;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * Statement counts and rows examined for the credential statements, from the database's own
 * statement statistics: {@code performance_schema} on MySQL, {@code pg_stat_statements} on Postgres
 * when the container loads it. Where neither is readable the snapshot is empty and {@link #source}
 * says why, so a report never presents the verifier's counters as the database's.
 */
final class DatabaseStatementStats {
  private static final String MYSQL =
      "SELECT DIGEST_TEXT AS text, COUNT_STAR AS calls, SUM_ROWS_EXAMINED AS examined,"
          + " SUM_ROWS_SENT AS sent FROM performance_schema.events_statements_summary_by_digest"
          + " WHERE DIGEST_TEXT LIKE '%user_tokens%' AND DIGEST_TEXT LIKE '%nameHash%'";
  private static final String POSTGRES =
      "SELECT query AS text, calls, 0 AS examined, rows AS sent FROM pg_stat_statements"
          + " WHERE query ILIKE '%user_tokens%' AND query ILIKE '%namehash%'";

  private final Jdbi jdbi;
  // The suite runs one database kind, named by the same property the bootstrap reads.
  private final ConnectionType type =
      "mysql".equalsIgnoreCase(System.getProperty("databaseType", "postgres"))
          ? ConnectionType.MYSQL
          : ConnectionType.POSTGRES;

  DatabaseStatementStats(Jdbi jdbi) {
    this.jdbi = jdbi;
  }

  /** Cumulative figures of one statement shape. */
  record Digest(long calls, long rowsExamined, long rowsSent) {
    Digest minus(Digest earlier) {
      return new Digest(
          calls - earlier.calls, rowsExamined - earlier.rowsExamined, rowsSent - earlier.rowsSent);
    }
  }

  /** Where the figures come from, or why there are none. */
  String source() {
    return snapshot().map(ignored -> sourceName()).orElse("unavailable: " + sourceName());
  }

  private String sourceName() {
    return type == ConnectionType.MYSQL ? "performance_schema" : "pg_stat_statements";
  }

  /** Empty when the statistics cannot be read. */
  Optional<Map<String, Digest>> snapshot() {
    Optional<Map<String, Digest>> result;
    try {
      result = Optional.of(jdbi.withHandle(this::read));
    } catch (RuntimeException unreadable) {
      result = Optional.empty();
    }
    return result;
  }

  /** Per statement text, what happened between two snapshots. */
  static Map<String, Digest> delta(Map<String, Digest> before, Map<String, Digest> after) {
    Map<String, Digest> change = new HashMap<>();
    after.forEach(
        (text, digest) -> change.put(text, digest.minus(before.getOrDefault(text, ZERO))));
    return change;
  }

  private static final Digest ZERO = new Digest(0, 0, 0);

  /** The statement text carries the full-read columns only for the full read. */
  static boolean isFullRead(String text) {
    return text.toLowerCase(Locale.ROOT).contains("userjson");
  }

  private Map<String, Digest> read(Handle handle) {
    String sql = type == ConnectionType.MYSQL ? MYSQL : POSTGRES;
    Map<String, Digest> digests = new HashMap<>();
    List<Map<String, Object>> rows = handle.createQuery(sql).mapToMap().list();
    for (Map<String, Object> row : rows) {
      digests.put(
          String.valueOf(row.get("text")),
          new Digest(number(row, "calls"), number(row, "examined"), number(row, "sent")));
    }
    return digests;
  }

  private static long number(Map<String, Object> row, String key) {
    Object value = row.get(key);
    return value == null ? 0 : ((Number) value).longValue();
  }
}
