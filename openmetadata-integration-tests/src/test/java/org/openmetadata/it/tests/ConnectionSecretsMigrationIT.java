package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.CURRENT;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.PREVIOUS;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.assertLegacyEncrypted;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.collection;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.create;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.field;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.migrate;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.read;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.runNormalUpgrade;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.secret;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.seedLegacy;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.store;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.stored;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.write;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.LegacyService;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateMlModelService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.type.MlModelConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.migration.utils.v208.ConnectionSecretsEncryptionMigration;

@Isolated("Runs the connection-secret migration over current and historical service rows")
@ExtendWith(TestNamespaceExtension.class)
class ConnectionSecretsMigrationIT {
  @TempDir Path migrationRoot;
  private static final String MASK = "*********";

  private record LoggedSql(String statement, String checksum) {}

  private record FieldValue(JsonNode input, String plaintext) {}

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void normalUpgradeEncryptsPopulatedServicesAndHistory(boolean mlflow, TestNamespace ns)
      throws Exception {
    List<LegacyService> services = new ArrayList<>();
    for (boolean deleted : List.of(false, true)) {
      for (String value : List.of(CURRENT, mlflow ? "http://localhost:5000" : "EXAMPLE.REALM")) {
        services.add(seedLegacy(mlflow, deleted, value, ns));
      }
    }
    var jdbi = TestSuiteBootstrap.getJdbi();
    MigrationDAO dao = jdbi.onDemand(MigrationDAO.class);
    var original =
        dao.listMetricsFromDBMigrations().stream()
            .filter(row -> row.getVersion().equals("2.0.8"))
            .findFirst()
            .orElseThrow();
    List<LoggedSql> sql =
        dao.getServerMigrationSQLWithVersion("2.0.8").stream()
            .map(checksum -> new LoggedSql(dao.getSqlQuery("2.0.8", checksum), checksum))
            .toList();
    try {
      jdbi.useHandle(
          handle -> {
            handle.execute("DELETE FROM SERVER_MIGRATION_SQL_LOGS WHERE version = '2.0.8'");
            handle.execute("DELETE FROM SERVER_CHANGE_LOG WHERE version = '2.0.8'");
          });
      runNormalUpgrade(migrationRoot);
      upgradeRecordsTheRepairIn208();
      for (LegacyService service : services) {
        assertLegacyEncrypted(service);
      }
      List<String> encrypted =
          services.stream().map(service -> stored(service.mlflow(), service.id())).toList();
      runNormalUpgrade(migrationRoot);
      assertEquals(
          encrypted,
          services.stream().map(service -> stored(service.mlflow(), service.id())).toList());
    } finally {
      dao.upsertServerMigration(
          original.getVersion(),
          original.getMigrationFileName(),
          original.getChecksum(),
          original.getMetrics());
      sql.forEach(row -> dao.upsertServerMigrationSQL("2.0.8", row.statement(), row.checksum()));
    }
  }

