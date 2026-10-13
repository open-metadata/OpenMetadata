package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.util.UriTestUtils.assertHttpStatus;
import static org.openmetadata.it.util.UriTestUtils.assertHttpStatusFor;
import static org.openmetadata.it.util.UriTestUtils.encodeURIComponent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.util.DenyPolicyPrincipals;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.SchemaType;
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

  /** Entity type to the collection segment its paginated child endpoint lives under. */
  static Stream<Arguments> newChildEndpoints() {
    return Stream.of(
        Arguments.of("topic", "topics"),
        Arguments.of("pipeline", "pipelines"),
        Arguments.of("mlmodel", "mlmodels"),
        Arguments.of("container", "containers"),
        Arguments.of("searchIndex", "searchIndexes"),
        Arguments.of("apiEndpoint", "apiEndpoints"));
  }

  @ParameterizedTest
  @MethodSource("newChildEndpoints")
  void everyNewChildEndpoint_servesItsParentsChildren(
      String entityType, String collection, TestNamespace ns) throws Exception {
    // One case per endpoint. A route registered under the wrong collection segment, or a type
    // whose required fields do not actually load its children, shows up here and nowhere else.
    ColumnChildTypesIT.ChildFixture fixture = ColumnChildTypesIT.createFixture(entityType, ns);
    JsonNode root = readChildPage(collection, fixture.parentFqn(), "");

    assertEquals(1, root.get("paging").get("total").asInt(), entityType);
    String childName = fixture.childFqn().substring(fixture.childFqn().lastIndexOf('.') + 1);
    assertEquals(childName, root.get("data").get(0).get("name").asText(), entityType);
  }

  @Test
  void pipelineTasks_paginatedAndTypedAsTask(TestNamespace ns) throws Exception {
    ColumnChildTypesIT.ChildFixture fixture = ColumnChildTypesIT.createFixture("pipeline", ns);
    JsonNode root = readChildPage("pipelines", fixture.parentFqn(), "");

    assertEquals(1, root.get("paging").get("total").asInt());
    JsonNode task = root.get("data").get(0);
    assertEquals("extract", task.get("name").asText());
    // A task serializes as itself. If the endpoint had reshaped it into a Column, dataType would
    // be present and every consumer would read a task as a column.
    assertFalse(task.has("dataType"), "Task must not be shaped as a Column");
  }

  @Test
  void mlModelFeatures_typedAsMlFeature(TestNamespace ns) throws Exception {
    ColumnChildTypesIT.ChildFixture fixture = ColumnChildTypesIT.createFixture("mlmodel", ns);
    JsonNode root = readChildPage("mlmodels", fixture.parentFqn(), "");

    assertEquals(1, root.get("paging").get("total").asInt());
    JsonNode feature = root.get("data").get(0);
    assertEquals("age", feature.get("name").asText());
    assertFalse(feature.has("constraint"), "MlFeature must not be shaped as a Column");
    assertFalse(feature.has("ordinalPosition"), "MlFeature must not be shaped as a Column");
  }

  @Test
  void apiEndpointFields_coverBothSchemas(TestNamespace ns) throws Exception {
    // apiEndpoint is the one type with two child containers. The page must concatenate them
    // rather than serve only the first.
    ColumnChildTypesIT.ChildFixture fixture = ColumnChildTypesIT.createFixture("apiEndpoint", ns);
    JsonNode root = readChildPage("apiEndpoints", fixture.parentFqn(), "");
    assertEquals(1, root.get("paging").get("total").asInt());
    assertEquals("userId", root.get("data").get(0).get("name").asText());
  }

  @Test
  void newTypeEndpoint_honoursSortByAndSortOrder(TestNamespace ns) throws Exception {
    // JAX-RS silently discards a query parameter no method declares, so an endpoint that forgot
    // sortBy would return stored order and report success. This is what catches that.
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);
    OpenMetadataClient client = SdkClients.adminClient();
    Topic topic =
        client
            .topics()
            .create(
                new CreateTopic()
                    .withName(ns.prefix("sortable"))
                    .withService(service.getFullyQualifiedName())
                    .withPartitions(1)
                    .withMessageSchema(
                        new MessageSchema()
                            .withSchemaType(SchemaType.JSON)
                            .withSchemaFields(
                                List.of(
                                    new Field()
                                        .withName("z_field")
                                        .withDataType(FieldDataType.STRING),
                                    new Field()
                                        .withName("a_field")
                                        .withDataType(FieldDataType.STRING)))));

    JsonNode ascending = readChildPage("topics", topic.getFullyQualifiedName(), "&sortBy=name");
    assertEquals("a_field", ascending.get("data").get(0).get("name").asText());
    assertEquals("z_field", ascending.get("data").get(1).get("name").asText());

    JsonNode descending =
        readChildPage("topics", topic.getFullyQualifiedName(), "&sortBy=name&sortOrder=desc");
    assertEquals("z_field", descending.get("data").get(0).get("name").asText());
    assertEquals("a_field", descending.get("data").get(1).get("name").asText());
  }

  @Test
  void topicFields_hydrateTagsWhenRequested(TestNamespace ns) throws Exception {
    ColumnChildTypesIT.ChildFixture fixture = ColumnChildTypesIT.createFixture("topic", ns);
    OpenMetadataClient client = SdkClients.adminClient();

    Classification classification =
        client
            .classifications()
            .create(
                new CreateClassification()
                    .withName(ns.prefix("pagination_tags"))
                    .withDescription("Classification for the child-field pagination suite"));
    Tag tag =
        client
            .tags()
            .create(
                new CreateTag()
                    .withName("sensitive")
                    .withClassification(classification.getFullyQualifiedName())
                    .withDescription("Tag for the child-field pagination suite"));

    String tagsBody =
        OBJECT_MAPPER.writeValueAsString(
            Map.of(
                "tags",
                List.of(
                    Map.of("tagFQN", tag.getFullyQualifiedName(), "source", "Classification"))));
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/columns/name/" + encodeURIComponent(fixture.childFqn()) + "?entityType=topic",
            tagsBody);

    JsonNode withTags = readChildPage("topics", fixture.parentFqn(), "&fields=tags");
    JsonNode field = withTags.get("data").get(0);
    assertTrue(
        field.has("tags") && !field.get("tags").isEmpty(),
        "tags must be hydrated when the fields parameter asks for them");
    assertEquals(tag.getFullyQualifiedName(), field.get("tags").get(0).get("tagFQN").asText());
  }

  @Test
  void newTypeEndpoint_unknownParentGives404(TestNamespace ns) throws Exception {
    // The resource context leaves the entity null for an unknown FQN, so without an explicit
    // guard this path would surface as a server error rather than a not-found.
    assertHttpStatus(
        404,
        HttpMethod.GET,
        "/v1/topics/name/" + encodeURIComponent(ns.prefix("no_such_topic")) + "/columns",
        null);
  }

  @Test
  void newTypeEndpoint_viewDeniedUserGets403(TestNamespace ns) throws Exception {
    ColumnChildTypesIT.ChildFixture fixture = ColumnChildTypesIT.createFixture("pipeline", ns);
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDenied(
            ns.shortPrefix("view_denied"), "pipeline", MetadataOperation.VIEW_BASIC);

    assertHttpStatusFor(
        denied,
        403,
        HttpMethod.GET,
        "/v1/pipelines/name/" + encodeURIComponent(fixture.parentFqn()) + "/columns",
        null);
  }

  private JsonNode readChildPage(String collection, String parentFqn, String extraQuery)
      throws Exception {
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/"
                    + collection
                    + "/name/"
                    + encodeURIComponent(parentFqn)
                    + "/columns?limit=10&offset=0"
                    + extraQuery,
                null);
    return OBJECT_MAPPER.readTree(response);
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
