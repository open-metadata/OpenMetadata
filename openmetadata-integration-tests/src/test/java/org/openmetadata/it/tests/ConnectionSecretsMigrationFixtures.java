package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
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
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.api.MigrationWorkflow;
import org.openmetadata.service.migration.utils.v208.ConnectionSecretsEncryptionMigration;

final class ConnectionSecretsMigrationFixtures {
  static final String CURRENT = "demo-current-secret";
  static final String PREVIOUS = "demo-previous-secret";

  record LegacyService(
      boolean mlflow, String id, boolean deleted, String value, String extension) {}

  private ConnectionSecretsMigrationFixtures() {}

  static LegacyService seedLegacy(boolean mlflow, boolean deleted, String value, TestNamespace ns) {
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

  static void assertLegacyEncrypted(LegacyService service) {
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

  static void runNormalUpgrade(Path migrationRoot) throws Exception {
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

  static JsonNode create(boolean mlflow, TestNamespace ns) {
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

  static JsonNode read(OpenMetadataClient client, String path) {
    return JsonUtils.readTree(client.getHttpClient().executeForString(HttpMethod.GET, path, null));
  }

  static JsonNode write(HttpMethod method, String path, Object body) {
    String json = SdkClients.adminClient().getHttpClient().executeForString(method, path, body);
    return json == null || json.isBlank() ? JsonUtils.readTree("{}") : JsonUtils.readTree(json);
  }

  static String stored(boolean mlflow, String id) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT json FROM " + table(mlflow) + " WHERE id = :id")
                    .bind("id", id)
                    .mapTo(String.class)
                    .one());
  }

  static void store(boolean mlflow, String id, String json) {
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

  static void migrate() {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                ConnectionSecretsEncryptionMigration.encryptConnectionSecrets(
                    handle, TestSuiteBootstrap.getConnectionType()));
  }

  static String secret(JsonNode entity, boolean mlflow) {
    return entity.at("/connection/config/" + field(mlflow)).asText();
  }

  static String field(boolean mlflow) {
    return mlflow ? "registryUri" : "logdata";
  }

  static String collection(boolean mlflow) {
    return mlflow ? "/v1/services/mlmodelServices" : "/v1/services/databaseServices";
  }

  static String table(boolean mlflow) {
    return mlflow ? "mlmodel_service_entity" : "dbservice_entity";
  }
}
