package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Pure Fluent API for Table operations.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.Tables.*;
 *
 * // Create
 * Table table = create()
 *     .name("table_name")
 *     .withDescription("Description")
 *     .execute();
 *
 * // Find and load
 * Table table = find(tableId)
 *     .includeOwners()
 *     .includeTags()
 *     .fetch();
 *
 * // Update
 * Table updated = find(tableId)
 *     .fetch()
 *     .withDescription("Updated description")
 *     .save();
 *
 * // Delete
 * find(tableId)
 *     .delete()
 *     .confirm();
 *
 * // List
 * list()
 *     .limit(50)
 *     .forEach(table -> process(table));
 * </pre>
 */
public final class Tables {
  private static OpenMetadataClient defaultClient;

  private Tables() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Tables.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static TableCreator create() {
    return new TableCreator(getClient());
  }

  public static Table create(CreateTable request) {
    return getClient().tables().create(request);
  }

  // ==================== Direct Access Methods ====================

  public static Table get(String id) {
    return getClient().tables().get(id);
  }

  public static Table get(String id, String fields) {
    return getClient().tables().get(id, fields);
  }

  public static Table get(String id, String fields, String include) {
    return getClient().tables().get(id, fields, include);
  }

  public static Table getByName(String fqn) {
    return getClient().tables().getByName(fqn);
  }

  public static Table getByName(String fqn, String fields) {
    return getClient().tables().getByName(fqn, fields);
  }

  public static Table update(String id, Table entity) {
    return getClient().tables().update(id, entity);
  }

  public static void delete(String id) {
    getClient().tables().delete(id);
  }

  public static void delete(String id, java.util.Map<String, String> params) {
    getClient().tables().delete(id, params);
  }

  public static void restore(String id) {
    getClient().tables().restore(id);
  }

  public static org.openmetadata.sdk.models.ListResponse<Table> list(
      org.openmetadata.sdk.models.ListParams params) {
    return getClient().tables().list(params);
  }

  public static org.openmetadata.schema.type.EntityHistory getVersionList(java.util.UUID id) {
    return getClient().tables().getVersionList(id);
  }

  public static Table getVersion(String id, Double version) {
    return getClient().tables().getVersion(id, version);
  }

  // ==================== Finding/Retrieval ====================

  public static TableFinder find(String id) {
    return new TableFinder(getClient(), id);
  }

  public static TableFinder find(UUID id) {
    return find(id.toString());
  }

  public static TableFinder findByName(String fqn) {
    return new TableFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static TableLister list() {
    return new TableLister(getClient());
  }

  public static org.openmetadata.sdk.fluent.collections.TableCollection collection() {
    return new org.openmetadata.sdk.fluent.collections.TableCollection(getClient());
  }

  // ==================== Import/Export ====================

  public static CsvExporter exportCsv(String tableName) {
    return new CsvExporter(getClient(), tableName);
  }

  public static CsvImporter importCsv(String tableName) {
    return new CsvImporter(getClient(), tableName);
  }

  // ==================== Creator ====================

  public static class TableCreator {
    private final OpenMetadataClient client;
    private final CreateTable request = new CreateTable();

    TableCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public TableCreator name(String name) {
      request.setName(name);
      return this;
    }

    public TableCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public TableCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public TableCreator inSchema(String schemaFQN) {
      request.setDatabaseSchema(schemaFQN);
      return this;
    }

    public TableCreator withColumns(List<Column> columns) {
      request.setColumns(columns);
      return this;
    }

    public TableCreator withColumns(Column... columns) {
      request.setColumns(Arrays.asList(columns));
      return this;
    }

    public TableCreator withTags(List<TagLabel> tags) {
      request.setTags(tags);
      return this;
    }

    public Table execute() {
      return client.tables().create(request);
    }

    public Table now() {
      return execute();
    }
  }

  // ==================== Finder ====================

  public static class TableFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    TableFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    TableFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    /**
     * Include owners field in response.
     * Prefer this over includeOwner (singular).
     */
    public TableFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public TableFinder includeTags() {
      includes.add("tags");
      return this;
    }

    public TableFinder includeAll() {
      includes.addAll(Arrays.asList("owners", "tags", "followers", "domains", "dataProducts"));
      return this;
    }

    public TableFinder withFields(String... fields) {
      includes.addAll(Arrays.asList(fields));
      return this;
    }

    public org.openmetadata.sdk.fluent.wrappers.FluentTable fetch() {
      Table table;
      if (includes.isEmpty()) {
        table = isFqn ? client.tables().getByName(identifier) : client.tables().get(identifier);
      } else {
        String fields = String.join(",", includes);
        table =
            isFqn
                ? client.tables().getByName(identifier, fields)
                : client.tables().get(identifier, fields);
      }
      return new org.openmetadata.sdk.fluent.wrappers.FluentTable(table, client);
    }

    public TableDeleter delete() {
      return new TableDeleter(client, identifier);
    }
  }

