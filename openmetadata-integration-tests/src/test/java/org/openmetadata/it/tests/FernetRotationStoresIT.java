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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.macasaet.fernet.Key;
import io.lettuce.core.RedisClient;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.sync.RedisCommands;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.stream.Collectors;
import org.apache.commons.codec.digest.DigestUtils;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.PreparedBatch;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.KeyRing;
import org.openmetadata.service.fernet.Opening;
import org.openmetadata.service.fernet.rotation.FernetKeyRotation.Refused;
import org.openmetadata.service.fernet.rotation.FernetKeyRotation.Scope;
import org.openmetadata.service.fernet.rotation.RotationStoresTestSupport;
import org.openmetadata.service.fernet.rotation.RotationStoresTestSupport.Column;
import org.openmetadata.service.fernet.rotation.RotationStoresTestSupport.Pass;
import org.openmetadata.service.fernet.rotation.RotationStoresTestSupport.Table;
import org.openmetadata.service.fernet.rotation.RotationStoresTestSupport.Value;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.testcontainers.containers.JdbcDatabaseContainer;

/**
 * The rotation's stores against the suite's database and Redis. Every test uses tables and keys of
 * its own, removes them when it ends, and leaves no token behind.
 */
// A discovery reads the whole schema, so the tables other tests of this class create and drop must
// not come and go while it runs.
@Execution(ExecutionMode.SAME_THREAD)
class FernetRotationStoresIT {
  private static final String NEW_KEY = Key.generateKey().serialise();
  private static final String OLD_KEY = Key.generateKey().serialise();
  private static final KeyRing NEW = KeyRing.parse(NEW_KEY);
  private static final KeyRing OLD = KeyRing.parse(OLD_KEY);
  private static final KeyRing RING = KeyRing.parse(NEW_KEY + "," + OLD_KEY);
  private static final int ROWS_OVER_THREE_PAGES = 2205;
  private static final long TTL_MILLIS = 600_000L;

  private final Jdbi jdbi = TestSuiteBootstrap.getJdbi();
  private final ConnectionType type = TestSuiteBootstrap.getConnectionType();

  @Test
  void theCatalogKeepsTokenColumnsAndLeavesOutGeneratedAndShortOnes() {
    withKeyedTable(
        table -> {
          Table seen = RotationStoresTestSupport.catalogTable(jdbi, type, table).orElseThrow();

          assertEquals(List.of("a", "b"), seen.primaryKey());
          assertEquals(
              List.of(
                  new Column("doc", type == ConnectionType.MYSQL ? "JSON" : "JSONB"),
                  new Column("note", "TEXT"),
                  new Column("bin", "BYTES"),
                  new Column("defaulted", type == ConnectionType.MYSQL ? "JSON" : "JSONB")),
              seen.columns());
        });
  }

  @Test
  void pagingOverACompositeKeyVisitsEveryRowOnceAndRewritesEachOfThem() {
    withKeyedTable(
        table -> {
          jdbi.useHandle(
              handle -> {
                PreparedBatch batch =
                    handle.prepareBatch(
                        "INSERT INTO " + table + " (a, b, note) VALUES (:a, :b, :note)");
                for (int i = 0; i < ROWS_OVER_THREE_PAGES; i++) {
                  batch
                      .bind("a", "k" + (i % 7))
                      .bind("b", i)
                      .bind("note", OLD.seal("row " + i))
                      .add();
                }
                batch.execute();
              });

          List<Value> candidates = RotationStoresTestSupport.candidates(jdbi, type, table);
          Set<List<Object>> keys = new HashSet<>();
          candidates.forEach(
              value ->
                  keys.add(
                      List.of(
                          String.valueOf(value.key().get(0)), String.valueOf(value.key().get(1)))));
          assertEquals(ROWS_OVER_THREE_PAGES, candidates.size(), "every row once");
          assertEquals(ROWS_OVER_THREE_PAGES, keys.size(), "no row twice");

          Pass rewrite = RotationStoresTestSupport.rewrite(jdbi, type, table, RING);
          assertEquals(ROWS_OVER_THREE_PAGES, rewrite.count("REKEYED"));
          assertEquals(0, rewrite.count("CONTENDED"));
          List<String> notes =
              jdbi.withHandle(
                  h -> h.createQuery("SELECT note FROM " + table).mapTo(String.class).list());
          assertEquals(ROWS_OVER_THREE_PAGES, notes.size());
          for (String note : notes) {
            assertTrue(NEW.open(note) instanceof Opening.Primary, "opens with the new key alone");
          }
        });
  }