  @Test
  void upgradeRecordsTheRepairIn208() {
    MigrationDAO dao = TestSuiteBootstrap.getJdbi().onDemand(MigrationDAO.class);
    String marker = "data-migration-step:2.0.8:" + ConnectionSecretsEncryptionMigration.STEP_NAME;
    assertNotNull(dao.getSqlQuery("2.0.8", marker));
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void masksReadsAndPreservesMaskedWrites(boolean mlflow, TestNamespace ns) {
    JsonNode created = create(mlflow, ns);
    String id = created.path("id").asText();
    String path = collection(mlflow) + "/" + id;
    assertEquals(MASK, secret(created, mlflow));
    assertFalse(read(SdkClients.testUserClient(), path).hasNonNull("connection"));
    assertFalse(
        read(
                SdkClients.testUserClient(),
                collection(mlflow) + "/name/" + created.path("name").asText())
            .hasNonNull("connection"));
    assertEquals(MASK, secret(read(SdkClients.adminClient(), path), mlflow));
    assertEquals(
        MASK,
        secret(
            read(
                SdkClients.adminClient(),
                collection(mlflow) + "/name/" + created.path("name").asText()),
            mlflow));
    assertEquals(CURRENT, secret(read(SdkClients.botClient(), path), mlflow));
    JsonNode listed =
        read(SdkClients.adminClient(), collection(mlflow) + "?fields=connection&limit=1000000");
    assertTrue(listed.path("data").findValuesAsText("id").contains(id));
    listed
        .path("data")
        .forEach(
            row -> {
              if (id.equals(row.path("id").asText())) {
                assertEquals(MASK, secret(row, mlflow));
              }
            });
    Object request =
        mlflow
            ? new CreateMlModelService()
                .withName(created.path("name").asText())
                .withServiceType(CreateMlModelService.MlModelServiceType.Mlflow)
                .withConnection(
                    JsonUtils.convertValue(created.path("connection"), MlModelConnection.class))
                .withDescription("updated description")
            : new CreateDatabaseService()
                .withName(created.path("name").asText())
                .withServiceType(CreateDatabaseService.DatabaseServiceType.fromValue("Teradata"))
                .withConnection(
                    JsonUtils.convertValue(created.path("connection"), DatabaseConnection.class))
                .withDescription("updated description");
    write(HttpMethod.PUT, collection(mlflow), request);
    assertEquals(CURRENT, secret(read(SdkClients.botClient(), path), mlflow));
    JsonNode patch =
        JsonUtils.readTree(
            "[{\"op\":\"replace\",\"path\":\"/connection/config/"
                + field(mlflow)
                + "\",\"value\":\"*********\"}]");
    write(HttpMethod.PATCH, path, patch);
    assertEquals(CURRENT, secret(read(SdkClients.botClient(), path), mlflow));
    JsonNode history = read(SdkClients.adminClient(), path + "/versions");
    assertFalse(history.path("versions").isEmpty());
    history
        .path("versions")
        .forEach(
            version ->
                assertEquals(
                    MASK,
                    secret(
                        version.isTextual() ? JsonUtils.readTree(version.asText()) : version,
                        mlflow)));
    assertTrue(Fernet.isTokenized(secret(JsonUtils.readTree(stored(mlflow, id)), mlflow)));
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void migratesDeletedServicesAndHistoricalValuesIndependently(boolean mlflow, TestNamespace ns) {
    JsonNode service = create(mlflow, ns);
    String id = service.path("id").asText();
    write(HttpMethod.DELETE, collection(mlflow) + "/" + id, null);
    ObjectNode legacy = (ObjectNode) JsonUtils.readTree(stored(mlflow, id));
    ((ObjectNode) legacy.at("/connection/config")).put(field(mlflow), CURRENT);
    store(mlflow, id, legacy.toString());
    ObjectNode old = legacy.deepCopy();
    ((ObjectNode) old.at("/connection/config")).put(field(mlflow), PREVIOUS);
    String extension = (mlflow ? "mlmodelService" : "databaseService") + ".version.0.1";
    var dao = Entity.getCollectionDAO().entityExtensionDAO();
    dao.insert(
        UUID.fromString(id),
        extension,
        mlflow ? "mlmodelService" : "databaseService",
        old.toString());
    migrate();
    String current = stored(mlflow, id);
    String historical = dao.getExtension(UUID.fromString(id), extension);
    assertEquals(
        CURRENT, Fernet.getInstance().decrypt(secret(JsonUtils.readTree(current), mlflow)));
    assertEquals(
        PREVIOUS, Fernet.getInstance().decrypt(secret(JsonUtils.readTree(historical), mlflow)));
    assertTrue(JsonUtils.readTree(current).path("deleted").asBoolean());
    assertFalse(current.contains(CURRENT));
    assertFalse(historical.contains(PREVIOUS));
    migrate();
    assertEquals(current, stored(mlflow, id));
    assertEquals(historical, dao.getExtension(UUID.fromString(id), extension));
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void migratesMoreThanOnePageOfVersionsForTheSameService(boolean mlflow, TestNamespace ns) {
    JsonNode service = create(mlflow, ns);
    UUID id = UUID.fromString(service.path("id").asText());
    ObjectNode old = (ObjectNode) service.deepCopy();
    ((ObjectNode) old.at("/connection/config")).put(field(mlflow), PREVIOUS);
    String type = mlflow ? "mlmodelService" : "databaseService";
    List<String> extensions =
        IntStream.range(0, 1002).mapToObj(index -> type + ".version." + index + ".1").toList();
    List<String> rows =
        IntStream.range(0, 1002)
            .mapToObj(
                index -> {
                  ObjectNode version = old.deepCopy();
                  if (index % 2 != 0) {
                    ObjectNode config = (ObjectNode) version.at("/connection/config");
                    config.put("type", mlflow ? "Teradata" : "Mlflow");
                    config.put(mlflow ? "logdata" : "registryUri", "unrelated-value");
                  }
                  return version.toString();
                })
            .toList();
    var dao = Entity.getCollectionDAO().entityExtensionDAO();
    try {
      dao.insertMany(Collections.nCopies(1002, id), extensions, type, rows);
      List<String> originals =
          extensions.stream().map(extension -> dao.getExtension(id, extension)).toList();
      migrate();
      for (int index = 0; index < extensions.size(); index++) {
        String row = dao.getExtension(id, extensions.get(index));
        if (index % 2 == 0) {
          String stored = secret(JsonUtils.readTree(row), mlflow);
          assertTrue(Fernet.isTokenized(stored));
          assertEquals(PREVIOUS, Fernet.getInstance().decrypt(stored));
        } else {
          assertEquals(originals.get(index), row);
        }
      }
    } finally {
      extensions.forEach(extension -> dao.delete(id, extension));
    }
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void filtersCurrentRowsAndHistoryByTheirOwnConnectorType(boolean mlflow, TestNamespace ns) {
    String id = create(mlflow, ns).path("id").asText();
    String original = stored(mlflow, id);
    String type = mlflow ? "mlmodelService" : "databaseService";
    var dao = Entity.getCollectionDAO().entityExtensionDAO();
    List<String> extensions = new ArrayList<>();
    List<String> configs = new ArrayList<>(List.of("null", "false", "0", "[]", "\"text\"", "{}"));
    for (String connector :
        List.of(
            "\"Postgres\"",
            "\"CustomDatabase\"",
            mlflow ? "\"Teradata\"" : "\"Mlflow\"",
            "\"mlflow\"",
            "\"TERADATA\"",
            "\"Mlflow \"",
            "null",
            "0",
            "false",
            "[]",
            "{}")) {
      configs.add(
          "{\"type\":"
              + connector
              + ",\"registryUri\":\"unchanged-registry\",\"logdata\":\"unchanged-logdata\"}");
    }
    try {
      for (String config : configs) {
        ObjectNode row = (ObjectNode) JsonUtils.readTree(original);
        ((ObjectNode) row.path("connection")).set("config", JsonUtils.readTree(config));
        store(mlflow, id, row.toString());
        String extension = type + ".version.20." + extensions.size();
        extensions.add(extension);
        dao.insert(UUID.fromString(id), extension, type, row.toString());
        String current = stored(mlflow, id);
        String historical = dao.getExtension(UUID.fromString(id), extension);
        migrate();
        assertEquals(current, stored(mlflow, id), config);
        assertEquals(historical, dao.getExtension(UUID.fromString(id), extension), config);
      }
      ObjectNode previous = (ObjectNode) JsonUtils.readTree(original);
      ((ObjectNode) previous.at("/connection/config")).put(field(mlflow), PREVIOUS);
      String extension = type + ".version.21.0";
      extensions.add(extension);
      dao.insert(UUID.fromString(id), extension, type, previous.toString());
      String unrelatedCurrent = stored(mlflow, id);
      migrate();
      assertEquals(unrelatedCurrent, stored(mlflow, id));
      assertEquals(
          PREVIOUS,
          Fernet.getInstance()
              .decrypt(
                  secret(
                      JsonUtils.readTree(dao.getExtension(UUID.fromString(id), extension)),
                      mlflow)));
      store(mlflow, id, previous.toString());
      String unrelatedExtension = extensions.getFirst();
      String unrelatedHistory = dao.getExtension(UUID.fromString(id), unrelatedExtension);
      migrate();
      assertEquals(
          PREVIOUS,
          Fernet.getInstance().decrypt(secret(JsonUtils.readTree(stored(mlflow, id)), mlflow)));
      assertEquals(unrelatedHistory, dao.getExtension(UUID.fromString(id), unrelatedExtension));
    } finally {
      store(mlflow, id, original);
      extensions.forEach(extension -> dao.delete(UUID.fromString(id), extension));
    }
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void preservesValueShapesAndOnlyChangesTheTargetField(boolean mlflow, TestNamespace ns) {
    String id = create(mlflow, ns).path("id").asText();
    String original = stored(mlflow, id);
    String type = mlflow ? "mlmodelService" : "databaseService";
    var dao = Entity.getCollectionDAO().entityExtensionDAO();
    List<String> extensions = new ArrayList<>();
    try {
      for (FieldValue value : fieldValues()) {
        ObjectNode row = (ObjectNode) JsonUtils.readTree(original);
        ObjectNode config = (ObjectNode) row.at("/connection/config");
        config.put(mlflow ? "logdata" : "registryUri", "untouched-other-field");
        if (value.input() == null) {
          config.remove(field(mlflow));
        } else {
          config.set(field(mlflow), value.input());
        }
        store(mlflow, id, row.toString());
        String extension = type + ".version.22." + extensions.size();
        extensions.add(extension);
        dao.insert(UUID.fromString(id), extension, type, row.toString());
        String current = stored(mlflow, id);
        String historical = dao.getExtension(UUID.fromString(id), extension);
        migrate();
        String migrated = stored(mlflow, id);
        String migratedHistory = dao.getExtension(UUID.fromString(id), extension);
        assertFieldResult(mlflow, current, migrated, value);
        assertFieldResult(mlflow, historical, migratedHistory, value);
        migrate();
        assertEquals(migrated, stored(mlflow, id));
        assertEquals(migratedHistory, dao.getExtension(UUID.fromString(id), extension));
      }
    } finally {
      store(mlflow, id, original);
      extensions.forEach(extension -> dao.delete(UUID.fromString(id), extension));
    }
  }

  private List<FieldValue> fieldValues() {
    List<FieldValue> values = new ArrayList<>();
    for (String value :
        List.of(
            "",
            " \t\n ",
            "http://localhost:5000",
            "mysql+pymysql://user:p%40ss%2Fword@localhost/demo_db?option=a%26b",
            "demo.jwt/token+value=",
            "EXAMPLE.REALM",
            "secret:/my_registry",
            "quotes\" backslash\\ unicode λ日本語 🔑",
            "demo/value=".repeat(5000))) {
      values.add(new FieldValue(TextNode.valueOf(value), value));
    }
    for (String json :
        List.of(
            "null",
            "false",
            "true",
            "0",
            "42",
            "1.25",
            "[]",
            "[\"value\"]",
            "{}",
            "{\"value\":\"text\"}")) {
      values.add(new FieldValue(JsonUtils.readTree(json), null));
    }
    values.add(new FieldValue(null, null));
    values.add(
        new FieldValue(TextNode.valueOf(Fernet.getInstance().encrypt("stored-value")), null));
    return values;
  }

  private void assertFieldResult(boolean mlflow, String before, String after, FieldValue value) {
    if (value.plaintext() == null) {
      assertEquals(before, after);
    } else {
      ObjectNode actual = (ObjectNode) JsonUtils.readTree(after);
      assertEquals(value.plaintext(), Fernet.getInstance().decrypt(secret(actual, mlflow)));
      ((ObjectNode) actual.at("/connection/config")).set(field(mlflow), value.input());
      assertEquals(JsonUtils.readTree(before), actual);
    }
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void paginatesMatchingCurrentRowsAmongUnrelatedRows(boolean mlflow, TestNamespace ns) {
    JsonNode template = JsonUtils.readTree(stored(mlflow, create(mlflow, ns).path("id").asText()));
    var dao =
        mlflow
            ? Entity.getCollectionDAO().mlModelServiceDAO()
            : Entity.getCollectionDAO().dbServiceDAO();
    List<UUID> ids = new ArrayList<>();
    List<String> names = new ArrayList<>();
    List<String> rows = new ArrayList<>();
    for (int index = 0; index < 1002; index++) {
      UUID id = UUID.randomUUID();
      String name = ns.prefix("page_" + id);
      ObjectNode row = (ObjectNode) template.deepCopy();
      row.put("id", id.toString())
          .put("name", name)
          .put("fullyQualifiedName", name)
          .put("deleted", index % 3 == 0);
      ObjectNode config = (ObjectNode) row.at("/connection/config");
      config.put(field(mlflow), CURRENT);
      if (index % 2 != 0) {
        config.put("type", mlflow ? "Teradata" : "Mlflow");
        config.put(mlflow ? "logdata" : "registryUri", "unrelated-value");
      }
      ids.add(id);
      names.add(name);
      rows.add(row.toString());
    }
    try {
      dao.insertMany(dao.getTableName(), dao.getNameHashColumn(), names, rows);
      List<String> originals = ids.stream().map(id -> stored(mlflow, id.toString())).toList();
      migrate();
      for (int index = 0; index < ids.size(); index++) {
        String row = stored(mlflow, ids.get(index).toString());
        if (index % 2 == 0) {
          assertEquals(
              CURRENT, Fernet.getInstance().decrypt(secret(JsonUtils.readTree(row), mlflow)));
        } else {
          assertEquals(originals.get(index), row);
        }
      }
    } finally {
      ids.forEach(id -> dao.delete(dao.getTableName(), id));
    }
  }
}
