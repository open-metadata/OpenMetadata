package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTableProfile;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.TableColumnList;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

@Isolated("Counts SQL executed by HTTP requests without including background jobs")
@ExtendWith(TestNamespaceExtension.class)
class TableColumnReadIT {
  @ParameterizedTest
  @CsvSource({"false,", "true,", "false,''", "true,''", "false,customMetrics", "true,tags"})
  void unrequestedProfilesDoNotResolveOwners(boolean byName, String fields, TestNamespace ns) {
    final Table table = createTable(ns);
    final OpenMetadataClient client = SdkClients.adminClient();
    client.tables().get(table.getId().toString(), "columns");

    try (var queries = SqlQueryCounter.forRequests(Entity.getJdbi(), "from entity_relationship")) {
      final TableColumnList page = readColumns(client, table, byName, fields);
      assertEquals(100, page.getPaging().getTotal());
      assertEquals(
          List.of("c0000", "c0001", "c0002"),
          page.getData().stream().map(Column::getName).toList());
      assertEquals(
          "3",
          new String(
              Base64.getDecoder().decode(page.getPaging().getAfter()), StandardCharsets.UTF_8));
      assertNull(page.getData().getFirst().getProfile());
      assertEquals(0, queries.count(), "Column metadata does not consume owner relationships");
    }
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void requestedProfilesPreserveOwnerAccessAndMaskOtherReaders(boolean byName, TestNamespace ns) {
    final Table table = createTable(ns);
    final var owner = UserTestFactory.createUser(ns, "column_profile_owner");
    table.setOwners(List.of(owner.getEntityReference()));
    table
        .getColumns()
        .getFirst()
        .setTags(
            List.of(
                new TagLabel()
                    .withTagFQN("PII.Sensitive")
                    .withSource(TagLabel.TagSource.CLASSIFICATION)));
    SdkClients.adminClient().tables().update(table.getId().toString(), table);
    final long timestamp = System.currentTimeMillis();
    SdkClients.adminClient()
        .tables()
        .updateTableProfile(
            table.getId(),
            new CreateTableProfile()
                .withTableProfile(new TableProfile().withTimestamp(timestamp).withRowCount(10.0))
                .withColumnProfile(
                    List.of(
                        new ColumnProfile()
                            .withName("c0000")
                            .withTimestamp(timestamp)
                            .withMin(1.0)
                            .withMax(10.0))));

    try (var queries = SqlQueryCounter.forRequests(Entity.getJdbi(), "from entity_relationship")) {
      final var adminPage = readColumns(SdkClients.adminClient(), table, byName, "profile");
      assertNotNull(adminPage.getData().getFirst().getProfile());
      assertTrue(queries.count() > 0, "The HTTP SQL counter must observe real owner reads");
    }
    final var ownerClient =
        SdkClients.createClient(owner.getName(), owner.getEmail(), new String[] {});
    final var ownerPage = readColumns(ownerClient, table, byName, "profile");
    assertEquals(1.0, ownerPage.getData().getFirst().getProfile().getMin());
    final var reader = UserTestFactory.createUser(ns, "column_profile_reader");
    final var readerClient =
        SdkClients.createClient(reader.getName(), reader.getEmail(), new String[] {});
    final var readerPage = readColumns(readerClient, table, byName, "profile");
    assertNull(readerPage.getData().getFirst().getProfile());
    assertEquals(3, readerPage.getData().size());
  }

  private TableColumnList readColumns(
      OpenMetadataClient client, Table table, boolean byName, String fields) {
    final String lookup =
        byName
            ? "name/" + URLEncoder.encode(table.getFullyQualifiedName(), StandardCharsets.UTF_8)
            : table.getId().toString();
    final var options = RequestOptions.builder().queryParam("limit", "3");
    if (fields != null) {
      options.queryParam("fields", fields);
    }
    return client
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/tables/" + lookup + "/columns",
            null,
            TableColumnList.class,
            options.build());
  }

  private Table createTable(TestNamespace ns) {
    final OpenMetadataClient client = SdkClients.adminClient();
    final var schema = DatabaseSchemaTestFactory.createSimple(ns);
    final List<Column> columns =
        IntStream.range(0, 100)
            .mapToObj(
                index ->
                    new Column()
                        .withName("c%04d".formatted(index))
                        .withDataType(ColumnDataType.BIGINT))
            .toList();
    return client
        .tables()
        .create(
            new CreateTable()
                .withName(ns.prefix("column_reads"))
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(columns));
  }
}