  @Test
  void jsonTextAndBinaryValuesAreRewrittenInPlaceAndASecondRunChangesNothing() {
    withKeyedTable(
        table -> {
          String docToken = OLD.seal("db-password");
          String noteToken = OLD.seal("note-secret");
          String binToken = OLD.seal("0123456789012345678901234567890123456789");
          String defaultedToken = OLD.seal("defaulted-secret");
          byte[] bin =
              ("\u0000\u0005" + binToken + "p\u0000\u0004rest")
                  .getBytes(StandardCharsets.ISO_8859_1);
          jdbi.useHandle(
              handle ->
                  handle
                      .createUpdate(
                          "INSERT INTO "
                              + table
                              + " (a, b, doc, note, bin, defaulted) VALUES (:a, :b, CAST(:doc AS "
                              + jsonType()
                              + "), :note, :bin, CAST(:defaulted AS "
                              + jsonType()
                              + "))")
                      .bind("a", "one")
                      .bind("b", 1)
                      .bind("doc", "{\"password\":\"" + docToken + "\",\"n\":1}")
                      .bind("note", "x " + noteToken + " y")
                      .bind("bin", bin)
                      .bind("defaulted", "{\"k\":\"" + defaultedToken + "\"}")
                      .execute());

          Pass first = RotationStoresTestSupport.rewrite(jdbi, type, table, RING);
          assertEquals(4, first.count("REKEYED"));
          assertEquals(4, first.values());
          assertEquals(
              new Opening.Primary("defaulted-secret"),
              NEW.open(JsonUtils.readTree(readText(table, "defaulted")).get("k").textValue()));

          JsonNode doc = JsonUtils.readTree(readText(table, "doc"));
          assertEquals(1, doc.get("n").intValue());
          assertEquals(
              new Opening.Primary("db-password"), NEW.open(doc.get("password").textValue()));
          String note = readText(table, "note");
          assertTrue(note.startsWith("x ") && note.endsWith(" y"));
          assertEquals(
              new Opening.Primary("note-secret"), NEW.open(note.substring(2, note.length() - 2)));
          byte[] rewrittenBin = readBytes(table);
          assertEquals(bin.length, rewrittenBin.length);
          String binText = new String(rewrittenBin, StandardCharsets.ISO_8859_1);
          assertTrue(binText.startsWith("\u0000\u0005") && binText.endsWith("p\u0000\u0004rest"));
          assertEquals(
              new Opening.Primary("0123456789012345678901234567890123456789"),
              NEW.open(binText.substring(2, 2 + binToken.length())));

          List<Value> snapshot = RotationStoresTestSupport.candidates(jdbi, type, table);
          Pass second = RotationStoresTestSupport.rewrite(jdbi, type, table, RING);
          assertEquals(0, second.count("REKEYED"));
          assertEquals(4, second.count("PRIMARY"));
          assertEquals(snapshot, RotationStoresTestSupport.candidates(jdbi, type, table));
          Pass check = RotationStoresTestSupport.check(jdbi, type, table, RING);
          assertEquals(4, check.count("PRIMARY"));
          assertEquals(List.of(), check.problems());
        });
  }

  @Test
  void aCompareAndSetThatLosesToAnOutOfBandChangeReturnsFalseAndLeavesTheOtherText() {
    withKeyedTable(
        table -> {
          jdbi.useHandle(
              handle ->
                  handle
                      .createUpdate(
                          "INSERT INTO " + table + " (a, b, note) VALUES ('one', 1, :note)")
                      .bind("note", OLD.seal("before"))
                      .execute());
          Value read = RotationStoresTestSupport.candidates(jdbi, type, table).getFirst();
          String outOfBand = "changed " + OLD.seal("after");
          jdbi.useHandle(
              handle ->
                  handle
                      .createUpdate(
                          "UPDATE " + table + " SET note = :note WHERE a = 'one' AND b = 1")
                      .bind("note", outOfBand)
                      .execute());

          boolean written =
              RotationStoresTestSupport.compareAndSet(jdbi, type, table, read, NEW.seal("before"));

          assertFalse(written);
          assertEquals(outOfBand, readText(table, "note"));
          Value current = RotationStoresTestSupport.candidates(jdbi, type, table).getFirst();
          assertTrue(
              RotationStoresTestSupport.compareAndSet(
                  jdbi, type, table, current, "changed " + NEW.seal("after")));
          assertEquals(
              new Opening.Primary("after"),
              NEW.open(readText(table, "note").substring("changed ".length())));
        });
  }

