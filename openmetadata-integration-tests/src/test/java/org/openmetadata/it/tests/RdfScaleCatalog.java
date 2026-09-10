package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.IntFunction;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.util.FullyQualifiedName;
import org.postgresql.PGConnection;
import org.postgresql.copy.CopyIn;

/** SQL fixtures isolate RDF indexing cost from API ingestion and search-index construction. */
final class RdfScaleCatalog {
  static final String BASE = "https://open-metadata.org/";
  private static final int COPY_BATCH = 100;
  private static final int EXTENSION_EVERY = 1000;
  private final Jdbi database;
  private final Settings settings;
  private final DatabaseService service;
  private final DatabaseSchema schema;
  private final UUID namespace = UUID.randomUUID();
  private final long timestamp = System.currentTimeMillis();

  record Settings(int tables, int edges, int wideEvery, int wideColumns, int detailedEvery) {
    Settings {
      if (tables < 256
          || tables > 1_000_000
          || edges < tables
          || edges > (long) tables * 32
          || wideEvery < 1
          || wideColumns < 7
          || wideColumns > 2000
          || detailedEvery < 1) {
        throw new IllegalArgumentException("Invalid RDF scale fixture size");
      }
    }

    static Settings configured() {
      return new Settings(
          Integer.getInteger("rdfScaleTables", 200_000),
          Integer.getInteger("rdfScaleEdges", 2_000_000),
          Integer.getInteger("rdfScaleWideEvery", 100),
          Integer.getInteger("rdfScaleWideColumns", 500),
          Integer.getInteger("rdfScaleDetailedEvery", 100));
    }
  }

  RdfScaleCatalog(final Jdbi database, final Settings settings, final TestNamespace testNamespace) {
    this.database = database;
    this.settings = settings;
    service =
        DatabaseServiceTestFactory.createPostgresWithName(
            "rdf_scale_" + testNamespace.shortPrefix(), testNamespace);
    schema = DatabaseSchemaTestFactory.createSimpleWithName("sc_fixture", testNamespace, service);
    // The scale launcher owns the entire test database. Recursive API cleanup would enqueue
    // millions of unrelated delete operations just before those containers are destroyed.
    testNamespace.drainTrackedRoots();
  }

  void seed() throws SQLException {
    copy(
        "table_entity (fqnHash, json)",
        settings.tables(),
        index ->
            csv(FullyQualifiedName.buildHash(fqn(index)))
                + ","
                + csv(JsonUtils.pojoToJson(table(index))));
    copy(
        "entity_relationship (fromId, toId, fromEntity, toEntity, relation, json)",
        settings.tables(),
        index ->
            csv(schema.getId().toString())
                + ","
                + csv(id(index).toString())
                + ",databaseSchema,table,"
                + Relationship.CONTAINS.ordinal()
                + ",");
    copy(
        "entity_relationship (fromId, toId, fromEntity, toEntity, relation, json)",
        settings.edges(),
        this::lineageRow);
    seedExtensions();
    database.useHandle(
        handle -> {
          handle.execute("ANALYZE table_entity");
          handle.execute("ANALYZE entity_relationship");
        });
    verifyApiSamples();
  }

  private void seedExtensions() throws SQLException {
    final var client = SdkClients.adminClient().getHttpClient();
    final Type tableType =
        client.execute(HttpMethod.GET, "/v1/metadata/types/name/table", null, Type.class);
    for (var property : Map.of("costCenter", "string", "scaleOrdinal", "integer").entrySet()) {
      final Type fieldType =
          client.execute(
              HttpMethod.GET, "/v1/metadata/types/name/" + property.getValue(), null, Type.class);
      client.execute(
          HttpMethod.PUT,
          "/v1/metadata/types/" + tableType.getId(),
          new CustomProperty()
              .withName(property.getKey())
              .withDescription("RDF scale fixture property")
              .withPropertyType(fieldType.getEntityReference()),
          Type.class);
    }
    copy(
        "entity_extension (id, extension, jsonschema, json)",
        Math.ceilDiv(settings.tables(), EXTENSION_EVERY) * 2,
        this::extensionRow);
  }

  private String extensionRow(final int index) {
    final int tableIndex = (index / 2) * EXTENSION_EVERY;
    final boolean costCenter = index % 2 == 0;
    return csv(id(tableIndex).toString())
        + ",table.customProperties."
        + (costCenter ? "costCenter" : "scaleOrdinal")
        + ",customFieldSchema,"
        + csv(JsonUtils.pojoToJson(costCenter ? "engineering" : tableIndex));
  }

