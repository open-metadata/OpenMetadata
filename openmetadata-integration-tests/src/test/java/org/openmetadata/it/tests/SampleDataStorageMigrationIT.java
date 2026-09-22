package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.services.connections.database.SnowflakeConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;

/**
 * The 2.1.0 upgrade path for external S3 sample-data storage (collate#5995).
 *
 * <p>{@code sampleDataStorageConfig} used to hold a bucket name, prefix, file-path pattern,
 * overwrite flag and AWS credentials. Removing external storage left it able to hold nothing at
 * all, so the property itself was dropped from every connection and profiler schema. Connection
 * schemas set {@code additionalProperties: false}, so every stored row still carrying the key —
 * the legacy S3 shape and the empty OpenMetadata-hosted object alike — stops deserializing on
 * upgrade with an {@code UnrecognizedPropertyException} against the generated Java config class.
 * The SQL migration is the only thing that repairs those rows, and migration statements are
 * checksummed as applied, so a backfill that misses a table misses it permanently.
 *
 * <p>The first test proves the surgery on real service rows, in both shapes, and proves it takes
 * nothing else out of the connection with it. The second proves it on a version snapshot, because
 * version history is a second copy of the same JSON that {@code EntityRepository.getVersion}
 * deserializes into the same POJO — repairing only the live row leaves {@code GET
 * .../versions/{version}} broken.
 *
 * <p>Which paths the backfill has to reach is pinned in {@code SampleDataStorageMigrationPathsTest}
 * rather than restated here. This class only pins the statement count, so a table cannot be dropped
 * from the migration without one of the two tests noticing.
 *
 * <p>Isolated rather than concurrent: reproducing the pre-upgrade state means parking a row in
 * {@code dbservice_entity} that no longer deserializes, and until the migration runs any other test
 * listing database services would read it and fail.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class SampleDataStorageMigrationIT {

  /** The full pre-upgrade shape, as the removed DataStorageConfig serialized it. */
  private static final String LEGACY_CONFIG =
      "{\"bucketName\":\"legacy\",\"prefix\":\"p\","
          + "\"filePathPattern\":\"{service_name}/sample_data.parquet\","
          + "\"overwriteData\":true,\"storageConfig\":{\"awsRegion\":\"us-east-1\"}}";

  /** Every table the removed property can reach; one backfill statement each. */
  private static final List<String> BACKFILLED_TABLES =
      List.of(
          "dbservice_entity",
          "dashboard_service_entity",
          "pipeline_service_entity",
          "metadata_service_entity",
          "automations_workflow",
          "database_entity",
          "database_schema_entity",
          "entity_extension");

  private static final String CONNECTION = "connection";
  private static final String CONFIG = "config";
  private static final String STORAGE_CONFIG = "sampleDataStorageConfig";
  private static final String SERVICE_ENTITY_TYPE = "databaseService";
  private static final String VERSION_EXTENSION = "databaseService.version.0.1";
  private static final String USERNAME = "username";
  private static final String CONNECTION_USERNAME = "migration-user";

  @Test
  void migrationRemovesEveryStoredShapeAndTakesNothingElseWithIt(TestNamespace ns) {
    DatabaseService legacy = createSnowflakeService(ns, "legacy");
    DatabaseService hosted = createSnowflakeService(ns, "hosted");

    // Direct SQL, because the API would reject the shape it no longer has a schema for — which is
    // exactly how these rows came to exist: they were written before the property was removed.
    injectStorageConfig(legacy.getId(), LEGACY_CONFIG);
    injectStorageConfig(hosted.getId(), "{}");

    assertThrows(
        JsonParsingException.class,
        () -> readConnectionConfig(serviceJson(legacy.getId())),
        "precondition: the legacy row is what breaks on upgrade");
    assertThrows(
        JsonParsingException.class,
        () -> readConnectionConfig(serviceJson(hosted.getId())),
        "precondition: so is the empty hosted row, now that the property is gone");

    runSampleDataStorageStatements();

    assertRepaired(legacy.getId(), "the legacy node is removed outright");
    assertRepaired(hosted.getId(), "so is the empty hosted node");

    runSampleDataStorageStatements();

    assertRepaired(legacy.getId(), "re-running the migration changes nothing");
    assertRepaired(hosted.getId(), "re-running the migration changes nothing");
  }

  /** The holder is gone, the rest of the connection is not, and the row parses again. */
  private void assertRepaired(UUID serviceId, String because) {
    String json = serviceJson(serviceId);
    assertNull(storageConfigNode(json), because);
    assertEquals(
        CONNECTION_USERNAME,
        connectionField(json, USERNAME),
        "only the holder is removed, not the connection around it");
    assertDoesNotThrow(
        () -> readConnectionConfig(json),
        "and the repaired row deserializes against the tightened schema");
  }

  @Test
  void migrationRepairsVersionSnapshotsAndNotOnlyLiveRows(TestNamespace ns) {
    DatabaseService service = createSnowflakeService(ns, "versioned");
    insertLegacyVersionSnapshot(service.getId());

    assertThrows(
        JsonParsingException.class,
        () -> readConnectionConfig(snapshotJson(service.getId())),
        "precondition: the snapshot is what breaks GET .../versions/{version}");

    runSampleDataStorageStatements();

    assertNull(
        storageConfigNode(snapshotJson(service.getId())),
        "version history is repaired, not just the live row");
    assertDoesNotThrow(
        () -> readConnectionConfig(snapshotJson(service.getId())),
        "and the repaired snapshot deserializes against the tightened schema");
  }

  private DatabaseService createSnowflakeService(TestNamespace ns, String suffix) {
    CreateDatabaseService request =
        new CreateDatabaseService()
            .withName(ns.prefix("sample_data_storage_" + suffix + "_" + ns.uniqueShortId()))
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Snowflake)
            .withConnection(
                new DatabaseConnection()
                    .withConfig(
                        new SnowflakeConnection()
                            .withAccount("migration-test")
                            .withUsername(CONNECTION_USERNAME)
                            .withWarehouse("migration-warehouse")));
    return SdkClients.adminClient().databaseServices().create(request);
  }

  private void injectStorageConfig(UUID serviceId, String config) {
    String json = JsonUtils.pojoToJson(withStorageConfig(serviceJson(serviceId), config));
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate(
                        "UPDATE dbservice_entity SET json = "
                            + jsonBindExpression()
                            + " WHERE id = :id")
                    .bind("json", json)
                    .bind("id", serviceId.toString())
                    .execute());
  }

  /**
   * A snapshot can only hold the legacy shape because it was written before the schema was
   * tightened, so it goes in the same way the upgrade finds it: as a row, not through the API.
   */
  private void insertLegacyVersionSnapshot(UUID serviceId) {
    String json = JsonUtils.pojoToJson(withStorageConfig(serviceJson(serviceId), LEGACY_CONFIG));
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate(
                        "INSERT INTO entity_extension (id, extension, jsonSchema, json) "
                            + "VALUES (:id, :extension, :jsonSchema, "
                            + jsonBindExpression()
                            + ")")
                    .bind("id", serviceId.toString())
                    .bind("extension", VERSION_EXTENSION)
                    .bind("jsonSchema", SERVICE_ENTITY_TYPE)
                    .bind("json", json)
                    .execute());
  }

  private static ObjectNode withStorageConfig(String entityJson, String config) {
    ObjectNode root = (ObjectNode) JsonUtils.readTree(entityJson);
    ObjectNode connectionConfig = (ObjectNode) root.get(CONNECTION).get(CONFIG);
    connectionConfig.set(
        STORAGE_CONFIG, JsonUtils.getObjectNode(CONFIG, JsonUtils.readTree(config)));
    return root;
  }

  private String serviceJson(UUID serviceId) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT json FROM dbservice_entity WHERE id = :id")
                    .bind("id", serviceId.toString())
                    .mapTo(String.class)
                    .one());
  }

  private String snapshotJson(UUID serviceId) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT json FROM entity_extension "
                            + "WHERE id = :id AND extension = :extension")
                    .bind("id", serviceId.toString())
                    .bind("extension", VERSION_EXTENSION)
                    .mapTo(String.class)
                    .one());
  }

  private static SnowflakeConnection readConnectionConfig(String entityJson) {
    JsonNode config = JsonUtils.readTree(entityJson).get(CONNECTION).get(CONFIG);
    return JsonUtils.readValue(JsonUtils.pojoToJson(config), SnowflakeConnection.class);
  }

  private static JsonNode storageConfigNode(String entityJson) {
    return JsonUtils.readTree(entityJson).get(CONNECTION).get(CONFIG).get(STORAGE_CONFIG);
  }

  private static String connectionField(String entityJson, String field) {
    return JsonUtils.readTree(entityJson).get(CONNECTION).get(CONFIG).get(field).asText();
  }

  /** Postgres stores the entity as JSONB, so the bound string needs an explicit cast. */
  private String jsonBindExpression() {
    return TestSuiteBootstrap.getConnectionType() == ConnectionType.POSTGRES
        ? "CAST(:json AS JSONB)"
        : ":json";
  }

  private void runSampleDataStorageStatements() {
    List<String> statements =
        MigrationFile.parseSQLFile(
                migrationFile(
                        TestSuiteBootstrap.getConnectionType() == ConnectionType.POSTGRES
                            ? "postgres"
                            : "mysql")
                    .toFile(),
                TestSuiteBootstrap.getConnectionType())
            .stream()
            .filter(sql -> sql.contains(STORAGE_CONFIG))
            .toList();
    assertEquals(
        BACKFILLED_TABLES.size(),
        statements.size(),
        "one statement per table the removed property can reach");
    TestSuiteBootstrap.getJdbi().useHandle(handle -> statements.forEach(handle::execute));
  }

  private Path migrationFile(String dialect) {
    Path file =
        Path.of(
            "bootstrap",
            "sql",
            "migrations",
            "native",
            "2.1.0",
            dialect,
            "postDataMigrationSQLScript.sql");
    return Files.exists(file) ? file : Path.of("..").resolve(file);
  }
}