  @Test
  void versionsAreReadForATableWhoseIdIsNumeric() {
    String table = "fernet_it_numeric_id_" + suffix();
    String extension = "fernet-it-" + suffix();
    try {
      jdbi.useHandle(
          handle -> {
            handle.execute(
                "CREATE TABLE " + table + " (id bigint PRIMARY KEY, doc " + jsonType() + ")");
            handle.execute("INSERT INTO " + table + " (id) VALUES (7)");
            handle
                .createUpdate(
                    "INSERT INTO entity_extension (id, extension, jsonSchema, json)"
                        + " VALUES ('7', :extension, 'test', CAST(:json AS "
                        + jsonType()
                        + "))")
                .bind("extension", extension)
                .bind("json", "{\"password\":\"" + OLD.seal("version-secret") + "\"}")
                .execute();
          });
      List<Value> versions = RotationStoresTestSupport.versionsOf(jdbi, type, table);

      assertEquals(1, versions.size());
      assertEquals("entity_extension", versions.getFirst().location().split(" ")[0]);
      assertEquals(
          List.of("7", extension),
          versions.getFirst().key().stream().map(String::valueOf).toList());
    } finally {
      cleanupTableAndExtension(table, extension);
    }
  }

  @Test
  void theDefaultReadTakesVersionsOnlyOfTheEntitiesOfTheTablesRead() {
    String table = "fernet_it_entities_" + suffix();
    String extension = "fernet-it-" + suffix();
    String entityId = UUID.randomUUID().toString();
    String orphanId = UUID.randomUUID().toString();
    try {
      jdbi.useHandle(
          handle -> {
            handle.execute(
                "CREATE TABLE " + table + " (id varchar(36) PRIMARY KEY, doc " + jsonType() + ")");
            handle
                .createUpdate("INSERT INTO " + table + " (id) VALUES (:id)")
                .bind("id", entityId)
                .execute();
            for (String id : List.of(entityId, orphanId)) {
              handle
                  .createUpdate(
                      "INSERT INTO entity_extension (id, extension, jsonSchema, json)"
                          + " VALUES (:id, :extension, 'test', CAST(:json AS "
                          + jsonType()
                          + "))")
                  .bind("id", id)
                  .bind("extension", extension)
                  .bind("json", "{\"password\":\"" + OLD.seal("version-secret") + "\"}")
                  .execute();
            }
          });
      List<Value> read = RotationStoresTestSupport.defaultReadCandidates(jdbi, type);

      assertEquals(1, read.stream().filter(value -> isKey(value, entityId, extension)).count());
      assertEquals(0, read.stream().filter(value -> isKey(value, orphanId, extension)).count());
    } finally {
      cleanupTableAndExtension(table, extension);
    }
  }

  private void cleanupTableAndExtension(String table, String extension) {
    try {
      jdbi.useHandle(handle -> handle.execute("DROP TABLE IF EXISTS " + table));
    } finally {
      jdbi.useHandle(
          handle ->
              handle
                  .createUpdate("DELETE FROM entity_extension WHERE extension = :extension")
                  .bind("extension", extension)
                  .execute());
    }
  }

  @Test
  void aBlankKeyspaceIsScannedUnderTheEntityCachePrefixAndTheSessionOne() {
    assumeTrue(TestSuiteBootstrap.isRedisEnabled(), "the lane runs without Redis");
    String tail = ":fernet-it:" + suffix() + ":s";
    List<String> keys = List.of(tail, "om" + tail);
    withRedis(
        redis -> {
          try {
            for (String key : keys) {
              redis.set(key, "{\"omRefreshToken\":\"" + OLD.seal("refresh") + "\"}");
            }

            RotationStoresTestSupport.rewriteRedisKeyspace(redis, "", RING);

            for (String key : keys) {
              assertTrue(
                  NEW.open(JsonUtils.readTree(redis.get(key)).get("omRefreshToken").textValue())
                      instanceof Opening.Primary,
                  "rewritten under the new key: " + key);
            }
          } finally {
            redis.del(keys.toArray(String[]::new));
          }
        });
  }

