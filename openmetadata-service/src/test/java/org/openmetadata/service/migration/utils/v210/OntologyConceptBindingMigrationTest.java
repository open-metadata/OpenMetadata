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

package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.IntStream;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.type.OntologyAssetBinding;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.schema.type.OntologyColumnBinding;
import org.openmetadata.schema.type.OntologyConceptBindings;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.OntologyConceptBindingStore;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Testcontainers(disabledWithoutDocker = true)
class OntologyConceptBindingMigrationTest {
  private static final String PASSWORD = "binding-copy-test";
  private static final String DATABASE = "binding_test";
  private static final String MYSQL_DIALECT = "mysql";
  private static final String POSTGRES_DIALECT = "postgres";
  private static final String BINDING_TABLE = "ontology_concept_binding";
  private static final Map<OntologyBindingAssetType, String> TABLES =
      Map.of(
          OntologyBindingAssetType.TABLE, "table_entity",
          OntologyBindingAssetType.TOPIC, "topic_entity");

  private static final UUID CUSTOMER = id("c1");
  private static final UUID ORDER = id("c2");
  private static final UUID EMPTY = id("c3");
  private static final UUID WIDE = id("c4");
  private static final UUID ADDRESSES = id("a1");
  private static final UUID EVENTS = id("a2");
  private static final UUID GONE = id("a3");
  private static final UUID PROPERTY = id("e1");
  private static final int WIDE_TOPICS = 120;

  @Container
  static final GenericContainer<?> MYSQL =
      new GenericContainer<>(DockerImageName.parse("mysql:8.0"))
          .withEnv("MYSQL_DATABASE", DATABASE)
          .withEnv("MYSQL_ROOT_PASSWORD", PASSWORD)
          .withExposedPorts(3306);

  @Container
  static final GenericContainer<?> POSTGRES =
      new GenericContainer<>(DockerImageName.parse("postgres:15"))
          .withEnv("POSTGRES_DB", DATABASE)
          .withEnv("POSTGRES_PASSWORD", PASSWORD)
          .withExposedPorts(5432);

  private record Row(String assetType, String assetFqnHash, JsonNode columns) {}

