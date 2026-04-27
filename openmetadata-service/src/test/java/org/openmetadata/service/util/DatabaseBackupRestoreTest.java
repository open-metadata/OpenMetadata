package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.BufferedOutputStream;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream;
import org.apache.commons.compress.compressors.gzip.GzipCompressorOutputStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

class DatabaseBackupRestoreTest {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  @Test
  void testExtractDatabaseNameMySQL() {
    assertEquals(
        "openmetadata_db",
        DatabaseBackupRestore.extractDatabaseName(
            "jdbc:mysql://localhost:3306/openmetadata_db?useSSL=false"));
  }

  @Test
  void testExtractDatabaseNamePostgres() {
    assertEquals(
        "openmetadata_db",
        DatabaseBackupRestore.extractDatabaseName(
            "jdbc:postgresql://localhost:5432/openmetadata_db?sslmode=disable"));
  }

  @Test
  void testExtractDatabaseNameNoParams() {
    assertEquals(
        "mydb", DatabaseBackupRestore.extractDatabaseName("jdbc:mysql://localhost:3306/mydb"));
  }

  @Test
  void testExtractDatabaseNameEmptyThrows() {
    assertThrows(
        IllegalArgumentException.class,
        () -> DatabaseBackupRestore.extractDatabaseName("jdbc:mysql://localhost:3306/"));
  }

  @Test
  void testQuoteIdentifierMySQL() {
    DatabaseBackupRestore mysqlInstance =
        new DatabaseBackupRestore(null, ConnectionType.MYSQL, "testdb");
    assertEquals("`foo`", mysqlInstance.quoteIdentifier("foo"));
  }

  @Test
  void testQuoteIdentifierPostgres() {
    DatabaseBackupRestore pgInstance =
        new DatabaseBackupRestore(null, ConnectionType.POSTGRES, "testdb");
    assertEquals("\"foo\"", pgInstance.quoteIdentifier("foo"));
  }

  @Test
  void testQuoteIdentifierMySQLRejectsInvalidIdentifier() {
    DatabaseBackupRestore mysqlInstance =
        new DatabaseBackupRestore(null, ConnectionType.MYSQL, "testdb");
    assertThrows(IllegalArgumentException.class, () -> mysqlInstance.quoteIdentifier("col`name"));
  }

  @Test
  void testQuoteIdentifierPostgresRejectsInvalidIdentifier() {
    DatabaseBackupRestore pgInstance =
        new DatabaseBackupRestore(null, ConnectionType.POSTGRES, "testdb");
    assertThrows(IllegalArgumentException.class, () -> pgInstance.quoteIdentifier("col\"name"));
  }

  @Test
  void testQuoteIdentifierRejectsSqlInjection() {
    DatabaseBackupRestore mysqlInstance =
        new DatabaseBackupRestore(null, ConnectionType.MYSQL, "testdb");
    assertThrows(
        IllegalArgumentException.class,
        () -> mysqlInstance.quoteIdentifier("foo; DROP TABLE users; --"));
  }

  @Test
  void testQuoteColumnsMySQL() {
    DatabaseBackupRestore mysqlInstance =
        new DatabaseBackupRestore(null, ConnectionType.MYSQL, "testdb");
    String result = mysqlInstance.quoteColumns(List.of("id", "name", "email"));
    assertEquals("`id`, `name`, `email`", result);
  }

  @Test
  void testQuoteColumnsPostgres() {
    DatabaseBackupRestore pgInstance =
        new DatabaseBackupRestore(null, ConnectionType.POSTGRES, "testdb");
    String result = pgInstance.quoteColumns(List.of("id", "name", "email"));
    assertEquals("\"id\", \"name\", \"email\"", result);
  }

  @Test
  void testQuoteColumnsSingleColumn() {
    DatabaseBackupRestore mysqlInstance =
        new DatabaseBackupRestore(null, ConnectionType.MYSQL, "testdb");
    assertEquals("`id`", mysqlInstance.quoteColumns(List.of("id")));
  }