  @Test
  void discoveryRefusesASchemaThatHoldsNoOpenMetadataTables() {
    String empty = "fernet_it_empty_" + suffix();
    boolean mysql = type == ConnectionType.MYSQL;
    jdbi.useHandle(
        handle -> {
          String original =
              mysql
                  ? handle.createQuery("SELECT DATABASE()").mapTo(String.class).one()
                  : handle.createQuery("SHOW search_path").mapTo(String.class).one();
          boolean created = createEmptySchema(handle, empty);
          assumeTrue(created, "the test user cannot create a " + (mysql ? "database" : "schema"));
          try {
            handle.execute(mysql ? "USE " + empty : "SET search_path TO " + empty);
            for (Scope scope : Scope.values()) {
              Refused refused =
                  assertThrows(
                      Refused.class,
                      () -> RotationStoresTestSupport.discoverStores(handle, type, scope));
              assertTrue(
                  refused
                      .getMessage()
                      .contains(
                          " is "
                              + empty
                              + ") has no entity_extension or openmetadata_settings table,"),
                  refused.getMessage());
            }
          } finally {
            handle.execute(mysql ? "USE " + original : "SET search_path TO " + original);
            dropEmptySchema(handle, empty);
          }
        });
  }

  // The MySQL test user owns no privilege on a new database, so the container's root creates it
  // and grants it to the test user.
  private boolean createEmptySchema(Handle handle, String name) {
    try {
      if (type == ConnectionType.MYSQL) {
        try (Connection root = rootConnection();
            Statement statement = root.createStatement()) {
          statement.execute("CREATE DATABASE " + name);
          statement.execute("GRANT ALL ON " + name + ".* TO 'test'@'%'");
        }
      } else {
        handle.execute("CREATE SCHEMA " + name);
      }
      return true;
    } catch (SQLException | RuntimeException e) {
      return false;
    }
  }

  private void dropEmptySchema(Handle handle, String name) {
    try {
      if (type == ConnectionType.MYSQL) {
        try (Connection root = rootConnection();
            Statement statement = root.createStatement()) {
          statement.execute("DROP DATABASE " + name);
        }
      } else {
        handle.execute("DROP SCHEMA " + name + " CASCADE");
      }
    } catch (SQLException e) {
      throw new IllegalStateException("could not drop " + name, e);
    }
  }

  private static Connection rootConnection() throws SQLException {
    JdbcDatabaseContainer<?> database =
        (JdbcDatabaseContainer<?>) TestSuiteBootstrap.getDatabaseContainer();
    return DriverManager.getConnection(database.getJdbcUrl(), "root", database.getPassword());
  }

  private static boolean isKey(Value value, String id, String extension) {
    return value.key().stream().map(String::valueOf).toList().equals(List.of(id, extension));
  }

  @Test
  void aTableWithoutAPrimaryKeyIsRewrittenInPlaceIncludingIdenticalRows() {
    String table = "fernet_it_nopk_" + suffix();
    jdbi.useHandle(handle -> handle.execute("CREATE TABLE " + table + " (note text)"));
    try {
      String duplicate = OLD.seal("same");
      String distinct = OLD.seal("other");
      jdbi.useHandle(
          handle -> {
            for (String note : List.of(duplicate, duplicate, distinct)) {
              handle
                  .createUpdate("INSERT INTO " + table + " (note) VALUES (:note)")
                  .bind("note", note)
                  .execute();
            }
          });

      Pass rewrite = RotationStoresTestSupport.rewrite(jdbi, type, table, RING);
      Pass check = RotationStoresTestSupport.check(jdbi, type, table, RING);

      assertEquals(0, rewrite.count("UNREWRITABLE"));
      assertTrue(rewrite.count("REKEYED") >= 2, "distinct values rewritten");
      assertEquals(3, check.count("PRIMARY"));
      assertEquals(0, check.count("OLDER_KEY"));
      assertEquals(List.of(), check.problems());
      List<String> notes =
          jdbi.withHandle(
              handle -> handle.createQuery("SELECT note FROM " + table).mapTo(String.class).list());
      assertEquals(3, notes.size());
      long sameCount =
          notes.stream().filter(note -> new Opening.Primary("same").equals(NEW.open(note))).count();
      long otherCount =
          notes.stream()
              .filter(note -> new Opening.Primary("other").equals(NEW.open(note)))
              .count();
      assertEquals(2, sameCount);
      assertEquals(1, otherCount);

      String beforeRace = OLD.seal("before-race");
      String afterRace = OLD.seal("after-race");
      jdbi.useHandle(
          handle -> {
            handle.execute("DELETE FROM " + table);
            handle
                .createUpdate("INSERT INTO " + table + " (note) VALUES (:note)")
                .bind("note", beforeRace)
                .execute();
          });
      Value read = RotationStoresTestSupport.candidates(jdbi, type, table).getFirst();
      jdbi.useHandle(
          handle ->
              handle
                  .createUpdate("UPDATE " + table + " SET note = :note")
                  .bind("note", afterRace)
                  .execute());
      assertFalse(
          RotationStoresTestSupport.compareAndSet(
              jdbi, type, table, read, NEW.seal("before-race")));
      assertEquals(afterRace, readText(table, "note"));
    } finally {
      jdbi.useHandle(handle -> handle.execute("DROP TABLE " + table));
    }
  }

