package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
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
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateMlModelService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.services.connections.database.TeradataConnection;
import org.openmetadata.schema.services.connections.mlmodel.MlflowConnection;
import org.openmetadata.schema.type.MlModelConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.api.MigrationWorkflow;
import org.openmetadata.service.migration.utils.v208.ConnectionSecretsEncryptionMigration;

@Isolated("Runs the connection-secret migration over current and historical service rows")
@ExtendWith(TestNamespaceExtension.class)
class ConnectionSecretsMigrationIT {
  @TempDir Path migrationRoot;
  private static final String MASK = "*********";
  private static final String CURRENT = "demo-current-secret";
  private static final String PREVIOUS = "demo-previous-secret";

  private record LegacyService(
      boolean mlflow, String id, boolean deleted, String value, String extension) {}

  private record LoggedSql(String statement, String checksum) {}

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
      runNormalUpgrade();
      upgradeRecordsTheRepairIn208();
      for (LegacyService service : services) {
        assertLegacyEncrypted(service);
      }
      List<String> encrypted =
          services.stream().map(service -> stored(service.mlflow(), service.id())).toList();
      runNormalUpgrade();
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

  private LegacyService seedLegacy(
      boolean mlflow, boolean deleted, String value, TestNamespace ns) {
    JsonNode service = create(mlflow, ns);
    String id = service.path("id").asText();
    if (deleted) {
      write(HttpMethod.DELETE, collection(mlflow) + "/" + id, null);
    }
    ObjectNode legacy = (ObjectNode) JsonUtils.readTree(stored(mlflow, id));
    ((ObjectNode) legacy.at("/connection/config")).put(field(mlflow), value);
    store(mlflow, id, legacy.toString());
    ((ObjectNode) legacy.at("/connection/config")).put(field(mlflow), PREVIOUS);
    String type = mlflow ? "mlmodelService" : "databaseService";
    String extension = type + ".version.0.1";
    Entity.getCollectionDAO()
        .entityExtensionDAO()
        .insert(UUID.fromString(id), extension, type, legacy.toString());
    return new LegacyService(mlflow, id, deleted, value, extension);
  }

  private void assertLegacyEncrypted(LegacyService service) {
    JsonNode current = JsonUtils.readTree(stored(service.mlflow(), service.id()));
    assertEquals(service.value(), Fernet.getInstance().decrypt(secret(current, service.mlflow())));
    assertEquals(service.deleted(), current.path("deleted").asBoolean());
    String historical =
        Entity.getCollectionDAO()
            .entityExtensionDAO()
            .getExtension(UUID.fromString(service.id()), service.extension());
    assertEquals(
        PREVIOUS,
        Fernet.getInstance().decrypt(secret(JsonUtils.readTree(historical), service.mlflow())));
  }

  private void runNormalUpgrade() throws Exception {
    String dialect =
        TestSuiteBootstrap.getConnectionType() == ConnectionType.MYSQL ? "mysql" : "postgres";
    Path source = Path.of("bootstrap/sql/migrations/native/2.0.8", dialect, "schemaChanges.sql");
    source = Files.exists(source) ? source : Path.of("..").resolve(source);
    Path destination =
        Files.createDirectories(migrationRoot.resolve("2.0.8").resolve(dialect))
            .resolve("schemaChanges.sql");
    Files.copy(source, destination, StandardCopyOption.REPLACE_EXISTING);
    MigrationWorkflow workflow =
        new MigrationWorkflow(
            TestSuiteBootstrap.getJdbi(),
            migrationRoot.toString(),
            TestSuiteBootstrap.getConnectionType(),
            "",
            "",
            TestSuiteBootstrap.createApplicationConfigCopy(),
            false);
    workflow.loadMigrations();
    workflow.runMigrationWorkflows(false);
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
    assertEquals(MASK, secret(read(SdkClients.testUserClient(), path), mlflow));
    assertEquals(
        MASK,
        secret(
            read(
                SdkClients.testUserClient(),
                collection(mlflow) + "/name/" + created.path("name").asText()),
            mlflow));
    assertEquals(CURRENT, secret(read(SdkClients.botClient(), path), mlflow));
    JsonNode listed =
        read(SdkClients.testUserClient(), collection(mlflow) + "?fields=connection&limit=1000000");
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
    JsonNode history = read(SdkClients.testUserClient(), path + "/versions");
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
        IntStream.range(0, 501).mapToObj(index -> type + ".version." + index + ".1").toList();
    var dao = Entity.getCollectionDAO().entityExtensionDAO();
    dao.insertMany(
        Collections.nCopies(501, id), extensions, type, Collections.nCopies(501, old.toString()));
    migrate();
    for (String extension : extensions) {
      String stored = secret(JsonUtils.readTree(dao.getExtension(id, extension)), mlflow);
      assertTrue(Fernet.isTokenized(stored));
      assertEquals(PREVIOUS, Fernet.getInstance().decrypt(stored));
    }
  }