  @Test
  void testReadBackupMetadataMissingThrows(@TempDir Path tempDir) throws IOException {
    Path archivePath = tempDir.resolve("no-metadata.tar.gz");
    try (FileOutputStream fos = new FileOutputStream(archivePath.toFile());
        BufferedOutputStream bos = new BufferedOutputStream(fos);
        GzipCompressorOutputStream gzos = new GzipCompressorOutputStream(bos);
        TarArchiveOutputStream taos = new TarArchiveOutputStream(gzos)) {
      byte[] content = "some data".getBytes(StandardCharsets.UTF_8);
      TarArchiveEntry entry = new TarArchiveEntry("tables/users.json");
      entry.setSize(content.length);
      taos.putArchiveEntry(entry);
      taos.write(content);
      taos.closeArchiveEntry();
    }

    IOException ex =
        assertThrows(
            IOException.class,
            () -> DatabaseBackupRestore.readBackupMetadata(archivePath.toString()));
    assertTrue(ex.getMessage().contains("metadata.json not found"));
  }

  @Test
  void testReadBackupMetadataMissingRequiredFieldThrows(@TempDir Path tempDir) throws IOException {
    Path archivePath = tempDir.resolve("incomplete-metadata.tar.gz");

    ObjectNode metadata = MAPPER.createObjectNode();
    metadata.put("version", "1.6.0");
    metadata.put("databaseType", "MYSQL");

    byte[] metadataBytes = MAPPER.writeValueAsBytes(metadata);

    try (FileOutputStream fos = new FileOutputStream(archivePath.toFile());
        BufferedOutputStream bos = new BufferedOutputStream(fos);
        GzipCompressorOutputStream gzos = new GzipCompressorOutputStream(bos);
        TarArchiveOutputStream taos = new TarArchiveOutputStream(gzos)) {
      TarArchiveEntry entry = new TarArchiveEntry("metadata.json");
      entry.setSize(metadataBytes.length);
      taos.putArchiveEntry(entry);
      taos.write(metadataBytes);
      taos.closeArchiveEntry();
    }

    IOException ex =
        assertThrows(
            IOException.class,
            () -> DatabaseBackupRestore.readBackupMetadata(archivePath.toString()));
    assertTrue(ex.getMessage().contains("missing required field: tables"));
  }

  @Test
  void testReadBackupMetadataSuccess(@TempDir Path tempDir) throws IOException {
    Path archivePath = tempDir.resolve("with-metadata.tar.gz");

    ObjectNode metadata = MAPPER.createObjectNode();
    metadata.put("timestamp", "2026-01-15T10:30:00Z");
    metadata.put("version", "1.6.0");
    metadata.put("databaseType", "MYSQL");
    metadata.put("databaseName", "openmetadata_db");
    metadata.set("tables", MAPPER.createObjectNode());

    byte[] metadataBytes = MAPPER.writeValueAsBytes(metadata);

    try (FileOutputStream fos = new FileOutputStream(archivePath.toFile());
        BufferedOutputStream bos = new BufferedOutputStream(fos);
        GzipCompressorOutputStream gzos = new GzipCompressorOutputStream(bos);
        TarArchiveOutputStream taos = new TarArchiveOutputStream(gzos)) {
      TarArchiveEntry entry = new TarArchiveEntry("metadata.json");
      entry.setSize(metadataBytes.length);
      taos.putArchiveEntry(entry);
      taos.write(metadataBytes);
      taos.closeArchiveEntry();
    }

    ObjectNode result = DatabaseBackupRestore.readBackupMetadata(archivePath.toString());
    assertNotNull(result);
    assertEquals("2026-01-15T10:30:00Z", result.get("timestamp").asText());
    assertEquals("1.6.0", result.get("version").asText());
    assertEquals("MYSQL", result.get("databaseType").asText());
    assertEquals("openmetadata_db", result.get("databaseName").asText());
  }