  @Test
  void anUnkeyedTableWithAnIndexedTokenColumnRewritesAllTokenColumnsInOnePass() {
    String table = "fernet_it_nopk_idx_tok_" + suffix();
    jdbi.useHandle(
        handle -> {
          handle.execute(
              "CREATE TABLE "
                  + table
                  + " (tag varchar(36) NOT NULL, token_a varchar(255) NOT NULL, token_b text NOT NULL)");
          handle.execute("CREATE INDEX " + table + "_tag_idx ON " + table + " (tag)");
          handle.execute("CREATE INDEX " + table + "_a_idx ON " + table + " (token_a)");
        });
    try {
      jdbi.useHandle(
          handle ->
              handle
                  .createUpdate(
                      "INSERT INTO " + table + " (tag, token_a, token_b) VALUES ('row-1', :a, :b)")
                  .bind("a", OLD.seal("secret-a"))
                  .bind("b", OLD.seal("secret-b"))
                  .execute());

      Table seen = RotationStoresTestSupport.catalogTable(jdbi, type, table).orElseThrow();
      assertEquals(List.of(), seen.primaryKey());
      Set<String> narrowingLower =
          seen.narrowingColumns().stream()
              .map(col -> col.toLowerCase(Locale.ROOT))
              .collect(Collectors.toSet());
      assertEquals(Set.of("tag"), narrowingLower);

      Pass rewrite = RotationStoresTestSupport.rewrite(jdbi, type, table, RING);
      Pass check = RotationStoresTestSupport.check(jdbi, type, table, RING);

      assertEquals(2, rewrite.count("REKEYED"));
      assertEquals(0, rewrite.count("UNREWRITABLE"));
      assertEquals(2, check.count("PRIMARY"));
      assertEquals(0, check.count("OLDER_KEY"));
      assertEquals(List.of(), check.problems());
      assertEquals(new Opening.Primary("secret-a"), NEW.open(readText(table, "token_a")));
      assertEquals(new Opening.Primary("secret-b"), NEW.open(readText(table, "token_b")));
    } finally {
      jdbi.useHandle(handle -> handle.execute("DROP TABLE " + table));
    }
  }

  @Test
  void encryptedAppRunHistoryInAppsExtensionTimeSeriesIsDiscoveredAndRotated() {
    String appId = UUID.randomUUID().toString();
    long timestamp = System.currentTimeMillis();
    String secret = "app-run-secret-" + suffix();
    String rowJson =
        "{\"appId\":\""
            + appId
            + "\",\"appName\":\"FernetItApp\",\"timestamp\":"
            + timestamp
            + ",\"status\":\"success\",\"config\":{\"apiToken\":\""
            + OLD.seal(secret)
            + "\"}}";
    try {
      jdbi.useHandle(
          handle ->
              handle
                  .createUpdate(
                      "INSERT INTO apps_extension_time_series (json, extension) VALUES (CAST(:json AS "
                          + jsonType()
                          + "), 'status')")
                  .bind("json", rowJson)
                  .execute());

      Table seen =
          RotationStoresTestSupport.catalogTable(jdbi, type, "apps_extension_time_series")
              .orElseThrow();
      assertEquals(List.of(), seen.primaryKey());
      Set<String> narrowingLower =
          seen.narrowingColumns().stream()
              .map(col -> col.toLowerCase(Locale.ROOT))
              .collect(Collectors.toSet());
      assertTrue(
          narrowingLower.containsAll(Set.of("appid", "timestamp")),
          "unkeyed CAS narrows on indexed non-token columns: " + seen.narrowingColumns());
      assertFalse(
          narrowingLower.contains("extension"),
          "eligible token columns are excluded from narrowing: " + seen.narrowingColumns());

      List<Value> defaultCandidates = RotationStoresTestSupport.defaultReadCandidates(jdbi, type);
      assertTrue(
          defaultCandidates.stream().anyMatch(value -> value.text().contains(appId)),
          "default scope reads apps_extension_time_series");

      Pass rewrite =
          RotationStoresTestSupport.rewrite(jdbi, type, "apps_extension_time_series", RING);
      Pass check = RotationStoresTestSupport.check(jdbi, type, "apps_extension_time_series", RING);

      assertEquals(0, rewrite.count("UNREWRITABLE"));
      assertEquals(0, check.count("OLDER_KEY"));
      assertEquals(List.of(), check.problems());
      String storedJson =
          jdbi.withHandle(
              handle ->
                  handle
                      .createQuery(
                          "SELECT "
                              + (type == ConnectionType.MYSQL ? "CAST(json AS CHAR)" : "json::text")
                              + " FROM apps_extension_time_series WHERE appId = :appId")
                      .bind("appId", appId)
                      .mapTo(String.class)
                      .one());
      JsonNode parsed = JsonUtils.readTree(storedJson);
      assertEquals(appId, parsed.path("appId").asText());
      assertEquals(timestamp, parsed.path("timestamp").asLong());
      assertEquals(
          new Opening.Primary(secret), NEW.open(parsed.at("/config/apiToken").textValue()));
    } finally {
      jdbi.useHandle(
          handle ->
              handle
                  .createUpdate("DELETE FROM apps_extension_time_series WHERE appId = :appId")
                  .bind("appId", appId)
                  .execute());
    }
  }

