package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
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
import org.openmetadata.service.jdbi3.MigrationDAO.ServerChangeLog;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.api.MigrationWorkflow;
import org.openmetadata.service.migration.utils.v208.ConnectionSecretsEncryptionMigration;

final class ConnectionSecretsMigrationFixtures {
  static final String VERSION = "2.0.8";
  static final String CURRENT = "demo-current-secret";
  static final String PREVIOUS = "demo-previous-secret";

  record LegacyService(
      boolean mlflow, String id, boolean deleted, String value, String extension) {}

  private record LoggedSql(String statement, String checksum) {}

  record UpgradeState(MigrationDAO dao, ServerChangeLog original, List<LoggedSql> statements)
      implements AutoCloseable {
    void resetLogs() {
      TestSuiteBootstrap.getJdbi()
          .useHandle(
              handle -> {
                handle.execute("DELETE FROM SERVER_MIGRATION_SQL_LOGS WHERE version = ?", VERSION);
                handle.execute("DELETE FROM SERVER_CHANGE_LOG WHERE version = ?", VERSION);
              });
    }

    @Override
    public void close() {
      configureEncryption(true);
      dao.upsertServerMigration(
          original.getVersion(),
          original.getMigrationFileName(),
          original.getChecksum(),
          original.getMetrics());
      statements.forEach(
          row -> dao.upsertServerMigrationSQL(VERSION, row.statement(), row.checksum()));
    }
  }

  static UpgradeState preserveUpgradeState() {
    final var dao = TestSuiteBootstrap.getJdbi().onDemand(MigrationDAO.class);
    final var original =
        dao.listMetricsFromDBMigrations().stream()
            .filter(row -> row.getVersion().equals(VERSION))
            .findFirst()
            .orElseThrow();
    final var statements =
        dao.getServerMigrationSQLWithVersion(VERSION).stream()
            .map(checksum -> new LoggedSql(dao.getSqlQuery(VERSION, checksum), checksum))
            .toList();
    return new UpgradeState(dao, original, statements);
  }

  static List<LegacyService> seedServices(final boolean mlflow, final TestNamespace ns) {
    final List<LegacyService> services = new ArrayList<>();
    for (final boolean deleted : List.of(false, true)) {
      for (final String value :
          List.of(CURRENT, mlflow ? "http://localhost:5000" : "EXAMPLE.REALM")) {
        services.add(seedLegacy(mlflow, deleted, value, ns));
      }
    }
    return services;
  }

  static List<List<String>> storedServices(final List<LegacyService> services) {
    return services.stream().map(ConnectionSecretsMigrationFixtures::storedLegacy).toList();
  }

  static void configureEncryption(final boolean enabled) {
    if (enabled) {
      Fernet.getInstance().setFernetKey(TestSuiteBootstrap.createApplicationConfigCopy());
    } else {
      Fernet.getInstance().setFernetKey((String) null);
    }
  }

