package org.openmetadata.service.util;

import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream;
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream;
import org.apache.commons.compress.compressors.gzip.GzipCompressorInputStream;
import org.apache.commons.compress.compressors.gzip.GzipCompressorOutputStream;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

@Slf4j
public class DatabaseBackupRestore {

  public static final int DEFAULT_BATCH_SIZE = 1000;
  private static final long MAX_METADATA_SIZE = 10 * 1024 * 1024;
  private static final Pattern SAFE_IDENTIFIER = Pattern.compile("^[a-zA-Z_][a-zA-Z0-9_]*$");
  private static final DateTimeFormatter BACKUP_TIMESTAMP_FORMAT =
      DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss").withZone(ZoneOffset.UTC);
  private static final List<String> EXCLUDED_TABLE_PREFIXES = List.of("act_", "flw_", "qrtz_");
  private static final ObjectMapper MAPPER =
      new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);

  private final Jdbi jdbi;
  private final ConnectionType connectionType;
  private final String databaseName;
  private final int batchSize;

  public DatabaseBackupRestore(Jdbi jdbi, ConnectionType connectionType, String databaseName) {
    this(jdbi, connectionType, databaseName, DEFAULT_BATCH_SIZE);
  }

  public DatabaseBackupRestore(
      Jdbi jdbi, ConnectionType connectionType, String databaseName, int batchSize) {
    this.jdbi = jdbi;
    this.connectionType = connectionType;
    this.databaseName = databaseName;
    this.batchSize = batchSize;
  }

  public List<String> discoverTables(Handle handle) {
    String sql;
    if (connectionType == ConnectionType.MYSQL) {
      sql =
          "SELECT table_name FROM information_schema.tables "
              + "WHERE table_type = 'BASE TABLE' AND table_schema = :db ORDER BY table_name";
      return handle.createQuery(sql).bind("db", databaseName).mapTo(String.class).list();
    } else {
      sql =
          "SELECT table_name FROM information_schema.tables "
              + "WHERE table_type = 'BASE TABLE' AND table_schema = current_schema() "
              + "ORDER BY table_name";
      return handle.createQuery(sql).mapTo(String.class).list();
    }
  }

  static boolean isExcludedFrameworkTable(String tableName) {
    String lower = tableName.toLowerCase();
    return EXCLUDED_TABLE_PREFIXES.stream().anyMatch(lower::startsWith);
  }

  public List<String> discoverColumns(Handle handle, String tableName) {
    String sql;
    if (connectionType == ConnectionType.MYSQL) {
      sql =
          "SELECT column_name FROM information_schema.columns "
              + "WHERE table_schema = :db AND table_name = :table "
              + "AND (extra NOT LIKE '%GENERATED%' OR extra IS NULL) "
              + "ORDER BY ordinal_position";
      return handle
          .createQuery(sql)
          .bind("db", databaseName)
          .bind("table", tableName)
          .mapTo(String.class)
          .list();
    } else {
      sql =
          "SELECT column_name FROM information_schema.columns "
              + "WHERE table_schema = current_schema() AND table_name = :table "
              + "AND (is_generated = 'NEVER' OR is_generated IS NULL) "
              + "ORDER BY ordinal_position";
      return handle.createQuery(sql).bind("table", tableName).mapTo(String.class).list();
    }
  }

  List<String> discoverPrimaryKeyColumns(Handle handle, String tableName) {
    String sql;
    if (connectionType == ConnectionType.MYSQL) {
      sql =
          "SELECT kcu.column_name FROM information_schema.key_column_usage kcu "
              + "WHERE kcu.table_schema = :db AND kcu.table_name = :table "
              + "AND kcu.constraint_name = 'PRIMARY' "
              + "ORDER BY kcu.ordinal_position";
      return handle
          .createQuery(sql)
          .bind("db", databaseName)
          .bind("table", tableName)
          .mapTo(String.class)
          .list();
    } else {
      sql =
          "SELECT kcu.column_name "
              + "FROM information_schema.table_constraints tc "
              + "JOIN information_schema.key_column_usage kcu "
              + "ON tc.constraint_name = kcu.constraint_name "
              + "AND tc.table_schema = kcu.table_schema "
              + "WHERE tc.table_schema = current_schema() AND tc.table_name = :table "
              + "AND tc.constraint_type = 'PRIMARY KEY' "
              + "ORDER BY kcu.ordinal_position";
      return handle.createQuery(sql).bind("table", tableName).mapTo(String.class).list();
    }
  }

  Set<String> discoverJsonbColumns(Handle handle, String tableName) {
    if (connectionType == ConnectionType.POSTGRES) {
      String sql =
          "SELECT column_name FROM information_schema.columns "
              + "WHERE table_schema = current_schema() AND table_name = :table "
              + "AND data_type = 'jsonb'";
      return new HashSet<>(
          handle.createQuery(sql).bind("table", tableName).mapTo(String.class).list());
    }
    return Set.of();
  }

  Map<String, String> discoverCastableColumns(Handle handle, String tableName) {
    if (connectionType == ConnectionType.POSTGRES) {
      String sql =
          "SELECT column_name, data_type FROM information_schema.columns "
              + "WHERE table_schema = current_schema() AND table_name = :table "
              + "AND data_type IN ('uuid', 'timestamp without time zone', 'timestamp with time zone')";
      Map<String, String> result = new HashMap<>();
      handle
          .createQuery(sql)
          .bind("table", tableName)
          .map(
              (rs, ctx) -> {
                result.put(rs.getString("column_name"), rs.getString("data_type"));
                return null;
              })
          .list();
      return result;
    }
    return Map.of();
  }

  static String pgCastFor(String dataType) {
    return switch (dataType) {
      case "uuid" -> "uuid";
      case "timestamp without time zone" -> "timestamp";
      case "timestamp with time zone" -> "timestamptz";
      default -> null;
    };
  }

  Set<String> discoverBinaryColumns(Handle handle, String tableName) {
    String sql;
    if (connectionType == ConnectionType.MYSQL) {
      sql =
          "SELECT column_name FROM information_schema.columns "
              + "WHERE table_schema = :db AND table_name = :table "
              + "AND data_type IN ('blob', 'tinyblob', 'mediumblob', 'longblob', 'binary', 'varbinary')";
      return new HashSet<>(
          handle
              .createQuery(sql)
              .bind("db", databaseName)
              .bind("table", tableName)
              .mapTo(String.class)
              .list());
    } else {
      sql =
          "SELECT column_name FROM information_schema.columns "
              + "WHERE table_schema = current_schema() AND table_name = :table "
              + "AND data_type = 'bytea'";
      return new HashSet<>(
          handle.createQuery(sql).bind("table", tableName).mapTo(String.class).list());
    }
  }

  public static String extractDatabaseName(String jdbcUrl) {
    String url = jdbcUrl;
    int questionMark = url.indexOf('?');
    if (questionMark > 0) {
      url = url.substring(0, questionMark);
    }
    int lastSlash = url.lastIndexOf('/');
    if (lastSlash < 0 || lastSlash == url.length() - 1) {
      throw new IllegalArgumentException("Cannot extract database name from JDBC URL: " + jdbcUrl);
    }
    String dbName = url.substring(lastSlash + 1);
    if (dbName.isEmpty()) {
      throw new IllegalArgumentException("Cannot extract database name from JDBC URL: " + jdbcUrl);
    }
    return dbName;
  }

  static String getCatalogVersion() {
    try (InputStream in = DatabaseBackupRestore.class.getResourceAsStream("/catalog/VERSION")) {
      if (in != null) {
        Properties props = new Properties();
        props.load(in);
        return props.getProperty("version", "unknown");
      }
    } catch (IOException e) {
      LOG.warn("Failed to read /catalog/VERSION", e);
    }
    return "unknown";
  }

  static List<String> queryMigrationVersions(Handle handle) {
    try {
      return handle
          .createQuery("SELECT version FROM SERVER_CHANGE_LOG ORDER BY version")
          .mapTo(String.class)
          .list();
    } catch (Exception e) {
      LOG.warn("Could not query SERVER_CHANGE_LOG for migration versions", e);
      return List.of();
    }
  }

  static String buildBackupFileName(String version, Instant timestamp) {
    String safeVersion = version.replace(".", "_");
    String ts = BACKUP_TIMESTAMP_FORMAT.format(timestamp);
    return String.format("openmetadata_%s_%s.tar.gz", safeVersion, ts);
  }

  public String backup(String backupDir) throws IOException {
    Path dir = Path.of(backupDir);
    if (!Files.isDirectory(dir)) {
      throw new IOException("Backup path is not a directory: " + backupDir);
    }
    String version = getCatalogVersion();
    String fileName = buildBackupFileName(version, Instant.now());
    Path backupFile = dir.resolve(fileName);
    String backupPath = backupFile.toString();

    LOG.info("Starting database backup to {}", backupPath);
    try (FileOutputStream fos = new FileOutputStream(backupPath);
        BufferedOutputStream bos = new BufferedOutputStream(fos);
        GzipCompressorOutputStream gzos = new GzipCompressorOutputStream(bos);
        TarArchiveOutputStream taos = new TarArchiveOutputStream(gzos)) {

      taos.setLongFileMode(TarArchiveOutputStream.LONGFILE_POSIX);

      ObjectNode metadata = MAPPER.createObjectNode();
      metadata.put("timestamp", Instant.now().toString());
      metadata.put("version", version);
      metadata.put("databaseType", connectionType.name());
      metadata.put("databaseName", databaseName);
      ObjectNode tablesMetadata = MAPPER.createObjectNode();

      jdbi.useHandle(
          handle -> {
            beginRepeatableReadTransaction(handle);
            try {
              List<String> migrationVersions = queryMigrationVersions(handle);
              ArrayNode versionsArray = MAPPER.createArrayNode();
              migrationVersions.forEach(versionsArray::add);
              metadata.set("migrationVersions", versionsArray);
              LOG.info(
                  "Recorded {} migration versions in backup metadata", migrationVersions.size());

              List<String> allTables = discoverTables(handle);
              List<String> tables =
                  allTables.stream()
                      .filter(t -> !isExcludedFrameworkTable(t))
                      .collect(Collectors.toList());
              LOG.info(
                  "Backing up {} tables ({} framework-managed tables skipped)",
                  tables.size(),
                  allTables.size() - tables.size());

              for (String tableName : tables) {
                backupTable(handle, tableName, taos, tablesMetadata);
              }
              commitTransaction(handle);
            } catch (Exception e) {
              rollbackTransaction(handle);
              throw e;
            }
          });

      metadata.set("tables", tablesMetadata);
      byte[] metadataBytes = MAPPER.writeValueAsBytes(metadata);
      TarArchiveEntry metadataEntry = new TarArchiveEntry("metadata.json");
      metadataEntry.setSize(metadataBytes.length);
      taos.putArchiveEntry(metadataEntry);
      taos.write(metadataBytes);
      taos.closeArchiveEntry();

      LOG.info("Backup completed successfully: {}", backupPath);
    }
    return backupPath;
  }

  private void beginRepeatableReadTransaction(Handle handle) {
    if (connectionType == ConnectionType.MYSQL) {
      handle.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      handle.execute("START TRANSACTION");
    } else {
      handle.execute("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    }
  }

  private void commitTransaction(Handle handle) {
    handle.execute("COMMIT");
  }

  private void rollbackTransaction(Handle handle) {
    try {
      handle.execute("ROLLBACK");
    } catch (Exception e) {
      LOG.warn("Failed to rollback transaction", e);
    }
  }

  private void backupTable(
      Handle handle, String tableName, TarArchiveOutputStream taos, ObjectNode tablesMetadata)
      throws IOException {
    List<String> columns = discoverColumns(handle, tableName);
    if (columns.isEmpty()) {
      LOG.warn("No columns found for table {}, skipping", tableName);
      return;
    }

    String quotedColumns = quoteColumns(columns);
    String quotedTable = quoteIdentifier(tableName);

    List<String> pkColumns = discoverPrimaryKeyColumns(handle, tableName);
    String orderByClause = buildOrderByClause(handle, tableName, pkColumns, columns);
    Set<String> binaryColumns = discoverBinaryColumns(handle, tableName);
    Set<String> jsonbColumns = discoverJsonbColumns(handle, tableName);

    Path tempFile = Files.createTempFile("backup_" + tableName + "_", ".json");
    int rowCount;
    try {
      rowCount =
          writeTableToTempFile(
              handle, quotedColumns, quotedTable, orderByClause, columns, tempFile);
      addTempFileToTar(taos, tempFile, "tables/" + tableName + ".json");
    } finally {
      Files.deleteIfExists(tempFile);
    }

    ObjectNode tableInfo = MAPPER.createObjectNode();
    ArrayNode columnsArray = MAPPER.createArrayNode();
    columns.forEach(columnsArray::add);
    tableInfo.set("columns", columnsArray);
    ArrayNode binaryColumnsArray = MAPPER.createArrayNode();
    binaryColumns.forEach(binaryColumnsArray::add);
    tableInfo.set("binaryColumns", binaryColumnsArray);
    if (!jsonbColumns.isEmpty()) {
      ArrayNode jsonbColumnsArray = MAPPER.createArrayNode();
      jsonbColumns.forEach(jsonbColumnsArray::add);
      tableInfo.set("jsonbColumns", jsonbColumnsArray);
    }
    tableInfo.put("rowCount", rowCount);
    tablesMetadata.set(tableName, tableInfo);

    LOG.info("Backed up table {} ({} rows, {} columns)", tableName, rowCount, columns.size());
  }

  private String buildOrderByClause(
      Handle handle, String tableName, List<String> pkColumns, List<String> allColumns) {
    if (!pkColumns.isEmpty()) {
      return " ORDER BY "
          + pkColumns.stream().map(this::quoteIdentifier).collect(Collectors.joining(", "));
    }
    Set<String> unorderableColumns = discoverUnorderableColumns(handle, tableName);
    List<String> orderableCandidates =
        allColumns.stream().filter(c -> !unorderableColumns.contains(c)).toList();
    if (orderableCandidates.isEmpty()) {
      if (connectionType == ConnectionType.POSTGRES) {
        return " ORDER BY ctid";
      }
      return "";
    }
    return " ORDER BY " + quoteIdentifier(orderableCandidates.get(0));
  }

  Set<String> discoverUnorderableColumns(Handle handle, String tableName) {
    String sql;
    if (connectionType == ConnectionType.MYSQL) {
      return Set.of();
    } else {
      sql =
          "SELECT column_name FROM information_schema.columns "
              + "WHERE table_schema = current_schema() AND table_name = :table "
              + "AND data_type = 'json'";
      return new HashSet<>(
          handle.createQuery(sql).bind("table", tableName).mapTo(String.class).list());
    }
  }

  private int writeTableToTempFile(
      Handle handle,
      String quotedColumns,
      String quotedTable,
      String orderByClause,
      List<String> columns,
      Path tempFile)
      throws IOException {
    int rowCount = 0;
    String sql = String.format("SELECT %s FROM %s%s", quotedColumns, quotedTable, orderByClause);
    int fetchSize = connectionType == ConnectionType.MYSQL ? Integer.MIN_VALUE : batchSize;

    try (OutputStream os = new BufferedOutputStream(new FileOutputStream(tempFile.toFile()));
        JsonGenerator gen = new JsonFactory().createGenerator(os);
        Stream<Map<String, Object>> rows =
            handle.createQuery(sql).setFetchSize(fetchSize).mapToMap().stream()) {
      gen.setCodec(MAPPER);
      gen.writeStartArray();

      var iter = rows.iterator();
      while (iter.hasNext()) {
        Map<String, Object> row = iter.next();
        gen.writeStartObject();
        for (String col : columns) {
          Object val = row.get(col);
          if (val == null) {
            gen.writeNullField(col);
          } else if (val instanceof Number number) {
            if (number instanceof Long l) {
              gen.writeNumberField(col, l);
            } else if (number instanceof Integer i) {
              gen.writeNumberField(col, i);
            } else if (number instanceof Double d) {
              gen.writeNumberField(col, d);
            } else if (number instanceof Float f) {
              gen.writeNumberField(col, f);
            } else if (number instanceof BigDecimal bd) {
              gen.writeNumberField(col, bd);
            } else {
              gen.writeNumberField(col, number.longValue());
            }
          } else if (val instanceof Boolean b) {
            gen.writeBooleanField(col, b);
          } else if (val instanceof byte[] bytes) {
            gen.writeBinaryField(col, bytes);
          } else {
            gen.writeStringField(col, val.toString());
          }
        }
        gen.writeEndObject();
        rowCount++;
      }

      gen.writeEndArray();
    }
    return rowCount;
  }

  private void addTempFileToTar(TarArchiveOutputStream taos, Path tempFile, String entryName)
      throws IOException {
    long fileSize = Files.size(tempFile);
    TarArchiveEntry entry = new TarArchiveEntry(entryName);
    entry.setSize(fileSize);
    taos.putArchiveEntry(entry);

    try (FileInputStream fis = new FileInputStream(tempFile.toFile())) {
      fis.transferTo(taos);
    }
    taos.closeArchiveEntry();
  }

  public void restore(String backupPath) throws IOException {
    LOG.info("Starting database restore from {}", backupPath);

    ObjectNode metadata = readBackupMetadata(backupPath);
    String backupDbType = metadata.get("databaseType").asText();
    if (!backupDbType.equals(connectionType.name())) {
      throw new IllegalStateException(
          String.format(
              "Backup database type '%s' does not match current connection type '%s'",
              backupDbType, connectionType.name()));
    }

    LOG.info(
        "Backup info - version: {}, timestamp: {}, databaseType: {}",
        metadata.get("version").asText(),
        metadata.get("timestamp").asText(),
        backupDbType);

    ObjectNode tablesMetadata = (ObjectNode) metadata.get("tables");

    Set<String> validTables = new HashSet<>();
    tablesMetadata
        .fieldNames()
        .forEachRemaining(
            t -> {
              if (!isExcludedFrameworkTable(t) && SAFE_IDENTIFIER.matcher(t).matches()) {
                validTables.add(t);
              }
            });

    Path tempDir = Files.createTempDirectory("om_restore_");
    try {
      extractArchive(backupPath, tempDir, validTables);
      validateArchiveCompleteness(tempDir, validTables);
      jdbi.useHandle(
          handle -> {
            Set<String> existingTables = new HashSet<>(discoverTables(handle));
            Set<String> restorableTables = new HashSet<>(validTables);
            restorableTables.retainAll(existingTables);

            if (restorableTables.size() < validTables.size()) {
              Set<String> skipped = new HashSet<>(validTables);
              skipped.removeAll(restorableTables);
              LOG.warn(
                  "Skipping {} tables from backup that do not exist in the current schema: {}",
                  skipped.size(),
                  skipped);
            }

            Map<String, Set<String>> dependencies = discoverForeignKeyDependencies(handle);
            List<String> insertOrder = topologicalSort(restorableTables, dependencies);

            ObjectNode restorableMetadata = MAPPER.createObjectNode();
            restorableTables.forEach(t -> restorableMetadata.set(t, tablesMetadata.get(t)));

            restoreTablesInOrder(handle, insertOrder, restorableMetadata, tempDir);
            resetSequences(handle);
            validateRestore(handle, restorableMetadata);
            LOG.info("Restore completed successfully");
          });
    } finally {
      cleanupTempDirectory(tempDir);
    }
  }

  public static ObjectNode readBackupMetadata(String backupPath) throws IOException {
    try (FileInputStream fis = new FileInputStream(backupPath);
        BufferedInputStream bis = new BufferedInputStream(fis);
        GzipCompressorInputStream gzis = new GzipCompressorInputStream(bis);
        TarArchiveInputStream tais = new TarArchiveInputStream(gzis)) {

      TarArchiveEntry entry;
      while ((entry = tais.getNextEntry()) != null) {
        if ("metadata.json".equals(entry.getName())) {
          if (entry.getSize() > MAX_METADATA_SIZE) {
            throw new IOException(
                "metadata.json exceeds maximum allowed size of " + MAX_METADATA_SIZE + " bytes");
          }
          byte[] content = tais.readNBytes((int) entry.getSize());
          ObjectNode node = (ObjectNode) MAPPER.readTree(content);
          for (String field : List.of("version", "databaseType", "tables")) {
            if (!node.has(field)) {
              throw new IOException("Backup metadata missing required field: " + field);
            }
          }
          return node;
        }
      }
    }
    throw new IOException("metadata.json not found in backup archive");
  }

  private void extractArchive(String backupPath, Path tempDir, Set<String> validTables)
      throws IOException {
    try (FileInputStream fis = new FileInputStream(backupPath);
        BufferedInputStream bis = new BufferedInputStream(fis);
        GzipCompressorInputStream gzis = new GzipCompressorInputStream(bis);
        TarArchiveInputStream tais = new TarArchiveInputStream(gzis)) {

      TarArchiveEntry entry;
      while ((entry = tais.getNextEntry()) != null) {
        String name = entry.getName();
        if (!name.startsWith("tables/") || !name.endsWith(".json")) {
          continue;
        }
        String tableName = name.substring("tables/".length(), name.length() - ".json".length());
        if (!validTables.contains(tableName)) {
          LOG.warn("Table {} from archive not in metadata, skipping", tableName);
          continue;
        }
        Path outFile = tempDir.resolve(tableName + ".json").normalize();
        if (!outFile.startsWith(tempDir)) {
          LOG.warn("Skipping archive entry with path outside temp directory: {}", name);
          continue;
        }
        try (OutputStream os = new BufferedOutputStream(new FileOutputStream(outFile.toFile()))) {
          tais.transferTo(os);
        }
      }
    }
  }

  private void validateArchiveCompleteness(Path tempDir, Set<String> expectedTables)
      throws IOException {
    Set<String> missing = new HashSet<>();
    for (String table : expectedTables) {
      if (!Files.exists(tempDir.resolve(table + ".json"))) {
        missing.add(table);
      }
    }
    if (!missing.isEmpty()) {
      throw new IOException(
          String.format(
              "Backup archive is incomplete: %d table(s) listed in metadata but missing from "
                  + "archive: %s",
              missing.size(), missing));
    }
  }

  private void resetSequences(Handle handle) {
    if (connectionType != ConnectionType.POSTGRES) {
      return;
    }
    List<Map<String, Object>> seqColumns =
        handle
            .createQuery(
                "SELECT table_name, column_name FROM information_schema.columns "
                    + "WHERE table_schema = current_schema() "
                    + "AND column_default LIKE 'nextval%'")
            .mapToMap()
            .list();

    for (Map<String, Object> row : seqColumns) {
      String tableName = (String) row.get("table_name");
      String columnName = (String) row.get("column_name");
      String sql =
          String.format(
              "SELECT setval(pg_get_serial_sequence(?, ?), "
                  + "COALESCE((SELECT MAX(%s) FROM %s), 1))",
              quoteIdentifier(columnName), quoteIdentifier(tableName));
      handle.createQuery(sql).bind(0, tableName).bind(1, columnName).mapTo(Long.class).findOne();
      LOG.info("Reset sequence for {}.{}", tableName, columnName);
    }
  }

  private void restoreTablesInOrder(
      Handle handle, List<String> orderedTables, ObjectNode tablesMetadata, Path tempDir)
      throws IOException {
    for (String tableName : orderedTables) {
      JsonNode tableMetaNode = tablesMetadata.get(tableName);
      if (tableMetaNode == null) {
        LOG.warn("No metadata found for table {}, skipping", tableName);
        continue;
      }
      Path tableFile = tempDir.resolve(tableName + ".json");
      if (!Files.exists(tableFile)) {
        LOG.warn("No data file found for table {}, skipping", tableName);
        continue;
      }

      List<String> columns = new ArrayList<>();
      tableMetaNode.get("columns").forEach(col -> columns.add(col.asText()));

      Set<String> binaryColumns = new HashSet<>();
      JsonNode binaryColumnsNode = tableMetaNode.get("binaryColumns");
      if (binaryColumnsNode != null) {
        binaryColumnsNode.forEach(col -> binaryColumns.add(col.asText()));
      }

      Set<String> jsonbColumns;
      JsonNode jsonbColumnsNode = tableMetaNode.get("jsonbColumns");
      if (jsonbColumnsNode != null) {
        jsonbColumns = new HashSet<>();
        jsonbColumnsNode.forEach(col -> jsonbColumns.add(col.asText()));
      } else {
        jsonbColumns = discoverJsonbColumns(handle, tableName);
      }

      Map<String, String> castableColumns = discoverCastableColumns(handle, tableName);

      handle.execute(String.format("DELETE FROM %s", quoteIdentifier(tableName)));
      LOG.info("Restoring table {}", tableName);
      try (InputStream is = new BufferedInputStream(new FileInputStream(tableFile.toFile()))) {
        int rowCount =
            insertRowsStreaming(
                handle, tableName, columns, binaryColumns, jsonbColumns, castableColumns, is);
        LOG.info("Restored table {} ({} rows)", tableName, rowCount);
      }
    }
  }

  void validateRestore(Handle handle, ObjectNode tablesMetadata) {
    LOG.info("Validating restore...");
    List<String> mismatches = new ArrayList<>();

    tablesMetadata
        .fields()
        .forEachRemaining(
            entry -> {
              String tableName = entry.getKey();
              JsonNode meta = entry.getValue();

              int expectedRows = meta.has("rowCount") ? meta.get("rowCount").asInt() : -1;
              int expectedColumns = meta.has("columns") ? meta.get("columns").size() : -1;

              long actualRows =
                  handle
                      .createQuery(
                          String.format("SELECT COUNT(*) FROM %s", quoteIdentifier(tableName)))
                      .mapTo(Long.class)
                      .one();

              if (expectedRows > 0) {
                LOG.info(
                    "Validated table {}: {} rows (expected {})",
                    tableName,
                    actualRows,
                    expectedRows);
              }

              if (expectedRows > 0 && actualRows != expectedRows) {
                mismatches.add(
                    String.format(
                        "Table %s: expected %d rows, found %d",
                        tableName, expectedRows, actualRows));
              }

              if (expectedColumns >= 0) {
                List<String> actualColumns = discoverColumns(handle, tableName);
                if (actualColumns.size() != expectedColumns) {
                  mismatches.add(
                      String.format(
                          "Table %s: expected %d columns, found %d",
                          tableName, expectedColumns, actualColumns.size()));
                }
              }
            });

    if (mismatches.isEmpty()) {
      LOG.info("Restore validation passed: all tables match expected row and column counts");
    } else {
      for (String mismatch : mismatches) {
        LOG.warn("Restore validation mismatch: {}", mismatch);
      }
      throw new IllegalStateException(
          "Restore validation failed with " + mismatches.size() + " mismatch(es): " + mismatches);
    }
  }

  Map<String, Set<String>> discoverForeignKeyDependencies(Handle handle) {
    String sql;
    if (connectionType == ConnectionType.MYSQL) {
      sql =
          "SELECT TABLE_NAME AS fk_table, REFERENCED_TABLE_NAME AS ref_table "
              + "FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE "
              + "WHERE REFERENCED_TABLE_NAME IS NOT NULL "
              + "AND TABLE_SCHEMA = :db";
    } else {
      sql =
          "SELECT tc.table_name AS fk_table, ccu.table_name AS ref_table "
              + "FROM information_schema.table_constraints tc "
              + "JOIN information_schema.constraint_column_usage ccu "
              + "ON tc.constraint_name = ccu.constraint_name "
              + "AND tc.table_schema = ccu.table_schema "
              + "WHERE tc.constraint_type = 'FOREIGN KEY' "
              + "AND tc.table_schema = current_schema()";
    }

    List<Map<String, Object>> rows;
    if (connectionType == ConnectionType.MYSQL) {
      rows = handle.createQuery(sql).bind("db", databaseName).mapToMap().list();
    } else {
      rows = handle.createQuery(sql).mapToMap().list();
    }

    Map<String, Set<String>> dependencies = new HashMap<>();
    for (Map<String, Object> row : rows) {
      String tableName = (String) row.get("fk_table");
      String referencedTable = (String) row.get("ref_table");
      dependencies.computeIfAbsent(tableName, k -> new HashSet<>()).add(referencedTable);
    }
    return dependencies;
  }

  static List<String> topologicalSort(
      Collection<String> tables, Map<String, Set<String>> dependsOn) {
    Set<String> tableSet = new HashSet<>(tables);
    Map<String, Integer> inDegree = new HashMap<>();
    Map<String, Set<String>> dependents = new HashMap<>();

    for (String table : tableSet) {
      inDegree.put(table, 0);
      dependents.put(table, new HashSet<>());
    }

    for (String table : tableSet) {
      for (String dep : dependsOn.getOrDefault(table, Set.of())) {
        if (tableSet.contains(dep) && !dep.equals(table)) {
          inDegree.merge(table, 1, Integer::sum);
          dependents.get(dep).add(table);
        }
      }
    }

    ArrayDeque<String> queue = new ArrayDeque<>();
    for (String table : tableSet) {
      if (inDegree.get(table) == 0) {
        queue.add(table);
      }
    }

    List<String> sorted = new ArrayList<>();
    while (!queue.isEmpty()) {
      String table = queue.poll();
      sorted.add(table);
      for (String dependent : dependents.getOrDefault(table, Set.of())) {
        int newDegree = inDegree.get(dependent) - 1;
        inDegree.put(dependent, newDegree);
        if (newDegree == 0) {
          queue.add(dependent);
        }
      }
    }

    if (sorted.size() != tableSet.size()) {
      LOG.warn("Circular FK dependencies detected; appending remaining tables");
      for (String table : tableSet) {
        if (!sorted.contains(table)) {
          sorted.add(table);
        }
      }
    }

    return sorted;
  }

  private static void cleanupTempDirectory(Path tempDir) {
    try (var stream = Files.list(tempDir)) {
      stream.forEach(
          path -> {
            try {
              Files.deleteIfExists(path);
            } catch (IOException e) {
              LOG.warn("Failed to delete temp file: {}", path, e);
            }
          });
      Files.deleteIfExists(tempDir);
    } catch (IOException e) {
      LOG.warn("Failed to clean up temp directory: {}", tempDir, e);
    }
  }

  int insertRowsStreaming(
      Handle handle,
      String tableName,
      List<String> columns,
      Set<String> binaryColumns,
      Set<String> jsonbColumns,
      Map<String, String> castableColumns,
      InputStream inputStream)
      throws IOException {
    String quotedColumns = quoteColumns(columns);
    String placeholders =
        columns.stream()
            .map(
                c -> {
                  if (jsonbColumns.contains(c)) return "CAST(? AS jsonb)";
                  String castType = castableColumns.get(c);
                  if (castType != null) {
                    String pgType = pgCastFor(castType);
                    if (pgType != null) return "CAST(? AS " + pgType + ")";
                  }
                  return "?";
                })
            .collect(Collectors.joining(", "));
    String sql =
        String.format(
            "INSERT INTO %s (%s) VALUES (%s)",
            quoteIdentifier(tableName), quotedColumns, placeholders);

    int totalRows = 0;
    try (JsonParser parser = new JsonFactory().createParser(inputStream)) {
      JsonToken token = parser.nextToken();
      if (token != JsonToken.START_ARRAY) {
        return 0;
      }

      var batch = handle.prepareBatch(sql);
      int batchCount = 0;

      while (parser.nextToken() != JsonToken.END_ARRAY) {
        ObjectNode row = MAPPER.readTree(parser);
        for (int idx = 0; idx < columns.size(); idx++) {
          String col = columns.get(idx);
          JsonNode val = row.get(col);
          if (val == null || val.isNull()) {
            batch.bind(idx, (Object) null);
          } else if (binaryColumns.contains(col)) {
            batch.bind(idx, Base64.getDecoder().decode(val.asText()));
          } else if (val.isNumber()) {
            if (val.isLong() || val.isInt() || val.isBigInteger()) {
              batch.bind(idx, val.longValue());
            } else {
              batch.bind(idx, val.doubleValue());
            }
          } else if (val.isBoolean()) {
            batch.bind(idx, val.booleanValue());
          } else {
            batch.bind(idx, val.asText());
          }
        }
        batch.add();
        batchCount++;
        totalRows++;

        if (batchCount >= batchSize) {
          batch.execute();
          batch = handle.prepareBatch(sql);
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        batch.execute();
      }
    }
    return totalRows;
  }

  String quoteIdentifier(String identifier) {
    if (!SAFE_IDENTIFIER.matcher(identifier).matches()) {
      throw new IllegalArgumentException("Invalid SQL identifier: " + identifier);
    }
    if (connectionType == ConnectionType.MYSQL) {
      return "`" + identifier + "`";
    }
    return "\"" + identifier + "\"";
  }

  String quoteColumns(List<String> columns) {
    return columns.stream().map(this::quoteIdentifier).collect(Collectors.joining(", "));
  }
}
