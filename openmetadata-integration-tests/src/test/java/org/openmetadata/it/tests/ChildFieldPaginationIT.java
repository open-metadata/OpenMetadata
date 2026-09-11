package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.util.UriTestUtils.encodeURIComponent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Freezes the wire shape of the two paginated child-column endpoints that already exist, so the
 * consolidation behind them is provably invisible to callers.
 *
 * <p>The two endpoints do not agree with each other today: the table one sorts by name, the
 * dashboard data-model one returns stored order. Both behaviors are the contract and both are
 * pinned here.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ChildFieldPaginationIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  /**
   * ResultList Base64-url-encodes both cursors, so a cursor whose underlying value is the index "2"
   * arrives on the wire as "Mg==". Compute it, never hardcode the encoded form.
   */
  private static String cursor(int index) {
    return Base64.getUrlEncoder()
        .encodeToString(String.valueOf(index).getBytes(StandardCharsets.UTF_8));
  }

  @Test
  void tableColumns_wireShape_frozen(TestNamespace ns) throws Exception {
    Table table = createTableWithColumns(ns, "b_col", "a_col", "c_col");
    OpenMetadataClient client = SdkClients.adminClient();
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/tables/name/"
                    + encodeURIComponent(table.getFullyQualifiedName())
                    + "/columns?limit=2&offset=0&fields=tags",
                null);
    JsonNode root = OBJECT_MAPPER.readTree(response);

    // The default is name-ascending, not stored order and not ordinalPosition.
    assertEquals(3, root.get("paging").get("total").asInt());
    assertEquals(2, root.get("data").size());
    assertEquals("a_col", root.get("data").get(0).get("name").asText());
    assertEquals("b_col", root.get("data").get(1).get("name").asText());
    assertEquals(cursor(2), root.get("paging").get("after").asText());
    assertTrue(
        root.get("paging").get("before") == null || root.get("paging").get("before").isNull(),
        "first page must not advertise a before cursor");
  }

  @Test
  void tableColumns_secondPage_carriesBeforeAndNoAfter(TestNamespace ns) throws Exception {
    // The before cursor is only produced when offset > 0, and it is offset - limit clamped at 0.
    // Nothing else pins that arithmetic.
    Table table = createTableWithColumns(ns, "b_col", "a_col", "c_col");
    OpenMetadataClient client = SdkClients.adminClient();
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/tables/name/"
                    + encodeURIComponent(table.getFullyQualifiedName())
                    + "/columns?limit=2&offset=2",
                null);
    JsonNode root = OBJECT_MAPPER.readTree(response);

    assertEquals(3, root.get("paging").get("total").asInt());
    assertEquals(1, root.get("data").size());
    assertEquals("c_col", root.get("data").get(0).get("name").asText());
    assertEquals(cursor(0), root.get("paging").get("before").asText());
    assertTrue(
        root.get("paging").get("after") == null || root.get("paging").get("after").isNull(),
        "last page must not advertise an after cursor");
  }

  @Test
  void tableColumns_sortByOrdinalPositionDescending(TestNamespace ns) throws Exception {
    // ordinalPosition is the only sortBy value that is not name, and desc is the only other order.
    Table table = createTableWithColumns(ns, "b_col", "a_col", "c_col");
    OpenMetadataClient client = SdkClients.adminClient();
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/tables/name/"
                    + encodeURIComponent(table.getFullyQualifiedName())
                    + "/columns?limit=10&offset=0&sortBy=ordinalPosition&sortOrder=desc",
                null);
    JsonNode data = OBJECT_MAPPER.readTree(response).get("data");
    assertEquals("c_col", data.get(0).get("name").asText());
    assertEquals("a_col", data.get(1).get("name").asText());
    assertEquals("b_col", data.get(2).get("name").asText());
  }

  @Test
  void dataModelColumns_wireShape_frozen_storedOrderNotSorted(TestNamespace ns) throws Exception {
    DashboardDataModel dataModel = createDataModelWithColumns(ns, "b_col", "a_col");
    OpenMetadataClient client = SdkClients.adminClient();
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/dashboard/datamodels/name/"
                    + encodeURIComponent(dataModel.getFullyQualifiedName())
                    + "/columns?limit=10&offset=0",
                null);
    JsonNode root = OBJECT_MAPPER.readTree(response);

    // This endpoint does NOT sort. Stored order is the contract, and it differs from the table
    // endpoint's default on purpose.
    assertEquals("b_col", root.get("data").get(0).get("name").asText());
    assertEquals("a_col", root.get("data").get(1).get("name").asText());
  }

  @Test
  void dataModelColumns_emptyCollection_frozenQuirk(TestNamespace ns) throws Exception {
    // The empty-collection response is a quirk, not the general shape: before is "0" and after is
    // offset + limit even though there is nothing to page to.
    DashboardDataModel dataModel = createDataModelWithColumns(ns);
    OpenMetadataClient client = SdkClients.adminClient();
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/dashboard/datamodels/name/"
                    + encodeURIComponent(dataModel.getFullyQualifiedName())
                    + "/columns?limit=50&offset=0",
                null);
    JsonNode root = OBJECT_MAPPER.readTree(response);

    assertEquals(0, root.get("data").size());
    assertEquals(0, root.get("paging").get("total").asInt());
    assertEquals(cursor(0), root.get("paging").get("before").asText());
    assertEquals(cursor(50), root.get("paging").get("after").asText());
  }

  private Table createTableWithColumns(TestNamespace ns, String... columnNames) {
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    List<Column> columns =
        java.util.stream.IntStream.range(0, columnNames.length)
            .mapToObj(
                i ->
                    new Column()
                        .withName(columnNames[i])
                        .withDataType(ColumnDataType.STRING)
                        .withOrdinalPosition(i + 1))
            .toList();
    return SdkClients.adminClient()
        .tables()
        .create(
            new CreateTable()
                .withName(ns.prefix("paged_table"))
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(columns));
  }

  private DashboardDataModel createDataModelWithColumns(TestNamespace ns, String... columnNames) {
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);
    List<Column> columns =
        java.util.Arrays.stream(columnNames)
            .map(name -> new Column().withName(name).withDataType(ColumnDataType.STRING))
            .map(column -> (Column) column)
            .toList();
    return SdkClients.adminClient()
        .dashboardDataModels()
        .create(
            new CreateDashboardDataModel()
                .withName(ns.prefix("paged_model"))
                .withService(service.getFullyQualifiedName())
                .withDataModelType(DataModelType.MetabaseDataModel)
                .withColumns(columns));
  }
}
