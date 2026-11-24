package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.util.UriTestUtils.assertHttpStatus;
import static org.openmetadata.it.util.UriTestUtils.encodeURIComponent;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.factories.StorageServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.api.data.CreateSpreadsheet;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.api.data.CreateWorksheet;
import org.openmetadata.schema.api.services.CreateDriveService;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Spreadsheet;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.data.Worksheet;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.SchemaType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * The cases where resolving a child from its fully qualified name is not a simple split: containers
 * nested to arbitrary depth, names that contain the separator, children of a struct, parents that
 * have been deleted, and collections that are empty.
 *
 * <p>These are the shapes a per-type implementation gets right by accident and a shared one has to
 * get right on purpose, so each is its own test rather than a branch inside a larger one.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ChildFieldEdgeMatrixIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  /** The SDK has no delete-by-name, so a soft delete resolves the id first. */
  private static final Map<String, String> SOFT_DELETE =
      Map.of("recursive", "true", "hardDelete", "false");

  @ParameterizedTest
  @ValueSource(ints = {1, 2, 3, 4})
  void containerColumnWrite_resolvesParentAtAnyNestingDepth(int depth, TestNamespace ns)
      throws Exception {
    // A container FQN has no fixed number of segments, so the parent cannot be found by counting.
    // It is found by walking prefixes, and this is the test that the walk reaches any depth.
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);
    Container parent = null;
    Container leaf = null;
    for (int level = 0; level < depth; level++) {
      boolean isLeaf = level == depth - 1;
      CreateContainer create =
          new CreateContainer()
              .withName(ns.prefix("c" + level))
              .withService(service.getFullyQualifiedName());
      if (parent != null) {
        create.setParent(containerReference(parent));
      }
      // Only the leaf carries a data model; the ancestors exist purely to lengthen the FQN.
      if (isLeaf) {
        create.setDataModel(
            new ContainerDataModel()
                .withColumns(
                    List.of(new Column().withName("payload").withDataType(ColumnDataType.STRING))));
      }
      Container created = client.containers().create(create);
      parent = created;
      leaf = isLeaf ? created : leaf;
    }

    String childFqn = leaf.getFullyQualifiedName() + ".payload";
    String body = OBJECT_MAPPER.writeValueAsString(Map.of("description", "depth " + depth));
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/columns/name/" + encodeURIComponent(childFqn) + "?entityType=container",
                body);
    assertTrue(response.contains("depth " + depth), response);
  }

  @Test
  void containerColumnWrite_ambiguousPrefix_resolvesToLongestMatch(TestNamespace ns)
      throws Exception {
    // Both the parent and the child container exist, so a prefix walk that stopped at the first
    // match would write to the ancestor. The write must land on the nested container only.
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    Container outer =
        client
            .containers()
            .create(
                new CreateContainer()
                    .withName(ns.prefix("c0"))
                    .withService(service.getFullyQualifiedName())
                    .withDataModel(
                        new ContainerDataModel()
                            .withColumns(
                                List.of(
                                    new Column()
                                        .withName("shared")
                                        .withDataType(ColumnDataType.STRING)))));
    Container inner =
        client
            .containers()
            .create(
                new CreateContainer()
                    .withName(ns.prefix("c1"))
                    .withService(service.getFullyQualifiedName())
                    .withParent(containerReference(outer))
                    .withDataModel(
                        new ContainerDataModel()
                            .withColumns(
                                List.of(
                                    new Column()
                                        .withName("payload")
                                        .withDataType(ColumnDataType.STRING)))));

    String childFqn = inner.getFullyQualifiedName() + ".payload";
    String body = OBJECT_MAPPER.writeValueAsString(Map.of("description", "belongs to c1"));
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/columns/name/" + encodeURIComponent(childFqn) + "?entityType=container",
            body);

    Container innerVerified =
        client.containers().getByName(inner.getFullyQualifiedName(), "dataModel");
    assertEquals(
        "belongs to c1", innerVerified.getDataModel().getColumns().get(0).getDescription());
    Container outerVerified =
        client.containers().getByName(outer.getFullyQualifiedName(), "dataModel");
    assertNull(
        outerVerified.getDataModel().getColumns().get(0).getDescription(),
        "the ancestor container must be untouched");
  }

  @Test
  void tableColumn_dottedNameQuotedFqn_readAndWrite(TestNamespace ns) throws Exception {
    // A dot inside a column name is quoted in the FQN. Splitting the FQN naively would find a
    // parent that does not exist, or worse, the wrong one.
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table =
        client
            .tables()
            .create(
                new CreateTable()
                    .withName(ns.prefix("dotted_col_table"))
                    .withDatabaseSchema(schema.getFullyQualifiedName())
                    .withColumns(
                        List.of(
                            new Column()
                                .withName("col.with.dot")
                                .withDataType(ColumnDataType.STRING))));
    Table fetched = client.tables().getByName(table.getFullyQualifiedName(), "columns");
    String childFqn = fetched.getColumns().get(0).getFullyQualifiedName();

    String getResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/columns/name/" + encodeURIComponent(childFqn) + "?entityType=table",
                null);
    assertTrue(getResponse.contains("col.with.dot"), getResponse);

    String body = OBJECT_MAPPER.writeValueAsString(Map.of("description", "dotted column write"));
    JsonNode written =
        OBJECT_MAPPER.readTree(
            client
                .getHttpClient()
                .executeForString(
                    HttpMethod.PUT,
                    "/v1/columns/name/" + encodeURIComponent(childFqn) + "?entityType=table",
                    body));
    assertEquals("dotted column write", written.get("description").asText());
    assertTrue(
        written.get("fullyQualifiedName").asText().startsWith(table.getFullyQualifiedName() + "."),
        "parent resolution must not have split on the quoted dots inside the column name");
  }

  @Test
  void topicField_dottedName_resolvesViaQuotedFqn(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);
    Topic topic =
        client
            .topics()
            .create(
                new CreateTopic()
                    .withName(ns.prefix("dotted_field_topic"))
                    .withService(service.getFullyQualifiedName())
                    .withPartitions(1)
                    .withMessageSchema(
                        new MessageSchema()
                            .withSchemaType(SchemaType.JSON)
                            .withSchemaFields(
                                List.of(
                                    new Field()
                                        .withName("customer.id")
                                        .withDataType(FieldDataType.STRING)))));
    Topic fetched = client.topics().getByName(topic.getFullyQualifiedName(), "messageSchema");
    String childFqn = fetched.getMessageSchema().getSchemaFields().get(0).getFullyQualifiedName();

    String getResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/columns/name/" + encodeURIComponent(childFqn) + "?entityType=topic",
                null);
    assertTrue(getResponse.contains("customer.id"), getResponse);

    String body = OBJECT_MAPPER.writeValueAsString(Map.of("description", "dotted field write"));
    JsonNode written =
        OBJECT_MAPPER.readTree(
            client
                .getHttpClient()
                .executeForString(
                    HttpMethod.PUT,
                    "/v1/columns/name/" + encodeURIComponent(childFqn) + "?entityType=topic",
                    body));
    assertEquals("dotted field write", written.get("description").asText());
    assertTrue(
        written.get("fullyQualifiedName").asText().startsWith(topic.getFullyQualifiedName() + "."),
        "parent resolution must not have split on the quoted dot inside the field name");
  }

  @Test
  void tableStructChild_writeToNestedColumn(TestNamespace ns) throws Exception {
    // A struct's children are not in the top-level column list, so locating one needs recursion.
    OpenMetadataClient client = SdkClients.adminClient();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table =
        client
            .tables()
            .create(
                new CreateTable()
                    .withName(ns.prefix("struct_table"))
                    .withDatabaseSchema(schema.getFullyQualifiedName())
                    .withColumns(
                        List.of(
                            new Column()
                                .withName("profile")
                                .withDataType(ColumnDataType.STRUCT)
                                .withChildren(
                                    List.of(
                                        new Column()
                                            .withName("full_name")
                                            .withDataType(ColumnDataType.STRING))))));
    Table fetched = client.tables().getByName(table.getFullyQualifiedName(), "columns");
    String childFqn = fetched.getColumns().get(0).getChildren().get(0).getFullyQualifiedName();

    String body = OBJECT_MAPPER.writeValueAsString(Map.of("description", "nested struct field"));
    String putResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/columns/name/" + encodeURIComponent(childFqn) + "?entityType=table",
                body);
    assertTrue(putResponse.contains("nested struct field"), putResponse);

    // Read back from the entity, not the write response: the response could carry a value that
    // was applied to a detached copy and never stored.
    Table verified = client.tables().getByName(table.getFullyQualifiedName(), "columns");
    assertEquals(
        "nested struct field", verified.getColumns().get(0).getChildren().get(0).getDescription());
  }

  @Test
  void topicStructChild_writeToNestedField(TestNamespace ns) throws Exception {
    // The same recursion on a type whose children are Fields rather than Columns.
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);
    Topic topic =
        client
            .topics()
            .create(
                new CreateTopic()
                    .withName(ns.prefix("nested_topic"))
                    .withService(service.getFullyQualifiedName())
                    .withPartitions(1)
                    .withMessageSchema(
                        new MessageSchema()
                            .withSchemaType(SchemaType.JSON)
                            .withSchemaFields(
                                List.of(
                                    new Field()
                                        .withName("customer")
                                        .withDataType(FieldDataType.RECORD)
                                        .withChildren(
                                            List.of(
                                                new Field()
                                                    .withName("id")
                                                    .withDataType(FieldDataType.STRING)))))));
    Topic fetched = client.topics().getByName(topic.getFullyQualifiedName(), "messageSchema");
    String childFqn =
        fetched
            .getMessageSchema()
            .getSchemaFields()
            .get(0)
            .getChildren()
            .get(0)
            .getFullyQualifiedName();

    String body = OBJECT_MAPPER.writeValueAsString(Map.of("description", "nested topic field"));
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/columns/name/" + encodeURIComponent(childFqn) + "?entityType=topic",
            body);

    Topic verified = client.topics().getByName(topic.getFullyQualifiedName(), "messageSchema");
    assertEquals(
        "nested topic field",
        verified.getMessageSchema().getSchemaFields().get(0).getChildren().get(0).getDescription());
  }

  @Test
  void missingChild_returns404(TestNamespace ns) throws Exception {
    ColumnChildTypesIT.ChildFixture fixture = ColumnChildTypesIT.createFixture("topic", ns);
    assertHttpStatus(
        404,
        HttpMethod.GET,
        "/v1/columns/name/"
            + encodeURIComponent(fixture.parentFqn() + ".ghost")
            + "?entityType=topic",
        null);
  }

  @Test
  void deletedParent_writeReturns404(TestNamespace ns) throws Exception {
    ColumnChildTypesIT.ChildFixture fixture = ColumnChildTypesIT.createFixture("pipeline", ns);
    OpenMetadataClient client = SdkClients.adminClient();
    Pipeline parent = client.pipelines().getByName(fixture.parentFqn());
    client.pipelines().delete(parent.getId().toString(), SOFT_DELETE);

    String body = OBJECT_MAPPER.writeValueAsString(Map.of("description", "x"));
    assertHttpStatus(
        404,
        HttpMethod.PUT,
        "/v1/columns/name/" + encodeURIComponent(fixture.childFqn()) + "?entityType=pipeline",
        body);
  }

  @Test
  void deletedParent_readWithIncludeAll_succeeds(TestNamespace ns) throws Exception {
    // A soft-deleted parent is still readable with include=all, and its children must come with
    // it. This is the counterpart to the write case above: deletion blocks writes, not reads.
    ColumnChildTypesIT.ChildFixture fixture = ColumnChildTypesIT.createFixture("topic", ns);
    OpenMetadataClient client = SdkClients.adminClient();
    Topic parent = client.topics().getByName(fixture.parentFqn());
    client.topics().delete(parent.getId().toString(), SOFT_DELETE);

    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/columns/name/"
                    + encodeURIComponent(fixture.childFqn())
                    + "?entityType=topic&include=all",
                null);
    assertTrue(response.contains("customer_id"), response);
  }

  @Test
  void emptyChildArray_paginatedReadReturnsFrozenEmptyShape(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);
    Topic topic =
        client
            .topics()
            .create(
                new CreateTopic()
                    .withName(ns.prefix("no_schema_topic"))
                    .withService(service.getFullyQualifiedName())
                    .withPartitions(1));

    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/topics/name/"
                    + encodeURIComponent(topic.getFullyQualifiedName())
                    + "/columns?limit=50&offset=0",
                null);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertEquals(0, root.get("data").size());
    assertEquals(0, root.get("paging").get("total").asInt());
    // Same empty-collection quirk the two pre-existing endpoints have always returned.
    assertEquals(cursor(0), root.get("paging").get("before").asText());
    assertEquals(cursor(50), root.get("paging").get("after").asText());
  }

  @Test
  void worksheetColumns_endToEnd(TestNamespace ns) throws Exception {
    // Worksheet is the one type whose collection segment is not its entity name, so both the
    // entity-agnostic /v1/columns calls and the per-entity path are worth exercising here.
    OpenMetadataClient client = SdkClients.adminClient();
    DriveService driveService =
        client
            .driveServices()
            .create(
                new CreateDriveService()
                    .withName(ns.prefix("google_drive"))
                    .withServiceType(CreateDriveService.DriveServiceType.GoogleDrive));
    Spreadsheet spreadsheet =
        client
            .spreadsheets()
            .create(
                new CreateSpreadsheet()
                    .withName(ns.prefix("edge_matrix_sheet"))
                    .withService(driveService.getFullyQualifiedName()));
    Worksheet worksheet =
        client
            .worksheets()
            .create(
                new CreateWorksheet()
                    .withName(ns.prefix("edge_matrix_worksheet"))
                    .withSpreadsheet(spreadsheet.getFullyQualifiedName())
                    .withColumns(
                        List.of(
                            new Column().withName("row_id").withDataType(ColumnDataType.STRING))));
    Worksheet fetched = client.worksheets().getByName(worksheet.getFullyQualifiedName(), "columns");
    String childFqn = fetched.getColumns().get(0).getFullyQualifiedName();

    String body =
        OBJECT_MAPPER.writeValueAsString(Map.of("description", "Written via /v1/columns"));
    String putResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/columns/name/" + encodeURIComponent(childFqn) + "?entityType=worksheet",
                body);
    assertTrue(putResponse.contains("Written via /v1/columns"), putResponse);

    String getResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/columns/name/" + encodeURIComponent(childFqn) + "?entityType=worksheet",
                null);
    assertEquals(
        "Written via /v1/columns", OBJECT_MAPPER.readTree(getResponse).get("description").asText());

    // The paginated endpoint lives under /v1/drives/worksheets, not /v1/worksheets.
    String pageResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/drives/worksheets/name/"
                    + encodeURIComponent(worksheet.getFullyQualifiedName())
                    + "/columns?limit=10&offset=0",
                null);
    JsonNode page = OBJECT_MAPPER.readTree(pageResponse);
    assertEquals(1, page.get("paging").get("total").asInt());
    assertEquals("row_id", page.get("data").get(0).get("name").asText());
  }

  private EntityReference containerReference(Container container) {
    return new EntityReference()
        .withId(container.getId())
        .withType("container")
        .withFullyQualifiedName(container.getFullyQualifiedName());
  }

  private static String cursor(int index) {
    return java.util.Base64.getUrlEncoder()
        .encodeToString(String.valueOf(index).getBytes(java.nio.charset.StandardCharsets.UTF_8));
  }
}