  @Test
  void attachedPostgresPartitionsAreReadOnceThroughTheirParentAndNotDiscoveredSeparately() {
    assumeTrue(type == ConnectionType.POSTGRES, "declarative partitioning test is PostgreSQL-only");
    String tag = suffix();
    String parent = "fernet_it_part_" + tag;
    String attached = parent + "_p1";
    String detached = parent + "_p2";
    try {
      jdbi.useHandle(
          handle -> {
            handle.execute(
                "CREATE TABLE "
                    + parent
                    + " (id varchar(36) NOT NULL, part_key int NOT NULL, note text,"
                    + " PRIMARY KEY (id, part_key)) PARTITION BY RANGE (part_key)");
            handle.execute(
                "CREATE TABLE "
                    + attached
                    + " PARTITION OF "
                    + parent
                    + " FOR VALUES FROM (0) TO (100)");
            handle.execute(
                "CREATE TABLE "
                    + detached
                    + " PARTITION OF "
                    + parent
                    + " FOR VALUES FROM (100) TO (200)");
            handle
                .createUpdate(
                    "INSERT INTO " + parent + " (id, part_key, note) VALUES (:id, 10, :note)")
                .bind("id", UUID.randomUUID().toString())
                .bind("note", OLD.seal("attached-secret"))
                .execute();
            handle
                .createUpdate(
                    "INSERT INTO " + parent + " (id, part_key, note) VALUES (:id, 150, :note)")
                .bind("id", UUID.randomUUID().toString())
                .bind("note", OLD.seal("detached-secret"))
                .execute();
            handle.execute("ALTER TABLE " + parent + " DETACH PARTITION " + detached);
          });

      assertTrue(
          RotationStoresTestSupport.catalogTable(jdbi, type, parent).isPresent(),
          "partitioned parent is discovered");
      assertTrue(
          RotationStoresTestSupport.catalogTable(jdbi, type, attached).isEmpty(),
          "attached child partition is excluded from separate discovery");
      assertTrue(
          RotationStoresTestSupport.catalogTable(jdbi, type, detached).isPresent(),
          "detached partition is discovered as a standalone table");
      assertTrue(
          RotationStoresTestSupport.catalogTable(jdbi, type, "activity_stream_default").isEmpty(),
          "attached activity_stream partition is excluded from catalog discovery");

      Pass rewrite = RotationStoresTestSupport.rewrite(jdbi, type, parent, RING);
      Pass check = RotationStoresTestSupport.check(jdbi, type, parent, RING);
      assertEquals(1, rewrite.count("REKEYED"));
      assertEquals(1, check.count("PRIMARY"));
      assertEquals(0, check.count("OLDER_KEY"));
      assertEquals(new Opening.Primary("attached-secret"), NEW.open(readText(attached, "note")));
    } finally {
      jdbi.useHandle(
          handle -> {
            handle.execute("DROP TABLE IF EXISTS " + detached);
            handle.execute("DROP TABLE IF EXISTS " + parent);
          });
    }
  }

