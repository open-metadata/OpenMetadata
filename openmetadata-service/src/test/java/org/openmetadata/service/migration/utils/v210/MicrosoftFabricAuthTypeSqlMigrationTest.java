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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * Runs the 2.1.0 statements that move a stored Microsoft Fabric {@code clientSecret} under {@code
 * authType} against real MySQL and PostgreSQL, for service rows and for their version history. The
 * statements are read from the shipped {@code postDataMigrationSQLScript.sql}, so the test fails if
 * either dialect drifts from what upgrades really run.
 */
@Testcontainers(disabledWithoutDocker = true)
class MicrosoftFabricAuthTypeSqlMigrationTest {
  private static final String PASSWORD = "fabric-auth-type-test";
  private static final String DATABASE = "fabric_test";
  private static final String MYSQL_DIALECT = "mysql";
  private static final String POSTGRES_DIALECT = "postgres";
  private static final String FABRIC = "MicrosoftFabric";
  private static final String VERSION_EXTENSION = "databaseService.version.0.1";
  private static final String CLIENT_SECRET = "clientSecret";
  private static final String FERNET_SECRET = "fernet:legacy-client-secret";
  private static final String SECRET_REFERENCE =
      "secret:/openmetadata/database/fabric_reference/clientsecret";
  private static final String LEGACY_FERNET = "fabric_fernet";
  private static final String LEGACY_REFERENCE = "fabric_reference";
  private static final String CERTIFICATE = "fabric_certificate";
  private static final String SYNAPSE = "synapse";

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

  private record Fixture(String name, String serviceType, String config) {}

  private record Database(Handle handle, String dialect) {
    boolean isPostgres() {
      return POSTGRES_DIALECT.equals(dialect);
    }

    String jsonValue() {
      return isPostgres() ? "CAST(:json AS JSONB)" : ":json";
    }

    String jsonText() {
      return isPostgres() ? "CAST(json AS TEXT)" : "CAST(json AS CHAR)";
    }
  }

  private static final List<Fixture> FIXTURES =
      List.of(
          new Fixture(LEGACY_FERNET, FABRIC, legacyConfig(FERNET_SECRET)),
          new Fixture(LEGACY_REFERENCE, FABRIC, legacyConfig(SECRET_REFERENCE)),
          new Fixture(
              CERTIFICATE,
              FABRIC,
              """
              {"type": "MicrosoftFabric", "clientId": "c", "tenantId": "t",
               "authType": {"certificate": "fernet:certificate", "privateKey": "fernet:key"}}"""),
          new Fixture(
              SYNAPSE,
              "Synapse",
              """
              {"type": "Synapse", "clientId": "c", "tenantId": "t", "clientSecret": "fernet:other"}"""));

  static Stream<String> dialects() {
    return Stream.of(MYSQL_DIALECT, POSTGRES_DIALECT);
  }

  @ParameterizedTest
  @MethodSource("dialects")
  void movesLegacyClientSecretsUnderAuthTypeKeepingTheirValues(String dialect) {
    try (Handle handle = open(dialect)) {
      Database db = seed(new Database(handle, dialect));

      runFabricStatements(db);

      Map<String, JsonNode> configs = configs(db);
      assertClientSecretMoved(configs.get("service:" + LEGACY_FERNET), FERNET_SECRET);
      assertClientSecretMoved(configs.get("service:" + LEGACY_REFERENCE), SECRET_REFERENCE);
      assertClientSecretMoved(configs.get("snapshot:" + LEGACY_FERNET), FERNET_SECRET);
      assertClientSecretMoved(configs.get("snapshot:" + LEGACY_REFERENCE), SECRET_REFERENCE);
    }
  }

  @ParameterizedTest
  @MethodSource("dialects")
  void leavesCertificateAndOtherServicesUntouched(String dialect) {
    try (Handle handle = open(dialect)) {
      Database db = seed(new Database(handle, dialect));
      Map<String, JsonNode> before = configs(db);

      runFabricStatements(db);

      Map<String, JsonNode> after = configs(db);
      for (String name : List.of(CERTIFICATE, SYNAPSE)) {
        assertEquals(before.get("service:" + name), after.get("service:" + name), name);
        assertEquals(before.get("snapshot:" + name), after.get("snapshot:" + name), name);
      }
    }
  }

  @ParameterizedTest
  @MethodSource("dialects")
  void secondRunChangesNothing(String dialect) {
    try (Handle handle = open(dialect)) {
      Database db = seed(new Database(handle, dialect));
      runFabricStatements(db);
      Map<String, JsonNode> afterFirstRun = configs(db);

      runFabricStatements(db);

      assertEquals(afterFirstRun, configs(db));
    }
  }

  private static String legacyConfig(String clientSecret) {
    return """
        {"type": "MicrosoftFabric", "clientId": "c", "tenantId": "t", "clientSecret": "%s"}"""
        .formatted(clientSecret);
  }

