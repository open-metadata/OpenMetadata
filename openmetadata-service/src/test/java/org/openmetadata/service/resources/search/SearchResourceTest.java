/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.resources.search;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.OpenMetadataApplicationTest.APP;
import static org.openmetadata.service.OpenMetadataApplicationTest.ELASTIC_SEARCH_CLUSTER_ALIAS;
import static org.openmetadata.service.resources.EntityResourceTest.C1;
import static org.openmetadata.service.resources.EntityResourceTest.C2;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.SchemaType;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.topics.TopicResourceTest;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class SearchResourceTest extends OpenMetadataApplicationTest {

  private TableResourceTest tableResourceTest;
  private TopicResourceTest topicResourceTest;

  @BeforeAll
  void setup(TestInfo test) {
    tableResourceTest = new TableResourceTest();
    topicResourceTest = new TopicResourceTest();

    try {
      tableResourceTest.setup(test);
      topicResourceTest.setup(test);
    } catch (Exception e) {
      LOG.warn("Some entities already exist - continuing with test execution");
    }
  }

  @Test
  void testLongTableNameWithManyColumnsDoesNotCauseClauseExplosion() throws IOException {
    String longTableName = "int_snowplow_experiment_evaluation_detailed_analytics_processing";
    List<Column> manyColumns = createManyTableColumns();

    String uniqueTestName = "fuzzySearchClauseTest_" + System.currentTimeMillis();
    CreateTable createTable =
        tableResourceTest
            .createRequest(uniqueTestName)
            .withName(longTableName + "_" + System.currentTimeMillis())
            .withColumns(manyColumns);

    Table testTableWithManyColumns =
        tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
    assertNotNull(testTableWithManyColumns);

    String problematicQuery = "int_snowplow_experiment_evaluation";
    assertDoesNotThrow(
        () -> {
          Response response = searchWithQuery(problematicQuery, "table_search_index");

          assertEquals(
              200,
              response.getStatus(),
              "Search should succeed without too_many_nested_clauses error");

          String responseBody = (String) response.getEntity();
          assertNotNull(responseBody);
          assertFalse(responseBody.isEmpty());
        });
  }

  @Test
  void testTopicWithManySchemaFieldsDoesNotCauseClauseExplosion() throws IOException {
    String longTopicName = "snowplow_experiment_evaluation_events_detailed_schema";
    List<Field> manySchemaFields = createManyTopicSchemaFields();

    MessageSchema messageSchema =
        new MessageSchema().withSchemaType(SchemaType.JSON).withSchemaFields(manySchemaFields);

    String uniqueTestName = "fuzzySearchTopicClauseTest_" + System.currentTimeMillis();
    CreateTopic createTopic =
        topicResourceTest
            .createRequest(uniqueTestName)
            .withName(longTopicName + "_" + System.currentTimeMillis())
            .withMessageSchema(messageSchema);

    Topic testTopicWithManyFields = topicResourceTest.createEntity(createTopic, ADMIN_AUTH_HEADERS);
    assertNotNull(testTopicWithManyFields);

    TestUtils.simulateWork(3000);
    String problematicQuery = "snowplow_experiment_evaluation";

    assertDoesNotThrow(
        () -> {
          Response response = searchWithQuery(problematicQuery, "topic_search_index");

          assertEquals(
              200,
              response.getStatus(),
              "Topic search should succeed without too_many_nested_clauses error");

          String responseBody = (String) response.getEntity();
          assertNotNull(responseBody);
          assertFalse(responseBody.isEmpty());
        });
  }

  @Test
  void testVeryLongQueryWithSpecialCharacters() {
    TestUtils.simulateWork(2000);
    String veryLongQuery =
        "int_snowplow_experiment_evaluation_detailed_analytics_processing_with_special_characters_and_numbers_12345_test";

    assertDoesNotThrow(
        () -> {
          Response response = searchWithQuery(veryLongQuery, "table_search_index");
          assertEquals(
              200, response.getStatus(), "Very long query search should succeed without errors");
          String responseBody = (String) response.getEntity();
          assertNotNull(responseBody);
        });
  }

  @Test
  void testSearchAcrossMultipleIndexes() {
    TestUtils.simulateWork(2000);
    String query = "experiment_evaluation";
    String[] indexes = {"table_search_index", "topic_search_index", "all"};
    for (String index : indexes) {
      assertDoesNotThrow(
          () -> {
            Response response = searchWithQuery(query, index);
            assertEquals(
                200, response.getStatus(), "Search in index '" + index + "' should succeed");
          });
    }
  }

  @Test
  void testListMapping() {
    IndexMappingLoader indexMappingLoader = IndexMappingLoader.getInstance();
    Map<String, IndexMapping> indexMapping = indexMappingLoader.getIndexMapping();

    assertNotNull(indexMapping, "Index mapping should not be null");
    IndexMapping tableIndexMapping = indexMapping.get("table");
    assertNotNull(tableIndexMapping, "Table index mapping should not be null");

    Map<String, Map<String, Object>> entityIndexMapping =
        indexMappingLoader.getEntityIndexMapping();
    assertNotNull(entityIndexMapping, "Entity index mapping should not be null");
    Map<String, Object> tableMapping = entityIndexMapping.get("table");
    assertNotNull(tableMapping, "Table mapping should not be null");
  }

  private Response searchWithQuery(String query, String index) {
    WebTarget target =
        getResource("search/query")
            .queryParam("q", query)
            .queryParam("index", index)
            .queryParam("from", 0)
            .queryParam("size", 10);

    try {
      String result = TestUtils.get(target, String.class, ADMIN_AUTH_HEADERS);

      return Response.ok(result).build();
    } catch (org.apache.http.client.HttpResponseException e) {
      LOG.error("Error occurred while executing search query: {}", e.getMessage());
      return Response.status(e.getStatusCode()).entity(e.getMessage()).build();
    }
  }

  private List<Column> createManyTableColumns() {
    List<Column> columns = new ArrayList<>();

    // Create many columns with names that could cause ngram explosion when combined with fuzzy
    // search
    String[] columnNames = {
      C1,
      C2,
      "customer_id",
      "customer_first_name",
      "customer_last_name",
      "customer_email_address",
      "customer_phone_number",
      "customer_billing_address",
      "customer_shipping_address",
      "customer_city_name",
      "customer_state_province",
      "customer_postal_code",
      "customer_country_code",
      "customer_registration_date",
      "order_id",
      "order_creation_date",
      "order_last_updated",
      "order_status_code",
      "order_total_amount",
      "order_tax_amount",
      "order_shipping_amount",
      "order_discount_amount",
      "order_payment_method",
      "product_id",
      "product_name",
      "product_category",
      "product_subcategory",
      "product_brand_name",
      "product_price",
      "product_discount_percentage",
      "product_tax_rate",
      "product_quantity_ordered",
      "product_weight",
      "product_dimensions",
      "product_color",
      "product_size",
      "product_material",
      "payment_method_type",
      "payment_status",
      "payment_transaction_id",
      "payment_amount",
      "payment_date",
      "shipping_method",
      "shipping_address_line1",
      "shipping_address_line2",
      "shipping_city",
      "shipping_state",
      "shipping_postal_code",
      "shipping_country",
      "shipping_tracking_number",
      "experiment_id",
      "experiment_name",
      "experiment_variant_id",
      "experiment_start_date",
      "experiment_end_date",
      "experiment_status",
      "experiment_conversion_rate",
      "experiment_significance",
      "snowplow_event_id",
      "snowplow_user_id",
      "snowplow_session_id",
      "snowplow_timestamp",
      "snowplow_event_type",
      "snowplow_page_url",
      "snowplow_referrer_url",
      "snowplow_user_agent",
      "evaluation_score",
      "evaluation_criteria",
      "evaluation_timestamp",
      "evaluation_evaluator_id",
      "analytics_dimension_1",
      "analytics_dimension_2",
      "analytics_dimension_3",
      "analytics_metric_1",
      "processing_status",
      "processing_start_time",
      "processing_end_time",
      "processing_error_message"
    };

    for (String columnName : columnNames) {
      Column column =
          new Column()
              .withName(columnName)
              .withDataType(ColumnDataType.VARCHAR)
              .withDataLength(255)
              .withDescription("Test column for fuzzy search clause explosion test: " + columnName);
      columns.add(column);
    }

    return columns;
  }

  private List<Field> createManyTopicSchemaFields() {
    List<Field> fields = new ArrayList<>();

    String[] fieldNames = {
      "event_id",
      "event_timestamp",
      "event_type",
      "event_category",
      "event_action",
      "user_id",
      "user_session_id",
      "user_ip_address",
      "user_user_agent",
      "user_country",
      "page_url",
      "page_title",
      "page_referrer",
      "page_category",
      "page_language",
      "experiment_id",
      "experiment_name",
      "experiment_variant",
      "experiment_traffic_allocation",
      "product_id",
      "product_name",
      "product_category",
      "product_price",
      "product_brand",
      "order_id",
      "order_value",
      "order_currency",
      "order_items_count",
      "order_shipping_method",
      "campaign_id",
      "campaign_name",
      "campaign_source",
      "campaign_medium",
      "campaign_content",
      "device_type",
      "device_brand",
      "device_model",
      "device_os",
      "device_browser",
      "geolocation_country",
      "geolocation_region",
      "geolocation_city",
      "geolocation_latitude",
      "geolocation_longitude",
      "custom_dimension_1",
      "custom_dimension_2",
      "custom_dimension_3",
      "custom_dimension_4",
      "custom_dimension_5",
      "snowplow_derived_timestamp",
      "snowplow_collector_timestamp",
      "snowplow_etl_timestamp",
      "evaluation_score",
      "evaluation_model_version",
      "evaluation_confidence",
      "evaluation_features"
    };

    for (String fieldName : fieldNames) {
      Field field =
          new Field()
              .withName(fieldName)
              .withDataType(FieldDataType.STRING)
              .withDescription("Test schema field for topic fuzzy search: " + fieldName);
      fields.add(field);
    }

    return fields;
  }

  @Test
  void testSearchWithClusterAlias() throws IOException {
    // This test verifies that search works correctly with the cluster alias
    // configured in OpenMetadataApplicationTest (ELASTIC_SEARCH_CLUSTER_ALIAS = "openmetadata")

    // Create a test table
    String testTableName = "cluster_alias_test_table_" + System.currentTimeMillis();
    CreateTable createTable =
        tableResourceTest
            .createRequest("clusterAliasTest")
            .withName(testTableName)
            .withColumns(
                List.of(
                    new Column().withName("id").withDataType(ColumnDataType.INT),
                    new Column().withName("name").withDataType(ColumnDataType.STRING)))
            .withTableConstraints(null);

    Table testTable = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
    assertNotNull(testTable);

    TestUtils.simulateWork(2000);

    // Search for the table
    Response response = searchWithQuery(testTableName, "table_search_index");
    assertEquals(200, response.getStatus(), "Search should succeed");

    String responseBody = (String) response.getEntity();
    assertNotNull(responseBody);
    assertTrue(
        responseBody.contains(testTableName), "Search results should contain the test table");
    // Clean up
    tableResourceTest.deleteEntity(testTable.getId(), ADMIN_AUTH_HEADERS);
  }

  @Test
  void testGlobalSearchWithClusterAlias() throws IOException {
    String uniquePrefix = "global_search_test_" + System.currentTimeMillis();

    CreateTable createTable =
        tableResourceTest
            .createRequest("globalSearchTable")
            .withName(uniquePrefix + "_table")
            .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.INT)))
            .withTableConstraints(null);
    Table testTable = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    CreateTopic createTopic =
        topicResourceTest
            .createRequest("globalSearchTopic")
            .withName(uniquePrefix + "_topic")
            .withMessageSchema(
                new MessageSchema()
                    .withSchemaType(SchemaType.Avro)
                    .withSchemaFields(
                        List.of(new Field().withName("id").withDataType(FieldDataType.INT))));
    Topic testTopic = topicResourceTest.createEntity(createTopic, ADMIN_AUTH_HEADERS);

    // Wait for indexing
    TestUtils.simulateWork(2000);
    // Search globally for the unique prefix
    Response response = searchWithQuery(uniquePrefix, "all");
    assertEquals(200, response.getStatus(), "Global search should succeed");

    String responseBody = (String) response.getEntity();
    assertNotNull(responseBody);
    assertTrue(responseBody.contains(uniquePrefix + "_table"), "Should find the table");
    assertTrue(responseBody.contains(uniquePrefix + "_topic"), "Should find the topic");

    // Clean up
    tableResourceTest.deleteEntity(testTable.getId(), ADMIN_AUTH_HEADERS);
    topicResourceTest.deleteEntity(testTopic.getId(), ADMIN_AUTH_HEADERS);
  }

  @Test
  void testSearchOperationsWithClusterAlias() {
    // This test verifies that various search operations work correctly with cluster alias

    // Test that the search repository has the expected cluster alias
    assertEquals(
        ELASTIC_SEARCH_CLUSTER_ALIAS,
        APP.getApplication().getSearchRepository().getClusterAlias(),
        "Search repository should have the configured cluster alias");

    // Test index mapping retrieval
    IndexMapping tableMapping = APP.getApplication().getSearchRepository().getIndexMapping("table");
    assertNotNull(tableMapping, "Table index mapping should exist");

    // Verify index name includes cluster alias
    String tableIndexName = tableMapping.getIndexName(ELASTIC_SEARCH_CLUSTER_ALIAS);
    assertEquals(
        ELASTIC_SEARCH_CLUSTER_ALIAS + "_table_search_index",
        tableIndexName,
        "Table index name should include cluster alias");

    // Test the search repository's index name resolution
    String resolvedIndexName =
        APP.getApplication().getSearchRepository().getIndexOrAliasName("table_search_index");
    assertEquals(
        ELASTIC_SEARCH_CLUSTER_ALIAS + "_table_search_index",
        resolvedIndexName,
        "Resolved index name should include cluster alias");

    // Test multiple index resolution
    String multipleIndexes =
        APP.getApplication()
            .getSearchRepository()
            .getIndexOrAliasName("table_search_index,dashboard_search_index,pipeline_search_index");
    String[] resolvedIndexes = multipleIndexes.split(",");
    assertEquals(3, resolvedIndexes.length, "Should resolve 3 indexes");
    for (String index : resolvedIndexes) {
      assertTrue(
          index.startsWith(ELASTIC_SEARCH_CLUSTER_ALIAS + "_"),
          "Each resolved index should start with cluster alias: " + index);
    }
  }
}