  @ParameterizedTest
  @ValueSource(strings = {MYSQL_DIALECT, POSTGRES_DIALECT})
  void copiesEveryDocumentIntoOneRowPerBindingAndASecondRunChangesNothing(String dialect) {
    try (Handle handle = open(dialect)) {
      ConnectionType connectionType = connectionType(dialect);
      createTables(handle, dialect);
      assertBindingKeys(handle);
      List<OntologyColumnBinding> columns =
          List.of(
              new OntologyColumnBinding()
                  .withPropertyId(PROPERTY)
                  .withColumnPath(List.of("address", "postal.code")),
              new OntologyColumnBinding()
                  .withPropertyId(PROPERTY)
                  .withColumnPath(List.of("address", "street")));
      List<UUID> wideTopics = IntStream.range(0, WIDE_TOPICS).mapToObj(i -> id("f" + i)).toList();
      seedEntity(handle, "table_entity", ADDRESSES, "hash-addresses");
      seedEntity(handle, "topic_entity", EVENTS, "hash-events");
      wideTopics.forEach(topic -> seedEntity(handle, "topic_entity", topic, "hash-" + topic));
      seedDocument(
          handle,
          dialect,
          CUSTOMER,
          3,
          List.of(
              asset(OntologyBindingAssetType.TABLE, ADDRESSES).withColumns(columns),
              asset(OntologyBindingAssetType.TOPIC, EVENTS),
              asset(OntologyBindingAssetType.TABLE, GONE)));
      seedDocument(
          handle, dialect, ORDER, 1, List.of(asset(OntologyBindingAssetType.TOPIC, EVENTS)));
      seedDocument(handle, dialect, EMPTY, 7, List.of());
      seedDocument(
          handle,
          dialect,
          WIDE,
          WIDE_TOPICS,
          wideTopics.stream().map(topic -> asset(OntologyBindingAssetType.TOPIC, topic)).toList());
      handle
          .createUpdate(
              "INSERT INTO entity_extension(id, extension, jsonSchema, json) "
                  + "VALUES (:id, 'table.customProperties.note', 'string', "
                  + json(dialect)
                  + ")")
          .bind("id", ADDRESSES.toString())
          .bind("json", "\"not a binding\"")
          .execute();

      OntologyConceptBindingMigration.copyConceptBindingsToRows(
          handle, connectionType, TABLES::get);
      Map<String, Row> rows = rows(handle, dialect);

      assertEquals(2 + 1 + WIDE_TOPICS, rows.size());
      assertEquals(
          new Row("table", "hash-addresses", JsonUtils.valueToTree(columns)),
          rows.get(key(CUSTOMER, ADDRESSES)));
      assertEquals(
          new Row("topic", "hash-events", JsonUtils.readTree("[]")),
          rows.get(key(CUSTOMER, EVENTS)));
      assertFalse(rows.containsKey(key(CUSTOMER, GONE)), "an asset without an entity row");
      assertEquals(
          new Row("topic", "hash-events", JsonUtils.readTree("[]")), rows.get(key(ORDER, EVENTS)));
      assertTrue(rows.keySet().stream().noneMatch(key -> key.startsWith(EMPTY.toString())));
      assertEquals(
          WIDE_TOPICS,
          rows.keySet().stream().filter(key -> key.startsWith(WIDE.toString())).count());
      assertEquals(4, documentCount(handle), "documents stay, they still carry the revision");

      OntologyConceptBindingMigration.copyConceptBindingsToRows(
          handle, connectionType, TABLES::get);

      assertEquals(rows, rows(handle, dialect));
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {MYSQL_DIALECT, POSTGRES_DIALECT})
  void aRerunLeavesRowsEditedSinceTheFirstRunAlone(String dialect) {
    try (Handle handle = open(dialect)) {
      ConnectionType connectionType = connectionType(dialect);
      createTables(handle, dialect);
      seedEntity(handle, "table_entity", ADDRESSES, "hash-addresses");
      seedEntity(handle, "topic_entity", EVENTS, "hash-events");
      seedDocument(
          handle,
          dialect,
          CUSTOMER,
          2,
          List.of(
              asset(OntologyBindingAssetType.TABLE, ADDRESSES)
                  .withColumns(
                      List.of(
                          new OntologyColumnBinding()
                              .withPropertyId(PROPERTY)
                              .withColumnPath(List.of("address")))),
              asset(OntologyBindingAssetType.TOPIC, EVENTS)));
      OntologyConceptBindingMigration.copyConceptBindingsToRows(
          handle, connectionType, TABLES::get);
      handle
          .createUpdate(
              "UPDATE ontology_concept_binding SET columnBindings = "
                  + json(dialect)
                  + " WHERE conceptId = :conceptId AND assetId = :assetId")
          .bind("json", "[]")
          .bind("conceptId", CUSTOMER.toString())
          .bind("assetId", ADDRESSES.toString())
          .execute();
      handle
          .createUpdate(
              "DELETE FROM ontology_concept_binding WHERE conceptId = :conceptId "
                  + "AND assetId = :assetId")
          .bind("conceptId", CUSTOMER.toString())
          .bind("assetId", EVENTS.toString())
          .execute();
      Map<String, Row> edited = rows(handle, dialect);

      OntologyConceptBindingMigration.copyConceptBindingsToRows(
          handle, connectionType, TABLES::get);

      Map<String, Row> rerun = rows(handle, dialect);
      assertEquals(edited.get(key(CUSTOMER, ADDRESSES)), rerun.get(key(CUSTOMER, ADDRESSES)));
      assertEquals(JsonUtils.readTree("[]"), rerun.get(key(CUSTOMER, ADDRESSES)).columns());
      assertEquals(
          new Row("topic", "hash-events", JsonUtils.readTree("[]")),
          rerun.get(key(CUSTOMER, EVENTS)),
          "a row the document still lists and the table lost comes back");
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {MYSQL_DIALECT, POSTGRES_DIALECT})
  void unreadableDocumentsDoNotPreventCopyingValidBindings(String dialect) {
    try (Handle handle = open(dialect)) {
      createTables(handle, dialect);
      seedEntity(handle, "topic_entity", EVENTS, "hash-events");
      seedDocument(handle, dialect, CUSTOMER, 3, List.of());
      seedDocument(handle, dialect, EMPTY, 7, List.of());
      seedDocument(
          handle, dialect, ORDER, 1, List.of(asset(OntologyBindingAssetType.TOPIC, EVENTS)));
      for (var document :
          Map.of(CUSTOMER, "{\"revision\":3,\"assets\":\"unreadable\"}", EMPTY, "null")
              .entrySet()) {
        handle
            .createUpdate("UPDATE entity_extension SET json = " + json(dialect) + " WHERE id = :id")
            .bind("json", document.getValue())
            .bind("id", document.getKey().toString())
            .execute();
      }

      OntologyConceptBindingMigration.copyConceptBindingsToRows(
          handle, connectionType(dialect), TABLES::get);

      assertEquals(
          Map.of(key(ORDER, EVENTS), new Row("topic", "hash-events", JsonUtils.readTree("[]"))),
          rows(handle, dialect));
      assertEquals(3, documentCount(handle), "legacy documents remain available for recovery");
      assertEquals(
          3,
          JsonUtils.readTree(
                  handle
                      .createQuery("SELECT json FROM entity_extension WHERE id = :id")
                      .bind("id", CUSTOMER.toString())
                      .mapTo(String.class)
                      .one())
              .get("revision")
              .asInt());
    }
  }

  private static void createTables(Handle handle, String dialect) {
    String json = POSTGRES_DIALECT.equals(dialect) ? "JSONB" : "JSON";
    handle.execute("DROP TABLE IF EXISTS entity_extension");
    handle.execute("DROP TABLE IF EXISTS table_entity");
    handle.execute("DROP TABLE IF EXISTS topic_entity");
    handle.execute("DROP TABLE IF EXISTS " + BINDING_TABLE);
    handle.execute(
        "CREATE TABLE entity_extension (id VARCHAR(36) NOT NULL, extension VARCHAR(256) NOT NULL,"
            + " jsonSchema VARCHAR(256) NOT NULL, json "
            + json
            + " NOT NULL, PRIMARY KEY (id, extension))");
    for (String table : TABLES.values()) {
      handle.execute(
          "CREATE TABLE "
              + table
              + " (id VARCHAR(36) NOT NULL PRIMARY KEY, fqnHash VARCHAR(768) NOT NULL)");
    }
    List<String> shipped =
        MigrationFile.parseSQLFile(migrationFile(dialect).toFile(), connectionType(dialect))
            .stream()
            .filter(sql -> sql.contains(BINDING_TABLE))
            .toList();
    assertFalse(shipped.isEmpty(), "the 2.1.0 " + dialect + " migration creates " + BINDING_TABLE);
    shipped.forEach(handle::execute);
  }

  private static void assertBindingKeys(Handle handle) {
    try {
      var connection = handle.getConnection();
      DatabaseMetaData metadata = connection.getMetaData();
      String catalog = connection.getCatalog();
      String schema = connection.getSchema();
      List<Map.Entry<Integer, String>> primaryKeys = new ArrayList<>();
      try (ResultSet keys = metadata.getPrimaryKeys(catalog, schema, BINDING_TABLE)) {
        while (keys.next()) {
          primaryKeys.add(
              Map.entry(
                  keys.getInt("KEY_SEQ"), keys.getString("COLUMN_NAME").toLowerCase(Locale.ROOT)));
        }
      }
      assertEquals(
          List.of("conceptid", "assetid"),
          primaryKeys.stream()
              .sorted(Comparator.comparingInt(Map.Entry::getKey))
              .map(Map.Entry::getValue)
              .toList());

      Map<String, Map<Integer, String>> indexes = new TreeMap<>();
      try (ResultSet rows = metadata.getIndexInfo(catalog, schema, BINDING_TABLE, false, false)) {
        while (rows.next()) {
          String name = rows.getString("INDEX_NAME");
          String column = rows.getString("COLUMN_NAME");
          if (rows.getShort("TYPE") != DatabaseMetaData.tableIndexStatistic
              && name != null
              && column != null) {
            indexes
                .computeIfAbsent(name, ignored -> new TreeMap<>())
                .put(rows.getInt("ORDINAL_POSITION"), column.toLowerCase(Locale.ROOT));
          }
        }
      }
      assertTrue(
          indexes.values().stream().anyMatch(columns -> "assetid".equals(columns.get(1))),
          "assetId must lead an index for asset-side lookup: " + indexes);
    } catch (SQLException exception) {
      throw new IllegalStateException("Could not inspect binding table metadata", exception);
    }
  }

  private static void seedEntity(Handle handle, String table, UUID id, String fqnHash) {
    handle
        .createUpdate("INSERT INTO " + table + " (id, fqnHash) VALUES (:id, :fqnHash)")
        .bind("id", id.toString())
        .bind("fqnHash", fqnHash)
        .execute();
  }

  private static void seedDocument(
      Handle handle,
      String dialect,
      UUID conceptId,
      long revision,
      List<OntologyAssetBinding> assets) {
    handle
        .createUpdate(
            "INSERT INTO entity_extension(id, extension, jsonSchema, json) "
                + "VALUES (:id, :extension, 'ontologyConceptBindings', "
                + json(dialect)
                + ")")
        .bind("id", conceptId.toString())
        .bind("extension", OntologyConceptBindingStore.EXTENSION)
        .bind(
            "json",
            JsonUtils.pojoToJson(
                new OntologyConceptBindings().withRevision(revision).withAssets(assets)))
        .execute();
  }

  private static OntologyAssetBinding asset(OntologyBindingAssetType type, UUID id) {
    return new OntologyAssetBinding().withAssetType(type).withAssetId(id);
  }

  private static Map<String, Row> rows(Handle handle, String dialect) {
    String columns =
        POSTGRES_DIALECT.equals(dialect)
            ? "CAST(columnBindings AS TEXT)"
            : "CAST(columnBindings AS CHAR)";
    Map<String, Row> rows = new TreeMap<>();
    handle
        .createQuery(
            "SELECT conceptId, assetId, assetType, assetFqnHash, "
                + columns
                + " AS columnBindings FROM "
                + BINDING_TABLE)
        .map(
            (rs, ctx) ->
                Map.entry(
                    rs.getString("conceptId") + ":" + rs.getString("assetId"),
                    new Row(
                        rs.getString("assetType"),
                        rs.getString("assetFqnHash"),
                        JsonUtils.readTree(rs.getString("columnBindings")))))
        .forEach(entry -> rows.put(entry.getKey(), entry.getValue()));
    return rows;
  }

  private static int documentCount(Handle handle) {
    return handle
        .createQuery("SELECT COUNT(*) FROM entity_extension WHERE extension = :extension")
        .bind("extension", OntologyConceptBindingStore.EXTENSION)
        .mapTo(Integer.class)
        .one();
  }

  private static String key(UUID conceptId, UUID assetId) {
    return conceptId + ":" + assetId;
  }

  private static String json(String dialect) {
    return POSTGRES_DIALECT.equals(dialect) ? "CAST(:json AS JSONB)" : ":json";
  }

  private static ConnectionType connectionType(String dialect) {
    return POSTGRES_DIALECT.equals(dialect) ? ConnectionType.POSTGRES : ConnectionType.MYSQL;
  }

  private static UUID id(String suffix) {
    String padded = "0".repeat(12 - suffix.length()) + suffix;
    return UUID.fromString("00000000-0000-0000-0000-" + padded);
  }

  private static Handle open(String dialect) {
    return MYSQL_DIALECT.equals(dialect)
        ? Jdbi.create(
                "jdbc:mysql://%s:%d/%s?allowPublicKeyRetrieval=true&useSSL=false"
                    .formatted(MYSQL.getHost(), MYSQL.getMappedPort(3306), DATABASE),
                "root",
                PASSWORD)
            .open()
        : Jdbi.create(
                "jdbc:postgresql://%s:%d/%s"
                    .formatted(POSTGRES.getHost(), POSTGRES.getMappedPort(5432), DATABASE),
                "postgres",
                PASSWORD)
            .open();
  }

  private static Path migrationFile(String dialect) {
    Path current = Path.of("").toAbsolutePath();
    while (current != null && !Files.isDirectory(current.resolve("bootstrap/sql/migrations"))) {
      current = current.getParent();
    }
    assertTrue(current != null, "Could not find the repository root");
    return current.resolve(
        "bootstrap/sql/migrations/native/2.1.0/" + dialect + "/schemaChanges.sql");
  }
}