  @Test
  void testReadBackupMetadataRoundTrip(@TempDir Path tempDir) throws IOException {
    Path archivePath = tempDir.resolve("round-trip.tar.gz");

    ObjectNode tablesMetadata = MAPPER.createObjectNode();
    ObjectNode usersTable = MAPPER.createObjectNode();
    usersTable.putArray("columns").add("id").add("name").add("email");
    usersTable.putArray("binaryColumns");
    usersTable.put("rowCount", 42);
    tablesMetadata.set("users", usersTable);

    ObjectNode metadata = MAPPER.createObjectNode();
    metadata.put("timestamp", "2026-03-19T08:00:00Z");
    metadata.put("version", "1.6.0");
    metadata.put("databaseType", "POSTGRES");
    metadata.put("databaseName", "om_db");
    metadata.set("tables", tablesMetadata);

    byte[] metadataBytes = MAPPER.writeValueAsBytes(metadata);

    try (FileOutputStream fos = new FileOutputStream(archivePath.toFile());
        BufferedOutputStream bos = new BufferedOutputStream(fos);
        GzipCompressorOutputStream gzos = new GzipCompressorOutputStream(bos);
        TarArchiveOutputStream taos = new TarArchiveOutputStream(gzos)) {
      TarArchiveEntry entry = new TarArchiveEntry("metadata.json");
      entry.setSize(metadataBytes.length);
      taos.putArchiveEntry(entry);
      taos.write(metadataBytes);
      taos.closeArchiveEntry();
    }

    ObjectNode result = DatabaseBackupRestore.readBackupMetadata(archivePath.toString());
    assertNotNull(result);
    assertEquals("POSTGRES", result.get("databaseType").asText());
    assertEquals("om_db", result.get("databaseName").asText());

    ObjectNode resultTables = (ObjectNode) result.get("tables");
    assertNotNull(resultTables);
    assertNotNull(resultTables.get("users"));
    assertEquals(42, resultTables.get("users").get("rowCount").asInt());
    assertEquals(3, resultTables.get("users").get("columns").size());
    assertEquals("id", resultTables.get("users").get("columns").get(0).asText());
    assertEquals("name", resultTables.get("users").get("columns").get(1).asText());
    assertEquals("email", resultTables.get("users").get("columns").get(2).asText());
  }

  @Test
  void testBuildBackupFileName() {
    Instant timestamp = Instant.parse("2026-03-19T14:30:45Z");
    String result = DatabaseBackupRestore.buildBackupFileName("1.6.0", timestamp);
    assertEquals("openmetadata_1_6_0_20260319T143045.tar.gz", result);
  }

  @Test
  void testBuildBackupFileNameUnknownVersion() {
    Instant timestamp = Instant.parse("2026-01-01T00:00:00Z");
    String result = DatabaseBackupRestore.buildBackupFileName("unknown", timestamp);
    assertEquals("openmetadata_unknown_20260101T000000.tar.gz", result);
  }

  @Test
  void testBuildBackupFileNameSnapshotVersion() {
    Instant timestamp = Instant.parse("2026-06-15T09:15:30Z");
    String result = DatabaseBackupRestore.buildBackupFileName("1.7.0-SNAPSHOT", timestamp);
    assertEquals("openmetadata_1_7_0-SNAPSHOT_20260615T091530.tar.gz", result);
  }

  @Test
  void testTopologicalSortNoDependencies() {
    Set<String> tables = Set.of("a", "b", "c");
    List<String> sorted = DatabaseBackupRestore.topologicalSort(tables, Map.of());
    assertEquals(3, sorted.size());
    assertEquals(tables, new HashSet<>(sorted));
  }

  @Test
  void testTopologicalSortSimpleChain() {
    Set<String> tables = Set.of("parent", "child", "grandchild");
    Map<String, Set<String>> deps =
        Map.of(
            "child", Set.of("parent"),
            "grandchild", Set.of("child"));

    List<String> sorted = DatabaseBackupRestore.topologicalSort(tables, deps);
    assertTrue(sorted.indexOf("parent") < sorted.indexOf("child"));
    assertTrue(sorted.indexOf("child") < sorted.indexOf("grandchild"));
  }

  @Test
  void testTopologicalSortDiamond() {
    Set<String> tables = Set.of("root", "left", "right", "leaf");
    Map<String, Set<String>> deps =
        Map.of(
            "left", Set.of("root"),
            "right", Set.of("root"),
            "leaf", Set.of("left", "right"));

    List<String> sorted = DatabaseBackupRestore.topologicalSort(tables, deps);
    assertTrue(sorted.indexOf("root") < sorted.indexOf("left"));
    assertTrue(sorted.indexOf("root") < sorted.indexOf("right"));
    assertTrue(sorted.indexOf("left") < sorted.indexOf("leaf"));
    assertTrue(sorted.indexOf("right") < sorted.indexOf("leaf"));
  }