  private static void assertClientSecretMoved(JsonNode config, String clientSecret) {
    assertFalse(config.has(CLIENT_SECRET), "top-level clientSecret must be gone: " + config);
    assertTrue(config.path("authType").has(CLIENT_SECRET), "authType.clientSecret: " + config);
    assertEquals(clientSecret, config.path("authType").path(CLIENT_SECRET).asText());
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

  private static Database seed(Database db) {
    db.handle().execute("DROP TABLE IF EXISTS dbservice_entity");
    db.handle().execute("DROP TABLE IF EXISTS entity_extension");
    db.handle().execute(db.isPostgres() ? POSTGRES_SERVICE_TABLE : MYSQL_SERVICE_TABLE);
    db.handle().execute(db.isPostgres() ? POSTGRES_EXTENSION_TABLE : MYSQL_EXTENSION_TABLE);
    FIXTURES.forEach(fixture -> insert(db, fixture));
    return db;
  }

  private static void insert(Database db, Fixture fixture) {
    String id = UUID.randomUUID().toString();
    String json =
        """
        {"id": "%s", "name": "%s", "serviceType": "%s", "connection": {"config": %s}}"""
            .formatted(id, fixture.name(), fixture.serviceType(), fixture.config());
    db.handle()
        .createUpdate("INSERT INTO dbservice_entity (json) VALUES (" + db.jsonValue() + ")")
        .bind("json", json)
        .execute();
    db.handle()
        .createUpdate(
            "INSERT INTO entity_extension (id, extension, jsonSchema, json) VALUES "
                + "(:id, :extension, 'databaseService', "
                + db.jsonValue()
                + ")")
        .bind("id", id)
        .bind("extension", VERSION_EXTENSION)
        .bind("json", json)
        .execute();
  }

  /** Each service's stored connection config and its version snapshot's, keyed by origin. */
  private static Map<String, JsonNode> configs(Database db) {
    Map<String, JsonNode> configs = new LinkedHashMap<>();
    for (String json : texts(db, "dbservice_entity")) {
      JsonNode service = JsonUtils.readTree(json);
      configs.put("service:" + service.path("name").asText(), connectionConfig(service));
    }
    for (String json : texts(db, "entity_extension")) {
      JsonNode snapshot = JsonUtils.readTree(json);
      configs.put("snapshot:" + snapshot.path("name").asText(), connectionConfig(snapshot));
    }
    return configs;
  }

  private static List<String> texts(Database db, String table) {
    return db.handle()
        .createQuery("SELECT " + db.jsonText() + " FROM " + table)
        .mapTo(String.class)
        .list();
  }

  private static JsonNode connectionConfig(JsonNode entity) {
    return entity.path("connection").path("config");
  }

  private static void runFabricStatements(Database db) {
    fabricStatements(db.dialect()).forEach(statement -> db.handle().execute(statement));
  }

  /** Parsed with the migration framework's own splitter, so it is what an upgrade would execute. */
  private static List<String> fabricStatements(String dialect) {
    ConnectionType connectionType =
        MYSQL_DIALECT.equals(dialect) ? ConnectionType.MYSQL : ConnectionType.POSTGRES;
    List<String> statements =
        MigrationFile.parseSQLFile(migrationFile(dialect).toFile(), connectionType).stream()
            .filter(sql -> sql.contains("'" + FABRIC + "'"))
            .toList();
    assertEquals(2, statements.size(), "Expected the service and version statements in " + dialect);
    return statements;
  }

  private static Path migrationFile(String dialect) {
    Path current = Path.of("").toAbsolutePath();
    while (current != null && !Files.isDirectory(current.resolve("bootstrap/sql/migrations"))) {
      current = current.getParent();
    }
    assertTrue(current != null, "Could not find the repository root");
    return current.resolve(
        "bootstrap/sql/migrations/native/2.1.0/%s/postDataMigrationSQLScript.sql"
            .formatted(dialect));
  }

  private static final String MYSQL_SERVICE_TABLE =
      """
      CREATE TABLE dbservice_entity (
        id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
        name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
        serviceType VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.serviceType') NOT NULL,
        json JSON NOT NULL,
        PRIMARY KEY (id))
      """;

  private static final String POSTGRES_SERVICE_TABLE =
      """
      CREATE TABLE dbservice_entity (
        id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
        name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
        serviceType VARCHAR(256) GENERATED ALWAYS AS (json ->> 'serviceType') STORED NOT NULL,
        json JSONB NOT NULL,
        PRIMARY KEY (id))
      """;

  private static final String MYSQL_EXTENSION_TABLE =
      """
      CREATE TABLE entity_extension (
        id VARCHAR(36) NOT NULL,
        extension VARCHAR(256) NOT NULL,
        jsonSchema VARCHAR(256) NOT NULL,
        json JSON NOT NULL,
        PRIMARY KEY (id, extension))
      """;

  private static final String POSTGRES_EXTENSION_TABLE =
      """
      CREATE TABLE entity_extension (
        id VARCHAR(36) NOT NULL,
        extension VARCHAR(256) NOT NULL,
        jsonSchema VARCHAR(256) NOT NULL,
        json JSONB NOT NULL,
        PRIMARY KEY (id, extension))
      """;
}