  static int storedRows(final String table, final String id) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT COUNT(*) FROM " + table + " WHERE id = :id")
                    .bind("id", id)
                    .mapTo(Integer.class)
                    .one());
  }

  private ConnectionSecretsMigrationFixtures() {}

  static LegacyService seedLegacy(
      final boolean mlflow, final boolean deleted, final String value, final TestNamespace ns) {
    final JsonNode service = create(mlflow, ns);
    final String id = service.path("id").asText();
    if (deleted) {
      write(HttpMethod.DELETE, collection(mlflow) + "/" + id, null);
    }
    final ObjectNode legacy = (ObjectNode) JsonUtils.readTree(stored(mlflow, id));
    ((ObjectNode) legacy.at("/connection/config")).put(field(mlflow), value);
    store(mlflow, id, legacy.toString());
    ((ObjectNode) legacy.at("/connection/config")).put(field(mlflow), PREVIOUS);
    final String type = mlflow ? "mlmodelService" : "databaseService";
    final String extension = type + ".version.0.1";
    Entity.getCollectionDAO()
        .entityExtensionDAO()
        .insert(UUID.fromString(id), extension, type, legacy.toString());
    return new LegacyService(mlflow, id, deleted, value, extension);
  }

  static void assertLegacyEncrypted(final LegacyService service) {
    final JsonNode current = JsonUtils.readTree(stored(service.mlflow(), service.id()));
    assertEquals(service.value(), Fernet.getInstance().decrypt(secret(current, service.mlflow())));
    assertEquals(service.deleted(), current.path("deleted").asBoolean());
    final String historical =
        Entity.getCollectionDAO()
            .entityExtensionDAO()
            .getExtension(UUID.fromString(service.id()), service.extension());
    assertEquals(
        PREVIOUS,
        Fernet.getInstance().decrypt(secret(JsonUtils.readTree(historical), service.mlflow())));
  }

  static List<String> storedLegacy(final LegacyService service) {
    return List.of(
        stored(service.mlflow(), service.id()),
        Entity.getCollectionDAO()
            .entityExtensionDAO()
            .getExtension(UUID.fromString(service.id()), service.extension()));
  }

  static void runNormalUpgrade(final Path migrationRoot, final boolean encryptionEnabled)
      throws Exception {
    final var config = TestSuiteBootstrap.createApplicationConfigCopy();
    if (!encryptionEnabled) {
      config.getFernetConfiguration().setFernetKey(Fernet.FERNET_NO_ENCRYPTION);
    }
    final String dialect =
        TestSuiteBootstrap.getConnectionType() == ConnectionType.MYSQL ? "mysql" : "postgres";
    final Path relative =
        Path.of("bootstrap/sql/migrations/native", VERSION, dialect, "schemaChanges.sql");
    final Path source = Files.exists(relative) ? relative : Path.of("..").resolve(relative);
    final Path destination =
        Files.createDirectories(migrationRoot.resolve(VERSION).resolve(dialect))
            .resolve("schemaChanges.sql");
    Files.copy(source, destination, StandardCopyOption.REPLACE_EXISTING);
    final MigrationWorkflow workflow =
        new MigrationWorkflow(
            TestSuiteBootstrap.getJdbi(),
            migrationRoot.toString(),
            TestSuiteBootstrap.getConnectionType(),
            "",
            "",
            config,
            false);
    workflow.loadMigrations();
    workflow.runMigrationWorkflows(false);
  }

  static JsonNode create(final boolean mlflow, final TestNamespace ns) {
    final Object request =
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
    final JsonNode created = write(HttpMethod.POST, collection(mlflow), request);
    ns.trackRoot(
        mlflow ? Entity.MLMODEL_SERVICE : Entity.DATABASE_SERVICE,
        UUID.fromString(created.path("id").asText()));
    return created;
  }

  static JsonNode read(final OpenMetadataClient client, final String path) {
    return JsonUtils.readTree(client.getHttpClient().executeForString(HttpMethod.GET, path, null));
  }

  static JsonNode write(final HttpMethod method, final String path, final Object body) {
    final String json =
        SdkClients.adminClient().getHttpClient().executeForString(method, path, body);
    return json == null || json.isBlank() ? JsonUtils.readTree("{}") : JsonUtils.readTree(json);
  }

  static String stored(final boolean mlflow, final String id) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT json FROM " + table(mlflow) + " WHERE id = :id")
                    .bind("id", id)
                    .mapTo(String.class)
                    .one());
  }

  static void store(final boolean mlflow, final String id, final String json) {
    final String value =
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

  static void migrate() {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                ConnectionSecretsEncryptionMigration.encryptConnectionSecrets(
                    handle, TestSuiteBootstrap.getConnectionType()));
  }

  static String secret(final JsonNode entity, final boolean mlflow) {
    return entity.at("/connection/config/" + field(mlflow)).asText();
  }

  static String field(final boolean mlflow) {
    return mlflow ? "registryUri" : "logdata";
  }

  static String collection(final boolean mlflow) {
    return mlflow ? "/v1/services/mlmodelServices" : "/v1/services/databaseServices";
  }

  static String table(final boolean mlflow) {
    return mlflow ? "mlmodel_service_entity" : "dbservice_entity";
  }
}