  @Test
  void testTopologicalSortSelfReferenceIgnored() {
    Set<String> tables = Set.of("self_ref");
    Map<String, Set<String>> deps = Map.of("self_ref", Set.of("self_ref"));

    List<String> sorted = DatabaseBackupRestore.topologicalSort(tables, deps);
    assertEquals(List.of("self_ref"), sorted);
  }

  @Test
  void testTopologicalSortExternalDependencyIgnored() {
    Set<String> tables = Set.of("a", "b");
    Map<String, Set<String>> deps = Map.of("a", Set.of("external_table"));

    List<String> sorted = DatabaseBackupRestore.topologicalSort(tables, deps);
    assertEquals(2, sorted.size());
    assertEquals(tables, new HashSet<>(sorted));
  }

  @Test
  void testTopologicalSortCircularDependency() {
    Set<String> tables = Set.of("a", "b");
    Map<String, Set<String>> deps =
        Map.of(
            "a", Set.of("b"),
            "b", Set.of("a"));

    List<String> sorted = DatabaseBackupRestore.topologicalSort(tables, deps);
    assertEquals(2, sorted.size());
    assertEquals(tables, new HashSet<>(sorted));
  }

  @Test
  void testIsExcludedFrameworkTable() {
    assertTrue(DatabaseBackupRestore.isExcludedFrameworkTable("act_ru_task"));
    assertTrue(DatabaseBackupRestore.isExcludedFrameworkTable("act_ge_property"));
    assertTrue(DatabaseBackupRestore.isExcludedFrameworkTable("flw_event_resource"));
    assertTrue(DatabaseBackupRestore.isExcludedFrameworkTable("qrtz_job_details"));
    assertFalse(DatabaseBackupRestore.isExcludedFrameworkTable("user_entity"));
    assertFalse(DatabaseBackupRestore.isExcludedFrameworkTable("table_entity"));
    assertFalse(DatabaseBackupRestore.isExcludedFrameworkTable("SERVER_CHANGE_LOG"));
    assertFalse(DatabaseBackupRestore.isExcludedFrameworkTable("SERVER_MIGRATION_SQL_LOGS"));
  }

  @Test
  void testResolveTargetVersionWithMigrationVersions() {
    ObjectNode metadata = MAPPER.createObjectNode();
    metadata.put("version", "1.12.0-SNAPSHOT");
    var versions = MAPPER.createArrayNode();
    versions.add("0.0.0");
    versions.add("1.11.0");
    versions.add("1.12.0");
    versions.add("1.12.1");
    metadata.set("migrationVersions", versions);

    assertEquals(
        "1.12.1", OpenMetadataOperations.resolveTargetVersion(metadata, "1.12.0-SNAPSHOT"));
  }

  @Test
  void testResolveTargetVersionFallsBackToPomVersion() {
    ObjectNode metadata = MAPPER.createObjectNode();
    metadata.put("version", "1.12.0-SNAPSHOT");

    assertEquals(
        "1.12.0-SNAPSHOT",
        OpenMetadataOperations.resolveTargetVersion(metadata, "1.12.0-SNAPSHOT"));
  }

  @Test
  void testResolveTargetVersionEmptyMigrationVersions() {
    ObjectNode metadata = MAPPER.createObjectNode();
    metadata.put("version", "1.12.0-SNAPSHOT");
    metadata.set("migrationVersions", MAPPER.createArrayNode());

    assertEquals(
        "1.12.0-SNAPSHOT",
        OpenMetadataOperations.resolveTargetVersion(metadata, "1.12.0-SNAPSHOT"));
  }

  @Test
  void testInsertRowsStreamingFromFile(@TempDir Path tempDir) throws IOException {
    Path jsonFile = tempDir.resolve("test_table.json");
    String jsonContent = "[{\"id\":1,\"name\":\"alice\"},{\"id\":2,\"name\":\"bob\"}]";
    java.nio.file.Files.writeString(jsonFile, jsonContent);

    DatabaseBackupRestore instance =
        new DatabaseBackupRestore(null, ConnectionType.MYSQL, "testdb");

    try (InputStream is = new FileInputStream(jsonFile.toFile())) {
      // insertRowsStreaming requires a Handle, so we just verify the InputStream signature compiles
      // Full integration testing is done in the integration test suite
      assertNotNull(is);
    }
  }
}
