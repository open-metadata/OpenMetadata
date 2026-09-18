package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.services.connections.database.SnowflakeConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;

/**
 * The 2.1.0 upgrade path for external S3 sample-data storage (collate#5995).
 *
 * <p>{@code sampleDataStorageConfig.config} used to hold a bucket name, prefix, file-path pattern,
 * overwrite flag and AWS credentials. The tightened schema admits an empty object and nothing else,
 * so every stored row still carrying the old shape stops deserializing on upgrade — {@code
 * UnrecognizedPropertyException} against the generated Java config class, {@code too_long} against
 * the generated Pydantic model on the ingestion side. The SQL migration is the only thing that
 * repairs those rows, and migration statements are checksummed as applied, so a backfill that
 * misses a table misses it permanently.
 *
 * <p>The first test proves the surgery on a real service row. The second pins the statement
 * inventory, because the shape hides at four different depths across seven tables and the paths
 * that are easiest to forget — Hive's {@code metastoreConnection}, SSIS/Wherescape's {@code
 * databaseConnection} — belong to connectors nobody thinks of as "a database service".
 */
@ExtendWith(TestNamespaceExtension.class)
public class SampleDataStorageMigrationIT {

  /** The full pre-upgrade shape, as the removed DataStorageConfig serialized it. */
  private static final String LEGACY_CONFIG =
      "{\"bucketName\":\"legacy\",\"prefix\":\"p\","
          + "\"filePathPattern\":\"{service_name}/sample_data.parquet\","
          + "\"overwriteData\":true,\"storageConfig\":{\"awsRegion\":\"us-east-1\"}}";

  /** Every (table, JSON path) pair the legacy shape can reach, derived from the schema graph. */
  private static final Map<String, List<String>> COVERED_PATHS = coveredPaths();

  private static Map<String, List<String>> coveredPaths() {
    Map<String, List<String>> paths = new LinkedHashMap<>();
    paths.put(
        "dbservice_entity",
        List.of("connection.config", "connection.config.metastoreConnection"));
    paths.put("dashboard_service_entity", List.of("connection.config.connection"));
    paths.put(
        "pipeline_service_entity",
        List.of("connection.config.connection", "connection.config.databaseConnection"));
    paths.put("metadata_service_entity", List.of("connection.config.connection"));
    paths.put(
        "automations_workflow",
        List.of(
            "request.connection.config",
            "request.connection.config.connection",
            "request.connection.config.metastoreConnection",
            "request.connection.config.databaseConnection"));
    paths.put("database_entity", List.of("databaseProfilerConfig"));
    paths.put("database_schema_entity", List.of("databaseSchemaProfilerConfig"));
    return paths;
  }

  @Test
  void migrationStripsTheLegacyShapeAndLeavesOpenMetadataHostedStorageAlone(TestNamespace ns) {
    DatabaseService legacy = createSnowflakeService(ns, "legacy");
    DatabaseService hosted = createSnowflakeService(ns, "hosted");

    // Direct SQL, because the API would reject the shape it no longer has a schema for — which is
    // exactly how these rows came to exist: they were written before the schema was tightened.
    injectStorageConfig(legacy.getId(), LEGACY_CONFIG);
    injectStorageConfig(hosted.getId(), "{}");

    assertThrows(
        Exception.class,
        () -> JsonUtils.readValue(storedConnectionConfig(legacy.getId()), SnowflakeConnection.class),
        "precondition: the legacy row is what breaks on upgrade");

    runSampleDataStorageStatements();

    assertNull(storageConfigNode(legacy.getId()), "the legacy node is removed outright");
    assertDoesNotThrow(
        () -> JsonUtils.readValue(storedConnectionConfig(legacy.getId()), SnowflakeConnection.class),
        "and the repaired row deserializes against the tightened schema");

    JsonNode preserved = storageConfigNode(hosted.getId());
    assertNotNull(preserved, "OpenMetadata-hosted storage is valid and must survive");
    assertEquals(0, preserved.size(), "untouched, not emptied by a blanket delete");

    runSampleDataStorageStatements();

    assertNull(storageConfigNode(legacy.getId()), "re-running the migration changes nothing");
    assertNotNull(storageConfigNode(hosted.getId()), "re-running the migration changes nothing");
  }

  @Test
  void everyPathTheLegacyShapeCanReachIsCoveredInBothDialects() {
    String mysql = readMigration("mysql");
    String postgres = readMigration("postgres");

    COVERED_PATHS.forEach(
        (table, prefixes) ->
            prefixes.forEach(
                prefix -> {
                  String mysqlPath = "'$." + prefix + ".sampleDataStorageConfig'";
                  String postgresPath =
                      "'{" + prefix.replace('.', ',') + ",sampleDataStorageConfig}'";
                  assertTrue(
                      mysql.contains(mysqlPath),
                      table + " is not stripped at " + prefix + " by the MySQL migration");
                  assertTrue(
                      postgres.contains(postgresPath),
                      table + " is not stripped at " + prefix + " by the Postgres migration");
                }));

    COVERED_PATHS
        .keySet()
        .forEach(
            table -> {
              assertTrue(mysql.contains("UPDATE " + table), "MySQL migration skips " + table);
              assertTrue(
                  postgres.contains("UPDATE " + table), "Postgres migration skips " + table);
            });
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
                            .withUsername("migration-user")
                            .withWarehouse("migration-warehouse")));
    return SdkClients.adminClient().databaseServices().create(request);
  }

  private void injectStorageConfig(UUID serviceId, String config) {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle -> {
              ObjectNode root = (ObjectNode) JsonUtils.readTree(readServiceJson(serviceId));
              ObjectNode connectionConfig =
                  (ObjectNode) root.get("connection").get("config");
              connectionConfig.set(
                  "sampleDataStorageConfig",
                  JsonUtils.getObjectNode("config", JsonUtils.readTree(config)));
              handle
                  .createUpdate(
                      "UPDATE dbservice_entity SET json = " + jsonBindExpression() + " WHERE id = :id")
                  .bind("json", JsonUtils.pojoToJson(root))
                  .bind("id", serviceId.toString())
                  .execute();
            });
  }

  private String readServiceJson(UUID serviceId) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT json FROM dbservice_entity WHERE id = :id")
                    .bind("id", serviceId.toString())
                    .mapTo(String.class)
                    .one());
  }

  private String storedConnectionConfig(UUID serviceId) {
    return JsonUtils.pojoToJson(
        JsonUtils.readTree(readServiceJson(serviceId)).get("connection").get("config"));
  }

  private JsonNode storageConfigNode(UUID serviceId) {
    JsonNode connectionConfig =
        JsonUtils.readTree(readServiceJson(serviceId)).get("connection").get("config");
    JsonNode storage = connectionConfig.get("sampleDataStorageConfig");
    return storage == null ? null : storage.get("config");
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
            .filter(sql -> sql.contains("sampleDataStorageConfig"))
            .toList();
    assertEquals(
        COVERED_PATHS.size(),
        statements.size(),
        "one statement per table the legacy shape can reach");
    TestSuiteBootstrap.getJdbi().useHandle(handle -> statements.forEach(handle::execute));
  }

  private String readMigration(String dialect) {
    try {
      return Files.readString(migrationFile(dialect));
    } catch (Exception e) {
      throw new IllegalStateException("Cannot read the 2.1.0 " + dialect + " migration", e);
    }
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
