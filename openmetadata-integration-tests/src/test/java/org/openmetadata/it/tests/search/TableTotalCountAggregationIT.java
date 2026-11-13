package org.openmetadata.it.tests.search;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Duration;
import java.util.List;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.DatabaseTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.client.OpenMetadataClient;

@ExtendWith(TestNamespaceExtension.class)
class TableTotalCountAggregationIT {

  private static final String CARDINALITY_AGGREGATION =
      "bucketName=count:aggType=cardinality:field=fullyQualifiedName";

  @Test
  void tableTotalCountsEveryDocumentWhenFqnsDifferOnlyByCase(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    String service = DatabaseServiceTestFactory.createPostgres(ns).getFullyQualifiedName();
    String database = DatabaseTestFactory.create(ns, service).getFullyQualifiedName();
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(database, ns.prefix("case_fqn"));
    createTable(client, schema.getFullyQualifiedName(), "Orders");
    createTable(client, schema.getFullyQualifiedName(), "orders");
    String scopedQuery = DataQualityTableTotal.scopedQuery(schema.getId());

    Awaitility.await("both case-only tables indexed")
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .untilAsserted(
            () ->
                assertEquals(
                    2,
                    DataQualityTableTotal.tableTotal(
                        scopedQuery, DataQualityTableTotal.TABLE_TOTAL_AGGREGATION)));

    assertEquals(
        1,
        DataQualityTableTotal.tableTotal(scopedQuery, CARDINALITY_AGGREGATION),
        "cardinality must collapse the case-only FQNs, the undercount this regression guards");
  }

  private static void createTable(OpenMetadataClient client, String schema, String name) {
    client
        .tables()
        .create(
            new CreateTable()
                .withName(name)
                .withDatabaseSchema(schema)
                .withColumns(
                    List.of(new Column().withName("row_id").withDataType(ColumnDataType.INT))));
  }
}