  // ==================== Deleter ====================

  public static class TableDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean recursive = false;
    private boolean hardDelete = false;

    public TableDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public TableDeleter recursively() {
      this.recursive = true;
      return this;
    }

    public TableDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (recursive) params.put("recursive", "true");
      if (hardDelete) params.put("hardDelete", "true");
      client.tables().delete(id, params);
    }
  }

  // ==================== Lister ====================

  public static class TableLister {
    private final OpenMetadataClient client;
    private final Map<String, String> filters = new HashMap<>();
    private Integer limit;
    private String after;

    TableLister(OpenMetadataClient client) {
      this.client = client;
    }

    public TableLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public TableLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public List<org.openmetadata.sdk.fluent.wrappers.FluentTable> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.tables().list(params);
      List<org.openmetadata.sdk.fluent.wrappers.FluentTable> items = new ArrayList<>();
      for (Table item : response.getData()) {
        items.add(new org.openmetadata.sdk.fluent.wrappers.FluentTable(item, client));
      }
      return items;
    }

    public void forEach(
        java.util.function.Consumer<org.openmetadata.sdk.fluent.wrappers.FluentTable> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentTable {
    private final Table table;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentTable(Table table, OpenMetadataClient client) {
      this.table = table;
      this.client = client;
    }

    public Table get() {
      return table;
    }

    public Table getTable() {
      return table;
    }

    public FluentTable withDescription(String description) {
      table.setDescription(description);
      modified = true;
      return this;
    }

    public FluentTable withDisplayName(String displayName) {
      table.setDisplayName(displayName);
      modified = true;
      return this;
    }

    public FluentTable withOwners(List<EntityReference> owners) {
      table.setOwners(owners);
      modified = true;
      return this;
    }

    public FluentTable withTags(List<TagLabel> tags) {
      table.setTags(tags);
      modified = true;
      return this;
    }

    public FluentTable withDomains(List<EntityReference> domain) {
      table.setDomains(domain);
      modified = true;
      return this;
    }

    public FluentTable withDataProducts(List<EntityReference> dataProducts) {
      table.setDataProducts(dataProducts);
      modified = true;
      return this;
    }

    public FluentTable withColumns(List<Column> columns) {
      table.setColumns(columns);
      modified = true;
      return this;
    }

    public FluentTable save() {
      if (modified) {
        Table updated = client.tables().update(table.getId().toString(), table);
        table.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    public TableDeleter delete() {
      return new TableDeleter(client, table.getId().toString());
    }
  }

  // ==================== CSV Exporter ====================

  public static class CsvExporter {
    private final OpenMetadataClient client;
    private final String tableName;
    private boolean async = false;

    CsvExporter(OpenMetadataClient client, String tableName) {
      this.client = client;
      this.tableName = tableName;
    }

    public CsvExporter async() {
      this.async = true;
      return this;
    }

    public String execute() {
      if (async) {
        return client.tables().exportCsvAsync(tableName);
      }
      return client.tables().exportCsv(tableName);
    }

    public String toCsv() {
      return execute();
    }
  }

  // ==================== CSV Importer ====================

  public static class CsvImporter {
    private final OpenMetadataClient client;
    private final String tableName;
    private String csvData;
    private boolean dryRun = false;
    private boolean async = false;

    CsvImporter(OpenMetadataClient client, String tableName) {
      this.client = client;
      this.tableName = tableName;
    }

    public CsvImporter withData(String csvData) {
      this.csvData = csvData;
      return this;
    }

    public CsvImporter fromFile(String filePath) {
      try {
        this.csvData =
            new String(java.nio.file.Files.readAllBytes(java.nio.file.Paths.get(filePath)));
      } catch (Exception e) {
        throw new RuntimeException("Failed to read CSV file: " + filePath, e);
      }
      return this;
    }

    public CsvImporter dryRun() {
      this.dryRun = true;
      return this;
    }

    public CsvImporter async() {
      this.async = true;
      return this;
    }

    public String execute() {
      if (csvData == null || csvData.isEmpty()) {
        throw new IllegalStateException("CSV data not provided. Use withData() or fromFile()");
      }

      if (async) {
        return client.tables().importCsvAsync(tableName, csvData);
      }
      return client.tables().importCsv(tableName, csvData, dryRun);
    }

    public String apply() {
      return execute();
    }
  }

  // ==================== Column Type Constants ====================
  // Expose all ColumnDataType enum values as static constants for easy access

  public static final String NUMBER = ColumnDataType.NUMBER.value();
  public static final String TINYINT = ColumnDataType.TINYINT.value();
  public static final String SMALLINT = ColumnDataType.SMALLINT.value();
  public static final String INT = ColumnDataType.INT.value();
  public static final String BIGINT = ColumnDataType.BIGINT.value();
  public static final String BYTEINT = ColumnDataType.BYTEINT.value();
  public static final String BYTES = ColumnDataType.BYTES.value();
  public static final String FLOAT = ColumnDataType.FLOAT.value();
  public static final String DOUBLE = ColumnDataType.DOUBLE.value();
  public static final String DECIMAL = ColumnDataType.DECIMAL.value();
  public static final String NUMERIC = ColumnDataType.NUMERIC.value();
  public static final String TIMESTAMP = ColumnDataType.TIMESTAMP.value();
  public static final String TIMESTAMPZ = ColumnDataType.TIMESTAMPZ.value();
  public static final String TIME = ColumnDataType.TIME.value();
  public static final String DATE = ColumnDataType.DATE.value();
  public static final String DATETIME = ColumnDataType.DATETIME.value();
  public static final String INTERVAL = ColumnDataType.INTERVAL.value();
  public static final String STRING = ColumnDataType.STRING.value();
  public static final String MEDIUMTEXT = ColumnDataType.MEDIUMTEXT.value();
  public static final String TEXT = ColumnDataType.TEXT.value();
  public static final String CHAR = ColumnDataType.CHAR.value();
  public static final String LONG = ColumnDataType.LONG.value();
  public static final String VARCHAR = ColumnDataType.VARCHAR.value();
  public static final String BOOLEAN = ColumnDataType.BOOLEAN.value();
  public static final String BINARY = ColumnDataType.BINARY.value();
  public static final String VARBINARY = ColumnDataType.VARBINARY.value();
  public static final String ARRAY = ColumnDataType.ARRAY.value();
  public static final String BLOB = ColumnDataType.BLOB.value();
  public static final String LONGBLOB = ColumnDataType.LONGBLOB.value();
  public static final String MEDIUMBLOB = ColumnDataType.MEDIUMBLOB.value();
  public static final String MAP = ColumnDataType.MAP.value();
  public static final String STRUCT = ColumnDataType.STRUCT.value();
  public static final String UNION = ColumnDataType.UNION.value();
  public static final String SET = ColumnDataType.SET.value();
  public static final String GEOGRAPHY = ColumnDataType.GEOGRAPHY.value();
  public static final String HEIRARCHY = ColumnDataType.HEIRARCHY.value();
  public static final String HIERARCHYID = ColumnDataType.HIERARCHYID.value();
  public static final String ENUM = ColumnDataType.ENUM.value();
  public static final String JSON = ColumnDataType.JSON.value();
  public static final String UUID = ColumnDataType.UUID.value();
  public static final String VARIANT = ColumnDataType.VARIANT.value();
  public static final String GEOMETRY = ColumnDataType.GEOMETRY.value();
  public static final String BYTEA = ColumnDataType.BYTEA.value();
  public static final String AGGREGATEFUNCTION = ColumnDataType.AGGREGATEFUNCTION.value();
  public static final String ERROR = ColumnDataType.ERROR.value();
  public static final String FIXED = ColumnDataType.FIXED.value();
  public static final String RECORD = ColumnDataType.RECORD.value();
  public static final String NULL = ColumnDataType.NULL.value();
  public static final String SUPER = ColumnDataType.SUPER.value();
  public static final String HLLSKETCH = ColumnDataType.HLLSKETCH.value();
  public static final String PG_LSN = ColumnDataType.PG_LSN.value();
  public static final String PG_SNAPSHOT = ColumnDataType.PG_SNAPSHOT.value();
  public static final String TSQUERY = ColumnDataType.TSQUERY.value();
  public static final String TXID_SNAPSHOT = ColumnDataType.TXID_SNAPSHOT.value();
  public static final String XML = ColumnDataType.XML.value();
  public static final String MACADDR = ColumnDataType.MACADDR.value();
  public static final String TSVECTOR = ColumnDataType.TSVECTOR.value();
  public static final String UNKNOWN = ColumnDataType.UNKNOWN.value();
  public static final String CIDR = ColumnDataType.CIDR.value();
  public static final String INET = ColumnDataType.INET.value();
  public static final String CLOB = ColumnDataType.CLOB.value();
  public static final String ROWID = ColumnDataType.ROWID.value();
  public static final String LOWCARDINALITY = ColumnDataType.LOWCARDINALITY.value();
  public static final String YEAR = ColumnDataType.YEAR.value();
  public static final String POINT = ColumnDataType.POINT.value();
  public static final String POLYGON = ColumnDataType.POLYGON.value();
  public static final String TUPLE = ColumnDataType.TUPLE.value();
  public static final String SPATIAL = ColumnDataType.SPATIAL.value();
  public static final String TABLE = ColumnDataType.TABLE.value();
  public static final String NTEXT = ColumnDataType.NTEXT.value();
  public static final String IMAGE = ColumnDataType.IMAGE.value();
  public static final String IPV4 = ColumnDataType.IPV_4.value();
  public static final String IPV6 = ColumnDataType.IPV_6.value();
  public static final String DATETIMERANGE = ColumnDataType.DATETIMERANGE.value();
  public static final String HLL = ColumnDataType.HLL.value();
  public static final String LARGEINT = ColumnDataType.LARGEINT.value();
  public static final String QUANTILE_STATE = ColumnDataType.QUANTILE_STATE.value();
  public static final String AGG_STATE = ColumnDataType.AGG_STATE.value();
  public static final String BITMAP = ColumnDataType.BITMAP.value();
  public static final String UINT = ColumnDataType.UINT.value();
  public static final String BIT = ColumnDataType.BIT.value();
  public static final String MONEY = ColumnDataType.MONEY.value();
  public static final String MEASURE_HIDDEN = ColumnDataType.MEASURE_HIDDEN.value();
  public static final String MEASURE_VISIBLE = ColumnDataType.MEASURE_VISIBLE.value();
  public static final String MEASURE = ColumnDataType.MEASURE.value();

  // Helper methods for parameterized types
  public static String VARCHAR(int length) {
    return "VARCHAR(" + length + ")";
  }

  public static String CHAR(int length) {
    return "CHAR(" + length + ")";
  }

  public static String DECIMAL(int precision, int scale) {
    return "DECIMAL(" + precision + "," + scale + ")";
  }

  public static String NUMERIC(int precision, int scale) {
    return "NUMERIC(" + precision + "," + scale + ")";
  }

  public static String VARBINARY(int length) {
    return "VARBINARY(" + length + ")";
  }

  public static String BINARY(int length) {
    return "BINARY(" + length + ")";
  }

  public static String BIT(int length) {
    return "BIT(" + length + ")";
  }

  public static String ARRAY(String elementType) {
    return "ARRAY<" + elementType + ">";
  }

  public static String MAP(String keyType, String valueType) {
    return "MAP<" + keyType + "," + valueType + ">";
  }

  public static String STRUCT(String... fields) {
    return "STRUCT<" + String.join(",", fields) + ">";
  }
}
