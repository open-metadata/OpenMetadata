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

package org.openmetadata.service.fernet.rotation;

import io.lettuce.core.api.sync.RedisCommands;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.fernet.KeyRing;
import org.openmetadata.service.fernet.rotation.SqlCatalog.SqlTable;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/** Reaches the package-private stores and sweep of the rotation from integration tests. */
public final class RotationStoresTestSupport {
  private RotationStoresTestSupport() {}

  /** A column as the catalog sees it; {@code kind} is JSON, JSONB, TEXT or BYTES. */
  public record Column(String name, String kind) {}

  public record Table(String name, List<String> primaryKey, List<Column> columns) {}

  /** A stored value as a store returned it. */
  public record Value(String location, String column, List<Object> key, String text) {}

  /** One pass over stores: values holding tokens, token counts by outcome name, problem lines. */
  public record Pass(
      long values, boolean readable, Map<String, Long> counts, List<String> problems) {
    public long count(String outcome) {
      return counts.getOrDefault(outcome, 0L);
    }
  }

  public static Optional<Table> catalogTable(Jdbi jdbi, ConnectionType type, String table) {
    return jdbi.withHandle(
        handle ->
            SqlCatalog.read(handle, Dialect.of(type)).stream()
                .filter(it -> it.name().equalsIgnoreCase(table))
                .findFirst()
                .map(RotationStoresTestSupport::view));
  }

  /** Every value of {@code table} that holds the text {@code fernet:}, as the store pages them. */
  public static List<Value> candidates(Jdbi jdbi, ConnectionType type, String table) {
    return jdbi.withHandle(
        handle -> {
          try (Stream<StoredText> candidates = store(handle, type, table).candidates()) {
            return candidates.map(RotationStoresTestSupport::view).toList();
          }
        });
  }

  /** The versions the entity_extension store reads for the entities of {@code idTable}. */
  public static List<Value> versionsOf(Jdbi jdbi, ConnectionType type, String idTable) {
    return jdbi.withHandle(
        handle -> {
          Dialect dialect = Dialect.of(type);
          List<SqlTable> catalog = SqlCatalog.read(handle, dialect);
          SqlTable versions = named(catalog, VersionsStore.TABLE);
          VersionsStore store =
              new VersionsStore(handle, dialect, versions, List.of(named(catalog, idTable)));
          try (Stream<StoredText> candidates = store.candidates()) {
            return candidates.map(RotationStoresTestSupport::view).toList();
          }
        });
  }

  /** Runs discovery on {@code handle}; throws {@link FernetKeyRotation.Refused} when it refuses. */
  public static int discoverStores(
      Handle handle, ConnectionType type, FernetKeyRotation.Scope scope) {
    return TokenStores.discover(handle, Dialect.of(type), Optional.empty(), scope).stores().size();
  }

  /** Every value the stores of a default discovery return, Redis left out. */
  public static List<Value> defaultReadCandidates(Jdbi jdbi, ConnectionType type) {
    return jdbi.withHandle(
        handle ->
            TokenStores.discover(
                    handle,
                    Dialect.of(type),
                    Optional.empty(),
                    FernetKeyRotation.Scope.SKIP_LARGE_TABLES)
                .stores()
                .stream()
                .flatMap(TokenStore::candidates)
                .map(RotationStoresTestSupport::view)
                .toList());
  }

  private static SqlTable named(List<SqlTable> catalog, String name) {
    return catalog.stream()
        .filter(it -> it.name().equalsIgnoreCase(name))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("Not in the catalog: " + name));
  }

  public static Pass rewrite(Jdbi jdbi, ConnectionType type, String table, KeyRing keys) {
    return jdbi.withHandle(
        handle -> view(FernetSweep.rewrite(List.of(store(handle, type, table)), keys)));
  }

  public static Pass check(Jdbi jdbi, ConnectionType type, String table, KeyRing keys) {
    return jdbi.withHandle(
        handle -> view(FernetSweep.check(List.of(store(handle, type, table)), keys)));
  }

  /** Writes {@code replacement} where {@code read} was, only if the cell still reads as it did. */
  public static boolean compareAndSet(
      Jdbi jdbi, ConnectionType type, String table, Value read, String replacement) {
    return jdbi.withHandle(
        handle -> {
          SqlTableStore store = store(handle, type, table);
          return store.compareAndSet(stored(read, store.table()), replacement);
        });
  }

  public static Pass rewriteRedis(
      RedisCommands<String, String> commands, String prefix, KeyRing keys) {
    return view(FernetSweep.rewrite(List.of(new RedisTokenStore(commands, List.of(prefix))), keys));
  }

  public static Pass checkRedis(
      RedisCommands<String, String> commands, String prefix, KeyRing keys) {
    return view(FernetSweep.check(List.of(new RedisTokenStore(commands, List.of(prefix))), keys));
  }

  /** The Redis store a run builds for the configured {@code cacheConfig.redis.keyspace}. */
  public static Pass rewriteRedisKeyspace(
      RedisCommands<String, String> commands, String keyspace, KeyRing keys) {
    return view(
        FernetSweep.rewrite(
            List.of(new RedisTokenStore(commands, FernetKeyRotation.redisPrefixes(keyspace))),
            keys));
  }

  private static SqlTableStore store(Handle handle, ConnectionType type, String table) {
    Dialect dialect = Dialect.of(type);
    SqlTable sqlTable =
        SqlCatalog.read(handle, dialect).stream()
            .filter(it -> it.name().equalsIgnoreCase(table))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Not in the catalog: " + table));
    return new SqlTableStore(handle, dialect, sqlTable);
  }

  private static StoredText stored(Value value, SqlTable table) {
    return StoredText.writable(
        new Location(table.name(), value.column(), table.primaryKey(), value.key()),
        value.text(),
        table.column(value.column()).orElseThrow().type().encoding());
  }

  private static Table view(SqlTable table) {
    return new Table(
        table.name(),
        table.primaryKey(),
        table.columns().stream().map(c -> new Column(c.name(), c.type().name())).toList());
  }

  private static Value view(StoredText value) {
    return new Value(
        value.at().printable(), value.at().container(), value.at().keyValues(), value.text());
  }

  private static Pass view(FernetSweep.Result result) {
    StoreTally tally = result.tallies().getFirst();
    return new Pass(
        tally.values(),
        tally.readable(),
        tally.counts().entrySet().stream()
            .collect(Collectors.toMap(entry -> entry.getKey().name(), Map.Entry::getValue)),
        result.problems().shown().stream().map(Problem::line).toList());
  }
}