  @Test
  void aRedisKeyspaceWithGlobMetacharactersMatchesOnlyItsLiteralPrefix() {
    assumeTrue(TestSuiteBootstrap.isRedisEnabled(), "the lane runs without Redis");
    String tag = suffix();
    String bracketNs = "om[fernet-it-" + tag + "]";
    String bracketSession = bracketNs + ":session:1";
    String bracketDecoy = "omf:session:" + tag;
    String wildcardNs = "om*fernet-" + tag;
    String wildcardSession = wildcardNs + ":session:1";
    String wildcardDecoy = "omXfernet-" + tag + ":session:1";
    String decoyBracketToken = OLD.seal("bracket-decoy");
    String decoyWildcardToken = OLD.seal("wildcard-decoy");
    withRedis(
        redis -> {
          try {
            redis.set(
                bracketSession, "{\"omRefreshToken\":\"" + OLD.seal("bracket-refresh") + "\"}");
            redis.set(bracketDecoy, "{\"omRefreshToken\":\"" + decoyBracketToken + "\"}");
            redis.set(
                wildcardSession, "{\"omRefreshToken\":\"" + OLD.seal("wildcard-refresh") + "\"}");
            redis.set(wildcardDecoy, "{\"omRefreshToken\":\"" + decoyWildcardToken + "\"}");

            RotationStoresTestSupport.rewriteRedisKeyspace(redis, bracketNs, RING);

            assertEquals(
                new Opening.Primary("bracket-refresh"),
                NEW.open(
                    JsonUtils.readTree(redis.get(bracketSession))
                        .get("omRefreshToken")
                        .textValue()));
            assertEquals(
                decoyBracketToken,
                JsonUtils.readTree(redis.get(bracketDecoy)).get("omRefreshToken").textValue(),
                "a bracket character-class decoy outside the literal namespace is untouched");

            RotationStoresTestSupport.rewriteRedisKeyspace(redis, wildcardNs, RING);

            assertEquals(
                new Opening.Primary("wildcard-refresh"),
                NEW.open(
                    JsonUtils.readTree(redis.get(wildcardSession))
                        .get("omRefreshToken")
                        .textValue()));
            assertEquals(
                decoyWildcardToken,
                JsonUtils.readTree(redis.get(wildcardDecoy)).get("omRefreshToken").textValue(),
                "a wildcard decoy outside the literal namespace is untouched");
          } finally {
            redis.del(bracketSession, bracketDecoy, wildcardSession, wildcardDecoy);
          }
        });
  }

  @Test
  void aRedisStringAndAHashFieldAreRewrittenAndKeepTheirTtlWhileAListMemberIsReported() {
    assumeTrue(TestSuiteBootstrap.isRedisEnabled(), "the lane runs without Redis");
    String keyspace =
        TestSuiteBootstrap.createApplicationConfigCopy().getCacheConfig().redis.keyspace;
    String prefix = keyspace + ":fernet-it:" + suffix();
    withRedis(
        redis -> {
          try {
            redis.psetex(
                prefix + ":s",
                TTL_MILLIS,
                "{\"omRefreshToken\":\"" + OLD.seal("refresh") + "\",\"version\":3}");
            redis.hset(
                prefix + ":h",
                "base",
                "{\"id\":\"" + UUID.randomUUID() + "\",\"jwt\":\"" + OLD.seal("bot") + "\"}");
            redis.hset(prefix + ":h", "ref", "{\"id\":\"x\"}");
            redis.pexpire(prefix + ":h", TTL_MILLIS);
            String member = OLD.seal("member");
            redis.rpush(prefix + ":l", member);

            Pass rewrite = RotationStoresTestSupport.rewriteRedis(redis, prefix, RING);

            assertEquals(2, rewrite.count("REKEYED"));
            assertEquals(1, rewrite.count("UNREWRITABLE"));
            JsonNode session = JsonUtils.readTree(redis.get(prefix + ":s"));
            assertEquals(3, session.get("version").intValue());
            assertEquals(
                new Opening.Primary("refresh"),
                NEW.open(session.get("omRefreshToken").textValue()));
            long stringTtl = redis.pttl(prefix + ":s");
            assertTrue(
                stringTtl > 0 && stringTtl <= TTL_MILLIS, "the string keeps its TTL: " + stringTtl);
            assertEquals(
                new Opening.Primary("bot"),
                NEW.open(
                    JsonUtils.readTree(redis.hget(prefix + ":h", "base")).get("jwt").textValue()));
            assertEquals("{\"id\":\"x\"}", redis.hget(prefix + ":h", "ref"));
            long hashTtl = redis.pttl(prefix + ":h");
            assertTrue(hashTtl > 0 && hashTtl <= TTL_MILLIS, "the hash keeps its TTL: " + hashTtl);
            assertEquals(
                List.of(member),
                redis.lrange(prefix + ":l", 0, -1),
                "a list member is never written");

            Pass check = RotationStoresTestSupport.checkRedis(redis, prefix, RING);
            assertEquals(2, check.count("PRIMARY"));
            assertEquals(1, check.count("UNREWRITABLE"));
            assertEquals(
                List.of(
                    "redis key="
                        + digestOf(prefix + ":l")
                        + " list member: token that will not be replaced: it is a member of a Redis list, set or sorted set"),
                check.problems());
          } finally {
            redis.del(prefix + ":s", prefix + ":h", prefix + ":l");
          }
        });
  }