  private JsonNode create(boolean mlflow, TestNamespace ns) {
    Object request =
        mlflow
            ? new CreateMlModelService()
                .withName(ns.prefix("mlflow_" + UUID.randomUUID().toString().substring(0, 8)))
                .withServiceType(CreateMlModelService.MlModelServiceType.Mlflow)
                .withConnection(
                    new MlModelConnection()
                        .withConfig(
                            new MlflowConnection()
                                .withTrackingUri("http://localhost:5000")
                                .withRegistryUri(CURRENT)))
            : new CreateDatabaseService()
                .withName(ns.prefix("teradata_" + UUID.randomUUID().toString().substring(0, 8)))
                .withServiceType(CreateDatabaseService.DatabaseServiceType.fromValue("Teradata"))
                .withConnection(
                    new DatabaseConnection()
                        .withConfig(
                            new TeradataConnection()
                                .withHostPort("localhost:1025")
                                .withUsername("user")
                                .withLogdata(CURRENT)));
    return write(HttpMethod.POST, collection(mlflow), request);
  }

  private JsonNode read(OpenMetadataClient client, String path) {
    return JsonUtils.readTree(client.getHttpClient().executeForString(HttpMethod.GET, path, null));
  }

  private JsonNode write(HttpMethod method, String path, Object body) {
    String json = SdkClients.adminClient().getHttpClient().executeForString(method, path, body);
    return json == null || json.isBlank() ? JsonUtils.readTree("{}") : JsonUtils.readTree(json);
  }

  private String stored(boolean mlflow, String id) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT json FROM " + table(mlflow) + " WHERE id = :id")
                    .bind("id", id)
                    .mapTo(String.class)
                    .one());
  }

  private void store(boolean mlflow, String id, String json) {
    String value =
        TestSuiteBootstrap.getConnectionType() == ConnectionType.POSTGRES
            ? "CAST(:json AS jsonb)"
            : ":json";
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate(
                        "UPDATE " + table(mlflow) + " SET json = " + value + " WHERE id = :id")
                    .bind("id", id)
                    .bind("json", json)
                    .execute());
  }

  private void migrate() {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                ConnectionSecretsEncryptionMigration.encryptConnectionSecrets(
                    handle, TestSuiteBootstrap.getConnectionType()));
  }

  private String secret(JsonNode entity, boolean mlflow) {
    return entity.at("/connection/config/" + field(mlflow)).asText();
  }

  private String field(boolean mlflow) {
    return mlflow ? "registryUri" : "logdata";
  }

  private String collection(boolean mlflow) {
    return mlflow ? "/v1/services/mlmodelServices" : "/v1/services/databaseServices";
  }

  private String table(boolean mlflow) {
    return mlflow ? "mlmodel_service_entity" : "dbservice_entity";
  }
}
