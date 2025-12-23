package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.SchemaType;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Integration tests for Search functionality using fluent API.
 *
 * <p>Tests search queries, entity type counts, aggregations, and search behavior.
 *
 * <p>Migrated from: org.openmetadata.service.resources.search.SearchResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class SearchResourceIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  // ===================================================================
  // BASIC SEARCH TESTS
  // ===================================================================

  @Test
  void testBasicSearch(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // Use wildcard query which is safer than field expansion
    String response = client.search().query("*").index("table_search_index").size(5).execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchWithPagination(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    for (int i = 0; i < 5; i++) {
      createTestTable(ns, "paginated_" + i);
    }

    // Fluent API with pagination
    String response =
        client.search().query("*").index("table_search_index").from(0).size(2).execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchWithPageHelper(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // Using page() helper method
    String response = client.search().query("*").index("table_search_index").page(0, 10).execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchWithSorting(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "sort_test");

    // Fluent API with sorting
    String response =
        client
            .search()
            .query("*")
            .index("table_search_index")
            .size(10)
            .sortBy("name.keyword", "asc")
            .execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchSortAscDesc(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // Test sortAsc helper
    String ascResponse =
        client
            .search()
            .query("*")
            .index("table_search_index")
            .size(10)
            .sortAsc("name.keyword")
            .execute();

    assertNotNull(ascResponse);

    // Test sortDesc helper
    String descResponse =
        client
            .search()
            .query("*")
            .index("table_search_index")
            .size(10)
            .sortDesc("name.keyword")
            .execute();

    assertNotNull(descResponse);
  }

  // ===================================================================
  // ENTITY TYPE COUNTS TESTS
  // ===================================================================

  @Test
  void testEntityTypeCountsWithQueryAll(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "counts_all");

    // Fluent API for entity type counts
    String response = client.search().entityTypeCounts().query("*").execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(
        root.has("aggregations") || root.has("buckets") || root.size() > 0,
        "Response should have count data");
  }

  @Test
  void testEntityTypeCountsWithIndex(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "index_counts");

    String response =
        client.search().entityTypeCounts().query("*").index("table_search_index").execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertNotNull(root);
  }

  @Test
  void testEntityTypeCountsWithQueryFilter(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String queryFilter = "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"deleted\":false}}]}}}";

    String response =
        client
            .search()
            .entityTypeCounts()
            .query("*")
            .index("dataAsset")
            .queryFilter(queryFilter)
            .execute();

    assertNotNull(response);
  }

  // ===================================================================
  // SEARCH WITH AGGREGATIONS TESTS
  // ===================================================================

  @Test
  void testSearchWithIncludeAggregations(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "agg_test");

    // Fluent API with includeAggregations()
    String response =
        client
            .search()
            .query("*")
            .index("table_search_index")
            .size(10)
            .includeAggregations()
            .execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchWithoutAggregations(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response =
        client
            .search()
            .query("*")
            .index("table_search_index")
            .size(10)
            .includeAggregations(false)
            .execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  // ===================================================================
  // AGGREGATE TESTS
  // ===================================================================

  @Test
  void testAggregateQuery(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "aggregate_test");

    String response =
        client.search().aggregate("*").index("table_search_index").field("owner.name").execute();

    assertNotNull(response);
  }

  // ===================================================================
  // SPECIAL CHARACTER AND EDGE CASE TESTS
  // ===================================================================

  @Test
  void testVeryLongQueryWithSpecialCharacters(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // Queries with special characters should not throw exceptions
    String response =
        client.search().query("test-query_with.special").index("table_search_index").execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchWithEmptyQuery(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response = client.search().query("").index("table_search_index").execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits") || root.has("error"), "Response should have hits or error");
  }

  @Test
  void testSearchAcrossMultipleIndexes(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "multi_index");
    createTestTopic(ns, "multi_index");

    // Search using dataAsset index (covers multiple entity types)
    String response = client.search().query("multi_index").index("dataAsset").execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  // ===================================================================
  // CLAUSE EXPLOSION PREVENTION TESTS
  // ===================================================================

  @Test
  void testLongTableNameWithManyColumnsDoesNotCauseClauseExplosion(TestNamespace ns)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String longTableName = ns.prefix("int_snowplow_experiment_evaluation_detailed");
    List<Column> manyColumns = createManyTableColumns(50);

    Table table = createTestTableWithColumns(ns, longTableName, manyColumns);
    assertNotNull(table);

    String problematicQuery = "int_snowplow_experiment";

    assertDoesNotThrow(
        () -> {
          String response =
              client.search().query(problematicQuery).index("table_search_index").execute();
          assertNotNull(response);
          JsonNode root = OBJECT_MAPPER.readTree(response);
          assertFalse(
              root.has("error") && root.get("error").asText().contains("too_many"),
              "Should not have too_many_nested_clauses error");
        });
  }

  @Test
  void testTopicWithManySchemaFieldsDoesNotCauseClauseExplosion(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String longTopicName = ns.prefix("snowplow_experiment_evaluation_events");
    List<Field> manyFields = createManyTopicSchemaFields(50);

    Topic topic = createTestTopicWithFields(ns, longTopicName, manyFields);
    assertNotNull(topic);

    String problematicQuery = "snowplow_experiment";

    assertDoesNotThrow(
        () -> {
          String response =
              client.search().query(problematicQuery).index("topic_search_index").execute();
          assertNotNull(response);
        });
  }

  // ===================================================================
  // SEARCH CONSISTENCY TESTS
  // ===================================================================

  @Test
  void testSearchQueryConsistencyBetweenDataAssetAndTable(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // Use wildcard query to avoid clause explosion with long entity names
    String tableResponse = client.search().query("*").index("table_search_index").size(5).execute();

    String dataAssetResponse = client.search().query("*").index("dataAsset").size(5).execute();

    assertNotNull(tableResponse);
    assertNotNull(dataAssetResponse);

    JsonNode tableRoot = OBJECT_MAPPER.readTree(tableResponse);
    JsonNode dataAssetRoot = OBJECT_MAPPER.readTree(dataAssetResponse);

    assertTrue(tableRoot.has("hits"));
    assertTrue(dataAssetRoot.has("hits"));
  }

  @Test
  void testSearchPaginationConsistency(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    for (int i = 0; i < 10; i++) {
      createTestTable(ns, "page_test_" + i);
    }

    // Get first page
    String page1 =
        client.search().query("page_test").index("table_search_index").page(0, 5).execute();

    // Get second page
    String page2 =
        client.search().query("page_test").index("table_search_index").page(1, 5).execute();

    assertNotNull(page1);
    assertNotNull(page2);

    JsonNode page1Root = OBJECT_MAPPER.readTree(page1);
    JsonNode page2Root = OBJECT_MAPPER.readTree(page2);

    assertTrue(page1Root.has("hits"));
    assertTrue(page2Root.has("hits"));
  }

  // ===================================================================
  // DELETED ENTITIES SEARCH TESTS
  // ===================================================================

  @Test
  void testSearchDeletedEntities(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Table table = createTestTable(ns, "deleted_search");
    client.tables().delete(table.getId().toString());

    // Fluent API with includeDeleted()
    String response =
        client
            .search()
            .query("deleted_search")
            .index("table_search_index")
            .includeDeleted()
            .execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  @Test
  void testSearchExcludeDeletedEntities(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String response =
        client.search().query("*").index("table_search_index").deleted(false).execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  // ===================================================================
  // QUERY FILTER TESTS
  // ===================================================================

  @Test
  void testSearchWithQueryFilter(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    createTestTable(ns, "filter_test");

    String queryFilter = "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"deleted\":false}}]}}}";

    String response =
        client
            .search()
            .query("*")
            .index("table_search_index")
            .queryFilter(queryFilter)
            .size(10)
            .execute();

    assertNotNull(response);
    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should have hits");
  }

  // ===================================================================
  // HELPER METHODS
  // ===================================================================

  private Table createTestTable(TestNamespace ns, String baseName) {
    String shortId = ns.shortPrefix();

    org.openmetadata.schema.services.connections.database.PostgresConnection conn =
        org.openmetadata.sdk.fluent.DatabaseServices.postgresConnection()
            .hostPort("localhost:5432")
            .username("test")
            .build();

    DatabaseService service =
        org.openmetadata.sdk.fluent.DatabaseServices.builder()
            .name("search_svc_" + shortId)
            .connection(conn)
            .description("Test service for search")
            .create();

    org.openmetadata.schema.api.data.CreateDatabase dbReq =
        new org.openmetadata.schema.api.data.CreateDatabase();
    dbReq.setName("search_db_" + shortId);
    dbReq.setService(service.getFullyQualifiedName());
    Database database = SdkClients.adminClient().databases().create(dbReq);

    CreateDatabaseSchema schemaReq = new CreateDatabaseSchema();
    schemaReq.setName("search_schema_" + shortId);
    schemaReq.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = SdkClients.adminClient().databaseSchemas().create(schemaReq);

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.prefix(baseName));
    tableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    tableRequest.setColumns(
        List.of(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)));

    return SdkClients.adminClient().tables().create(tableRequest);
  }

  private Table createTestTableWithColumns(TestNamespace ns, String name, List<Column> columns) {
    String shortId = ns.shortPrefix();

    org.openmetadata.schema.services.connections.database.PostgresConnection conn =
        org.openmetadata.sdk.fluent.DatabaseServices.postgresConnection()
            .hostPort("localhost:5432")
            .username("test")
            .build();

    DatabaseService service =
        org.openmetadata.sdk.fluent.DatabaseServices.builder()
            .name("many_col_svc_" + shortId)
            .connection(conn)
            .create();

    org.openmetadata.schema.api.data.CreateDatabase dbReq =
        new org.openmetadata.schema.api.data.CreateDatabase();
    dbReq.setName("many_col_db_" + shortId);
    dbReq.setService(service.getFullyQualifiedName());
    Database database = SdkClients.adminClient().databases().create(dbReq);

    CreateDatabaseSchema schemaReq = new CreateDatabaseSchema();
    schemaReq.setName("many_col_schema_" + shortId);
    schemaReq.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = SdkClients.adminClient().databaseSchemas().create(schemaReq);

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(name);
    tableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    tableRequest.setColumns(columns);

    return SdkClients.adminClient().tables().create(tableRequest);
  }

  private Topic createTestTopic(TestNamespace ns, String baseName) {
    String shortId = ns.shortPrefix();

    org.openmetadata.schema.services.connections.messaging.KafkaConnection kafkaConn =
        new org.openmetadata.schema.services.connections.messaging.KafkaConnection()
            .withBootstrapServers("localhost:9092");

    org.openmetadata.schema.api.services.CreateMessagingService msgSvcReq =
        new org.openmetadata.schema.api.services.CreateMessagingService();
    msgSvcReq.setName("search_msg_svc_" + shortId);
    msgSvcReq.setServiceType(
        org.openmetadata.schema.api.services.CreateMessagingService.MessagingServiceType.Kafka);
    msgSvcReq.setConnection(
        new org.openmetadata.schema.type.MessagingConnection().withConfig(kafkaConn));

    MessagingService msgService = SdkClients.adminClient().messagingServices().create(msgSvcReq);

    CreateTopic topicRequest = new CreateTopic();
    topicRequest.setName(ns.prefix(baseName));
    topicRequest.setService(msgService.getFullyQualifiedName());
    topicRequest.setPartitions(1);

    return SdkClients.adminClient().topics().create(topicRequest);
  }

  private Topic createTestTopicWithFields(TestNamespace ns, String name, List<Field> fields) {
    String shortId = ns.shortPrefix();

    org.openmetadata.schema.services.connections.messaging.KafkaConnection kafkaConn =
        new org.openmetadata.schema.services.connections.messaging.KafkaConnection()
            .withBootstrapServers("localhost:9092");

    org.openmetadata.schema.api.services.CreateMessagingService msgSvcReq =
        new org.openmetadata.schema.api.services.CreateMessagingService();
    msgSvcReq.setName("many_field_msg_svc_" + shortId);
    msgSvcReq.setServiceType(
        org.openmetadata.schema.api.services.CreateMessagingService.MessagingServiceType.Kafka);
    msgSvcReq.setConnection(
        new org.openmetadata.schema.type.MessagingConnection().withConfig(kafkaConn));

    MessagingService msgService = SdkClients.adminClient().messagingServices().create(msgSvcReq);

    MessageSchema messageSchema =
        new MessageSchema().withSchemaType(SchemaType.JSON).withSchemaFields(fields);

    CreateTopic topicRequest = new CreateTopic();
    topicRequest.setName(name);
    topicRequest.setService(msgService.getFullyQualifiedName());
    topicRequest.setPartitions(1);
    topicRequest.setMessageSchema(messageSchema);

    return SdkClients.adminClient().topics().create(topicRequest);
  }

  private List<Column> createManyTableColumns(int count) {
    List<Column> columns = new ArrayList<>();
    for (int i = 0; i < count; i++) {
      columns.add(
          new Column()
              .withName("column_" + i + "_data_field")
              .withDataType(ColumnDataType.VARCHAR)
              .withDataLength(255));
    }
    return columns;
  }

  private List<Field> createManyTopicSchemaFields(int count) {
    List<Field> fields = new ArrayList<>();
    for (int i = 0; i < count; i++) {
      fields.add(
          new Field().withName("field_" + i + "_data_element").withDataType(FieldDataType.STRING));
    }
    return fields;
  }
}