  @Test
  void aRedisCompareAndSetThatLosesToAnOutOfBandChangeReturnsFalseAndLeavesTheOtherText() {
    assumeTrue(TestSuiteBootstrap.isRedisEnabled(), "the lane runs without Redis");
    String keyspace =
        TestSuiteBootstrap.createApplicationConfigCopy().getCacheConfig().redis.keyspace;
    String prefix = keyspace + ":fernet-it-cas:" + suffix();
    String stringKey = prefix + ":s";
    String hashKey = prefix + ":h";
    withRedis(
        redis -> {
          try {
            String initialString = OLD.seal("before-string");
            String updatedString = OLD.seal("after-string");
            redis.psetex(stringKey, TTL_MILLIS, initialString);
            redis.psetex(stringKey, TTL_MILLIS, updatedString);

            assertFalse(
                RotationStoresTestSupport.compareAndSetRedis(
                    redis, stringKey, "", initialString, NEW.seal("before-string")));
            assertEquals(updatedString, redis.get(stringKey));
            assertTrue(
                RotationStoresTestSupport.compareAndSetRedis(
                    redis, stringKey, "", updatedString, NEW.seal("after-string")));
            assertEquals(new Opening.Primary("after-string"), NEW.open(redis.get(stringKey)));

            String initialHash = OLD.seal("before-hash");
            String updatedHash = OLD.seal("after-hash");
            redis.hset(hashKey, "base", initialHash);
            redis.hset(hashKey, "base", updatedHash);

            assertFalse(
                RotationStoresTestSupport.compareAndSetRedis(
                    redis, hashKey, "base", initialHash, NEW.seal("before-hash")));
            assertEquals(updatedHash, redis.hget(hashKey, "base"));
            assertTrue(
                RotationStoresTestSupport.compareAndSetRedis(
                    redis, hashKey, "base", updatedHash, NEW.seal("after-hash")));
            assertEquals(new Opening.Primary("after-hash"), NEW.open(redis.hget(hashKey, "base")));
          } finally {
            redis.del(stringKey, hashKey);
          }
        });
  }

  private static void withRedis(Consumer<RedisCommands<String, String>> test) {
    RedisClient client = RedisClient.create(TestSuiteBootstrap.getRedisUrl());
    try (StatefulRedisConnection<String, String> connection = client.connect()) {
      test.accept(connection.sync());
    } finally {
      client.shutdown();
    }
  }

  private void withKeyedTable(Consumer<String> test) {
    String table = "fernet_it_stores_" + suffix();
    jdbi.useHandle(
        handle ->
            handle.execute(
                "CREATE TABLE "
                    + table
                    + " (a varchar(36) NOT NULL, b int NOT NULL, doc "
                    + jsonType()
                    + ", note text, bin "
                    + blobType()
                    + ", short_text varchar(50), defaulted "
                    + jsonType()
                    + (type == ConnectionType.MYSQL
                        ? " DEFAULT (JSON_OBJECT()),"
                        : " DEFAULT '{}'::jsonb,")
                    + " gen varchar(200) GENERATED ALWAYS AS (LEFT(note, 200)) STORED,"
                    + " PRIMARY KEY (a, b))"));
    try {
      test.accept(table);
    } finally {
      jdbi.useHandle(handle -> handle.execute("DROP TABLE " + table));
    }
  }

  private String readText(String table, String column) {
    String expression =
        ("doc".equals(column) || "defaulted".equals(column))
            ? (type == ConnectionType.MYSQL ? "CAST(" + column + " AS CHAR)" : column + "::text")
            : column;
    return jdbi.withHandle(
        handle ->
            handle
                .createQuery("SELECT " + expression + " FROM " + table)
                .mapTo(String.class)
                .one());
  }

  private byte[] readBytes(String table) {
    return jdbi.withHandle(
        handle -> handle.createQuery("SELECT bin FROM " + table).mapTo(byte[].class).one());
  }

  private String jsonType() {
    return type == ConnectionType.MYSQL ? "JSON" : "jsonb";
  }

  private String blobType() {
    return type == ConnectionType.MYSQL ? "LONGBLOB" : "bytea";
  }

  private static String suffix() {
    return UUID.randomUUID().toString().substring(0, 8).replace("-", "");
  }

  // Computed here on purpose, so the test pins the printed digest independently of Location.
  private static String digestOf(String key) {
    return DigestUtils.sha256Hex(key).substring(0, 12);
  }
}