  private void copy(final String target, final int count, final IntFunction<String> row)
      throws SQLException {
    database.useHandle(
        handle -> {
          final PGConnection connection = handle.getConnection().unwrap(PGConnection.class);
          final CopyIn copy =
              connection.getCopyAPI().copyIn("COPY " + target + " FROM STDIN WITH (FORMAT csv)");
          try {
            final StringBuilder batch = new StringBuilder();
            for (int index = 0; index < count; index++) {
              batch.append(row.apply(index)).append('\n');
              if ((index + 1) % COPY_BATCH == 0 || index + 1 == count) {
                final byte[] bytes = batch.toString().getBytes(StandardCharsets.UTF_8);
                copy.writeToCopy(bytes, 0, bytes.length);
                batch.setLength(0);
              }
              if ((index + 1) % 10_000 == 0)
                System.out.printf("RDF_SCALE seed %s %d/%d%n", target, index + 1, count);
            }
            assertEquals(count, copy.endCopy());
          } finally {
            if (copy.isActive()) copy.cancelCopy();
          }
        });
  }

  private String lineageRow(final int index) {
    final int source = index % (settings.tables() - 128);
    final int output = source + 1 + index / (settings.tables() - 128);
    final String details =
        index % settings.detailedEvery() == 0
            ? csv(JsonUtils.pojoToJson(details(source, output)))
            : "";
    return csv(id(source).toString())
        + ","
        + csv(id(output).toString())
        + ",table,table,"
        + Relationship.UPSTREAM.ordinal()
        + ","
        + details;
  }

  private LineageDetails details(final int source, final int output) {
    return new LineageDetails()
        .withSqlQuery("SELECT col_0 FROM " + fqn(source))
        .withDescription("RDF scale validation lineage")
        .withSource(LineageDetails.Source.MANUAL)
        .withCreatedAt(timestamp)
        .withUpdatedAt(timestamp)
        .withCreatedBy("admin")
        .withUpdatedBy("admin")
        .withColumnsLineage(
            List.of(
                new ColumnLineage()
                    .withFromColumns(List.of(fqn(source) + ".col_0"))
                    .withToColumn(fqn(output) + ".col_0")
                    .withFunction("identity")));
  }

  private Table table(final int index) {
    final int width = index % settings.wideEvery() == 0 ? settings.wideColumns() : 7;
    return new Table()
        .withId(id(index))
        .withName(name(index))
        .withFullyQualifiedName(fqn(index))
        .withDescription("rdfscalevalidation catalog table " + index)
        .withColumns(columns(index, width))
        .withDatabaseSchema(schema.getEntityReference())
        .withDatabase(schema.getDatabase())
        .withService(service.getEntityReference())
        .withServiceType(service.getServiceType())
        .withVersion(0.1)
        .withUpdatedAt(timestamp)
        .withUpdatedBy("admin")
        .withDeleted(false);
  }

  private List<Column> columns(final int index, final int count) {
    final List<Column> columns = new ArrayList<>(count);
    for (int column = 0; column < count; column++) {
      columns.add(
          new Column()
              .withName("col_" + column)
              .withDataType(ColumnDataType.VARCHAR)
              .withDataLength(255)
              .withOrdinalPosition(column + 1)
              .withFullyQualifiedName(fqn(index) + ".col_" + column)
              .withDescription("RDF scale fixture column " + column));
    }
    return columns;
  }

  private void verifyApiSamples() {
    for (int index : List.of(0, 1, settings.tables() / 2, settings.tables() - 1)) {
      final Table actual =
          SdkClients.adminClient()
              .getHttpClient()
              .execute(
                  HttpMethod.GET,
                  "/v1/tables/" + id(index) + "?fields=extension",
                  null,
                  Table.class);
      assertEquals(fqn(index), actual.getFullyQualifiedName());
      assertEquals(
          index % settings.wideEvery() == 0 ? settings.wideColumns() : 7,
          actual.getColumns().size());
      assertEquals(schema.getId(), actual.getDatabaseSchema().getId());
      if (index % EXTENSION_EVERY == 0) {
        final var extension = JsonUtils.valueToTree(actual.getExtension());
        assertEquals("engineering", extension.path("costCenter").asText());
        assertEquals(index, extension.path("scaleOrdinal").asInt());
      }
    }
    assertTrue(
        database.withHandle(
                handle ->
                    handle
                        .createQuery(
                            "SELECT COUNT(*) FROM entity_relationship WHERE relation = :relation AND fromEntity = 'table' AND toEntity = 'table'")
                        .bind("relation", Relationship.UPSTREAM.ordinal())
                        .mapTo(Long.class)
                        .one())
            >= settings.edges());
  }

  UUID id(final int index) {
    return new UUID(namespace.getMostSignificantBits(), index + 1L);
  }

  String uri(final int index) {
    return BASE + "entity/table/" + id(index);
  }

  String fqn(final int index) {
    return schema.getFullyQualifiedName() + "." + name(index);
  }

  String schemaFqn() {
    return schema.getFullyQualifiedName();
  }

  Settings settings() {
    return settings;
  }

  private static String name(final int index) {
    return "rdfscale_" + index;
  }

  private static String csv(final String value) {
    return "\"" + value.replace("\"", "\"\"") + "\"";
  }
}
