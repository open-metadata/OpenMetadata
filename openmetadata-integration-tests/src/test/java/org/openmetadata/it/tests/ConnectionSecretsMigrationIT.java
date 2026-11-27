package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.CURRENT;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.PREVIOUS;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.VERSION;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.collection;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.configureEncryption;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.create;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.field;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.migrate;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.preserveUpgradeState;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.read;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.runNormalUpgrade;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.secret;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.seedLegacy;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.seedServices;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.store;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.stored;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.storedRows;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.storedServices;
import static org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.table;
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
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.tests.ConnectionSecretsMigrationFixtures.LegacyService;
import org.openmetadata.it.util.NamespaceCleanup;
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

  private record FieldValue(JsonNode input, String plaintext) {}

  @ParameterizedTest
  @CsvSource({"true,true", "true,false", "false,true", "false,false"})
  void normalUpgradeHonorsEncryptionConfiguration(
      final boolean mlflow, final boolean encryptionEnabled, final TestNamespace ns)
      throws Exception {
    final var services = seedServices(mlflow, ns);
    final var plaintext = storedServices(services);
    try (final var state = preserveUpgradeState()) {
      state.resetLogs();
      configureEncryption(encryptionEnabled);
      runNormalUpgrade(migrationRoot, encryptionEnabled);
      upgradeRecordsTheRepairIn208();
      assertUpgradeResult(services, plaintext, encryptionEnabled);
      assertRepeatUpgrade(services, encryptionEnabled);
    }
  }

  private void assertUpgradeResult(
      final List<LegacyService> services,
      final List<List<String>> plaintext,
      final boolean encryptionEnabled) {
    if (encryptionEnabled) {
      services.forEach(ConnectionSecretsMigrationFixtures::assertLegacyEncrypted);
    } else {
      assertEquals(plaintext, storedServices(services));
    }
  }

  private void assertRepeatUpgrade(
      final List<LegacyService> services, final boolean encryptionEnabled) throws Exception {
    final var migrated = storedServices(services);
    runNormalUpgrade(migrationRoot, encryptionEnabled);
    assertEquals(migrated, storedServices(services));
    if (!encryptionEnabled) {
      configureEncryption(true);
      runNormalUpgrade(migrationRoot, true);
      assertEquals(migrated, storedServices(services));
    }
  }

  @ParameterizedTest
  @CsvSource({"true,false", "true,true", "false,false", "false,true"})
  void cleanupDeletesServicesAndHistory(
      final boolean mlflow, final boolean deleted, final TestNamespace ns) {
    final var service = seedLegacy(mlflow, deleted, CURRENT, ns);
    assertEquals(1, storedRows(table(mlflow), service.id()));
    assertTrue(storedRows("entity_extension", service.id()) > 0);
    NamespaceCleanup.deleteRoots(ns.drainTrackedRoots());
    assertEquals(0, storedRows(table(mlflow), service.id()));
    assertEquals(0, storedRows("entity_extension", service.id()));
  }

  @Test
  void upgradeRecordsTheRepairIn208() {
    final MigrationDAO dao = TestSuiteBootstrap.getJdbi().onDemand(MigrationDAO.class);
    final String marker =
        "data-migration-step:" + VERSION + ":" + ConnectionSecretsEncryptionMigration.STEP_NAME;
    assertNotNull(dao.getSqlQuery(VERSION, marker));
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void masksReadsAndPreservesMaskedWrites(final boolean mlflow, final TestNamespace ns) {
    final JsonNode created = create(mlflow, ns);
    final String id = created.path("id").asText();
    final String path = collection(mlflow) + "/" + id;
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
    final JsonNode listed =
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
    final Object request =
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
    final JsonNode patch =
        JsonUtils.readTree(
            "[{\"op\":\"replace\",\"path\":\"/connection/config/"
                + field(mlflow)
                + "\",\"value\":\"*********\"}]");
    write(HttpMethod.PATCH, path, patch);
    assertEquals(CURRENT, secret(read(SdkClients.botClient(), path), mlflow));
    final JsonNode history = read(SdkClients.adminClient(), path + "/versions");
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
  void migratesDeletedServicesAndHistoricalValuesIndependently(
      final boolean mlflow, final TestNamespace ns) {
    final JsonNode service = create(mlflow, ns);
    final String id = service.path("id").asText();
    write(HttpMethod.DELETE, collection(mlflow) + "/" + id, null);
    final ObjectNode legacy = (ObjectNode) JsonUtils.readTree(stored(mlflow, id));
    ((ObjectNode) legacy.at("/connection/config")).put(field(mlflow), CURRENT);
    store(mlflow, id, legacy.toString());
    final ObjectNode old = legacy.deepCopy();
    ((ObjectNode) old.at("/connection/config")).put(field(mlflow), PREVIOUS);
    final String extension = (mlflow ? "mlmodelService" : "databaseService") + ".version.0.1";
    final var dao = Entity.getCollectionDAO().entityExtensionDAO();
    dao.insert(
        UUID.fromString(id),
        extension,
        mlflow ? "mlmodelService" : "databaseService",
        old.toString());
    migrate();
    final String current = stored(mlflow, id);
    final String historical = dao.getExtension(UUID.fromString(id), extension);
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
  void migratesMoreThanOnePageOfVersionsForTheSameService(
      final boolean mlflow, final TestNamespace ns) {
    final JsonNode service = create(mlflow, ns);
    final UUID id = UUID.fromString(service.path("id").asText());
    final ObjectNode old = (ObjectNode) service.deepCopy();
    ((ObjectNode) old.at("/connection/config")).put(field(mlflow), PREVIOUS);
    final String type = mlflow ? "mlmodelService" : "databaseService";
    final List<String> extensions =
        IntStream.range(0, 1002).mapToObj(index -> type + ".version." + index + ".1").toList();
    final List<String> rows =
        IntStream.range(0, 1002)
            .mapToObj(
                index -> {
                  final ObjectNode version = old.deepCopy();
                  if (index % 2 != 0) {
                    final ObjectNode config = (ObjectNode) version.at("/connection/config");
                    config.put("type", mlflow ? "Teradata" : "Mlflow");
                    config.put(mlflow ? "logdata" : "registryUri", "unrelated-value");
                  }
                  return version.toString();
                })
            .toList();
    final var dao = Entity.getCollectionDAO().entityExtensionDAO();
    try {
      dao.insertMany(Collections.nCopies(1002, id), extensions, type, rows);
      final List<String> originals =
          extensions.stream().map(extension -> dao.getExtension(id, extension)).toList();
      migrate();
      for (int index = 0; index < extensions.size(); index++) {
        final String row = dao.getExtension(id, extensions.get(index));
        if (index % 2 == 0) {
          final String stored = secret(JsonUtils.readTree(row), mlflow);
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
  void filtersCurrentRowsAndHistoryByTheirOwnConnectorType(
      final boolean mlflow, final TestNamespace ns) {
    final String id = create(mlflow, ns).path("id").asText();
    final String original = stored(mlflow, id);
    final String type = mlflow ? "mlmodelService" : "databaseService";
    final var dao = Entity.getCollectionDAO().entityExtensionDAO();
    final List<String> extensions = new ArrayList<>();
    final List<String> configs =
        new ArrayList<>(List.of("null", "false", "0", "[]", "\"text\"", "{}"));
    for (final String connector :
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
      for (final String config : configs) {
        final ObjectNode row = (ObjectNode) JsonUtils.readTree(original);
        ((ObjectNode) row.path("connection")).set("config", JsonUtils.readTree(config));
        store(mlflow, id, row.toString());
        final String extension = type + ".version.20." + extensions.size();
        extensions.add(extension);
        dao.insert(UUID.fromString(id), extension, type, row.toString());
        final String current = stored(mlflow, id);
        final String historical = dao.getExtension(UUID.fromString(id), extension);
        migrate();
        assertEquals(current, stored(mlflow, id), config);
        assertEquals(historical, dao.getExtension(UUID.fromString(id), extension), config);
      }
      final ObjectNode previous = (ObjectNode) JsonUtils.readTree(original);
      ((ObjectNode) previous.at("/connection/config")).put(field(mlflow), PREVIOUS);
      final String extension = type + ".version.21.0";
      extensions.add(extension);
      dao.insert(UUID.fromString(id), extension, type, previous.toString());
      final String unrelatedCurrent = stored(mlflow, id);
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
      final String unrelatedExtension = extensions.getFirst();
      final String unrelatedHistory = dao.getExtension(UUID.fromString(id), unrelatedExtension);
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
  void preservesValueShapesAndOnlyChangesTheTargetField(
      final boolean mlflow, final TestNamespace ns) {
    final String id = create(mlflow, ns).path("id").asText();
    final String original = stored(mlflow, id);
    final String type = mlflow ? "mlmodelService" : "databaseService";
    final var dao = Entity.getCollectionDAO().entityExtensionDAO();
    final List<String> extensions = new ArrayList<>();
    try {
      for (final FieldValue value : fieldValues()) {
        final ObjectNode row = (ObjectNode) JsonUtils.readTree(original);
        final ObjectNode config = (ObjectNode) row.at("/connection/config");
        config.put(mlflow ? "logdata" : "registryUri", "untouched-other-field");
        if (value.input() == null) {
          config.remove(field(mlflow));
        } else {
          config.set(field(mlflow), value.input());
        }
        store(mlflow, id, row.toString());
        final String extension = type + ".version.22." + extensions.size();
        extensions.add(extension);
        dao.insert(UUID.fromString(id), extension, type, row.toString());
        final String current = stored(mlflow, id);
        final String historical = dao.getExtension(UUID.fromString(id), extension);
        migrate();
        final String migrated = stored(mlflow, id);
        final String migratedHistory = dao.getExtension(UUID.fromString(id), extension);
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
    final List<FieldValue> values = new ArrayList<>();
    for (final String value :
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
    for (final String json :
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

  private void assertFieldResult(
      final boolean mlflow, final String before, final String after, final FieldValue value) {
    if (value.plaintext() == null) {
      assertEquals(before, after);
    } else {
      final ObjectNode actual = (ObjectNode) JsonUtils.readTree(after);
      assertEquals(value.plaintext(), Fernet.getInstance().decrypt(secret(actual, mlflow)));
      ((ObjectNode) actual.at("/connection/config")).set(field(mlflow), value.input());
      assertEquals(JsonUtils.readTree(before), actual);
    }
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void paginatesMatchingCurrentRowsAmongUnrelatedRows(
      final boolean mlflow, final TestNamespace ns) {
    final JsonNode template =
        JsonUtils.readTree(stored(mlflow, create(mlflow, ns).path("id").asText()));
    final var dao =
        mlflow
            ? Entity.getCollectionDAO().mlModelServiceDAO()
            : Entity.getCollectionDAO().dbServiceDAO();
    final List<UUID> ids = new ArrayList<>();
    final List<String> names = new ArrayList<>();
    final List<String> rows = new ArrayList<>();
    for (int index = 0; index < 1002; index++) {
      final UUID id = UUID.randomUUID();
      final String name = ns.prefix("page_" + id);
      final ObjectNode row = (ObjectNode) template.deepCopy();
      row.put("id", id.toString())
          .put("name", name)
          .put("fullyQualifiedName", name)
          .put("deleted", index % 3 == 0);
      final ObjectNode config = (ObjectNode) row.at("/connection/config");
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
      final List<String> originals = ids.stream().map(id -> stored(mlflow, id.toString())).toList();
      migrate();
      for (int index = 0; index < ids.size(); index++) {
        final String row = stored(mlflow, ids.get(index).toString());
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
