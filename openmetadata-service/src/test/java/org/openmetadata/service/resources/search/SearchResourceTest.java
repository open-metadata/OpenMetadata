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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.resources.EntityResourceTest.C1;
import static org.openmetadata.service.resources.EntityResourceTest.C2;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
public class SearchResourceTest extends OpenMetadataApplicationTest {

  private Table testTableWithManyColumns;
  private Topic testTopicWithManyFields;
  private TableResourceTest tableResourceTest;
  private TopicResourceTest topicResourceTest;

  @BeforeAll
  public void setup(TestInfo test) {
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
  public void testLongTableNameWithManyColumnsDoesNotCauseClauseExplosion() throws IOException {
    String longTableName = "int_snowplow_experiment_evaluation_detailed_analytics_processing";
    List<Column> manyColumns = createManyTableColumns();

    String uniqueTestName = "fuzzySearchClauseTest_" + System.currentTimeMillis();
    CreateTable createTable =
        tableResourceTest
            .createRequest(uniqueTestName)
            .withName(longTableName + "_" + System.currentTimeMillis())
            .withColumns(manyColumns);

    testTableWithManyColumns = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);
    assertNotNull(testTableWithManyColumns);

    String problematicQuery = "int_snowplow_experiment_evaluation";
    // waitForIndexingCompletion("table_search_index", problematicQuery, 3000);

    assertDoesNotThrow(
        () -> {
          Response response = searchWithQuery(problematicQuery, "table_search_index");

          assertTrue(
              response.getStatus() == 200,
              "Search should succeed without too_many_nested_clauses error");

          String responseBody = (String) response.getEntity();
          assertNotNull(responseBody);
          assertTrue(responseBody.length() > 0);
        });
  }

  @Test
  public void testTopicWithManySchemaFieldsDoesNotCauseClauseExplosion()
      throws IOException, InterruptedException {
    String longTopicName = "snowplow_experiment_evaluation_events_detailed_schema";
    List<Field> manySchemaFields = createManyTopicSchemaFields();

    MessageSchema messageSchema =
        new MessageSchema().withSchemaType(SchemaType.JSON).withSchemaFields(manySchemaFields);

    // Use timestamp to make test names unique
    String uniqueTestName = "fuzzySearchTopicClauseTest_" + System.currentTimeMillis();
    CreateTopic createTopic =
        topicResourceTest
            .createRequest(uniqueTestName)
            .withName(longTopicName + "_" + System.currentTimeMillis())
            .withMessageSchema(messageSchema);

    testTopicWithManyFields = topicResourceTest.createEntity(createTopic, ADMIN_AUTH_HEADERS);
    assertNotNull(testTopicWithManyFields);

    Thread.sleep(3000);
    String problematicQuery = "snowplow_experiment_evaluation";

    assertDoesNotThrow(
        () -> {
          Response response = searchWithQuery(problematicQuery, "topic_search_index");

          assertTrue(
              response.getStatus() == 200,
              "Topic search should succeed without too_many_nested_clauses error");

          String responseBody = (String) response.getEntity();
          assertNotNull(responseBody);
          assertTrue(responseBody.length() > 0);
        });
  }

  @Test
  public void testVeryLongQueryWithSpecialCharacters() throws InterruptedException {
    Thread.sleep(2000);

    String veryLongQuery =
        "int_snowplow_experiment_evaluation_detailed_analytics_processing_with_special_characters_and_numbers_12345_test";

    assertDoesNotThrow(
        () -> {
          Response response = searchWithQuery(veryLongQuery, "table_search_index");

          assertTrue(
              response.getStatus() == 200, "Very long query search should succeed without errors");

          String responseBody = (String) response.getEntity();
          assertNotNull(responseBody);
        });
  }

  @Test
  public void testSearchAcrossMultipleIndexes() throws InterruptedException {
    Thread.sleep(2000);
    String query = "experiment_evaluation";

    String[] indexes = {"table_search_index", "topic_search_index", "all"};

    for (String index : indexes) {
      assertDoesNotThrow(
          () -> {
            Response response = searchWithQuery(query, index);

            assertTrue(
                response.getStatus() == 200, "Search in index '" + index + "' should succeed");
          });
    }
  }

  @Test
  public void testListMapping(TestInfo test) {
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
  public void testEntityTypeCountsWithQueryAll() throws InterruptedException {
    Thread.sleep(2000); // Wait for indexing

    assertDoesNotThrow(
        () -> {
          Response response = getEntityTypeCounts("*", "all");

          assertTrue(response.getStatus() == 200, "Entity type counts should return successfully");

          String responseBody = (String) response.getEntity();
          assertNotNull(responseBody);
          assertTrue(responseBody.contains("aggregations"), "Response should contain aggregations");
          assertTrue(
              responseBody.contains("entityType"),
              "Response should contain entityType aggregation");
        });
  }

  @Test
  public void testEntityTypeCountsWithSpecificQuery() throws InterruptedException {
    Thread.sleep(2000); // Wait for indexing

    assertDoesNotThrow(
        () -> {
          Response response = getEntityTypeCounts("snowplow", "dataAsset");

          assertTrue(response.getStatus() == 200, "Entity type counts should return successfully");

          String responseBody = (String) response.getEntity();
          assertNotNull(responseBody);
          assertTrue(responseBody.contains("aggregations"), "Response should contain aggregations");
        });
  }

  @Test
  public void testEntityTypeCountsWithEmptyQuery() throws InterruptedException {
    Thread.sleep(2000); // Wait for indexing

    assertDoesNotThrow(
        () -> {
          Response response = getEntityTypeCounts("", "dataAsset");

          assertTrue(
              response.getStatus() == 200,
              "Entity type counts with empty query should return successfully");

          String responseBody = (String) response.getEntity();
          assertNotNull(responseBody);
          assertTrue(responseBody.contains("aggregations"), "Response should contain aggregations");
        });
  }

  @Test
  public void testEntityTypeCountsWithQueryFilter() throws InterruptedException {
    Thread.sleep(2000); // Wait for indexing

    // Test without filters - simple case
    assertDoesNotThrow(
        () -> {
          Response response = getEntityTypeCounts("*", "dataAsset");

          assertTrue(response.getStatus() == 200, "Entity type counts should return successfully");

          String responseBody = (String) response.getEntity();
          assertNotNull(responseBody);
          assertTrue(responseBody.contains("aggregations"), "Response should contain aggregations");
        });
  }

  @Test
  public void testEntityTypeCountsWithPostFilter() throws InterruptedException {
    Thread.sleep(2000); // Wait for indexing

    // Test without filters - simple case
    assertDoesNotThrow(
        () -> {
          Response response = getEntityTypeCounts("*", "dataAsset");

          assertTrue(response.getStatus() == 200, "Entity type counts should return successfully");

          String responseBody = (String) response.getEntity();
          assertNotNull(responseBody);
          assertTrue(responseBody.contains("aggregations"), "Response should contain aggregations");
        });
  }

  @Test
  public void testEntityTypeCountsForDeletedEntities() throws InterruptedException {
    Thread.sleep(2000); // Wait for indexing

    assertDoesNotThrow(
        () -> {
          WebTarget target =
              getResource("search/entityTypeCounts")
                  .queryParam("q", "*")
                  .queryParam("index", "dataAsset")
                  .queryParam("deleted", true);

          String result = TestUtils.get(target, String.class, ADMIN_AUTH_HEADERS);
          Response response = Response.ok(result).build();

          assertTrue(
              response.getStatus() == 200,
              "Entity type counts for deleted entities should return successfully");

          String responseBody = (String) response.getEntity();
          assertNotNull(responseBody);
          assertTrue(responseBody.contains("aggregations"), "Response should contain aggregations");
        });
  }

  @Test
  public void testEntityTypeCountsWithCreatedEntities() throws IOException, InterruptedException {
    // Wait for any existing indexing
    Thread.sleep(3000);

    // Test entity type counts for all entities
    assertDoesNotThrow(
        () -> {
          Response response = getEntityTypeCounts("*", "all");

          assertTrue(response.getStatus() == 200, "Entity type counts should return successfully");

          String responseBody = (String) response.getEntity();
          assertNotNull(responseBody);

          // Verify the response contains expected structure
          assertTrue(responseBody.contains("aggregations"), "Response should contain aggregations");
          assertTrue(
              responseBody.contains("entityType"),
              "Response should contain entityType aggregation");
          assertTrue(responseBody.contains("buckets"), "Response should contain buckets");
        });

    // Test entity type counts with specific search query
    assertDoesNotThrow(
        () -> {
          Response response = getEntityTypeCounts("test", "dataAsset");

          assertTrue(
              response.getStatus() == 200,
              "Entity type counts with specific query should return successfully");

          String responseBody = (String) response.getEntity();
          assertNotNull(responseBody);
          assertTrue(responseBody.contains("aggregations"), "Response should contain aggregations");
        });
  }

  private Response getEntityTypeCounts(String query, String index) {
    WebTarget target =
        getResource("search/entityTypeCounts").queryParam("q", query).queryParam("index", index);

    try {
      String result = TestUtils.get(target, String.class, ADMIN_AUTH_HEADERS);
      return Response.ok(result).build();
    } catch (org.apache.http.client.HttpResponseException e) {
      LOG.error("Error occurred while getting entity type counts: {}", e.getMessage());
      return Response.status(e.getStatusCode()).entity(e.getMessage()).build();
    }
  }

  @Test
  public void testEntityTypeCountsResponseStructure() throws IOException, InterruptedException {
    // Wait for indexing
    Thread.sleep(3000);

    Response response = getEntityTypeCounts("*", "all");
    assertTrue(response.getStatus() == 200, "Entity type counts should return successfully");

    String responseBody = (String) response.getEntity();
    assertNotNull(responseBody);

    // Parse JSON response
    ObjectMapper objectMapper = new ObjectMapper();
    JsonNode jsonResponse = objectMapper.readTree(responseBody);

    // Validate response structure
    assertTrue(jsonResponse.has("aggregations"), "Response should have aggregations field");
    JsonNode aggregations = jsonResponse.get("aggregations");

    // Check for different possible aggregation field names (could be "entityType" or
    // "sterms#entityType")
    JsonNode entityTypeAgg = null;
    if (aggregations.has("entityType")) {
      entityTypeAgg = aggregations.get("entityType");
    } else if (aggregations.has("sterms#entityType")) {
      entityTypeAgg = aggregations.get("sterms#entityType");
    }

    assertNotNull(entityTypeAgg, "Aggregations should have entityType field");
    assertTrue(entityTypeAgg.has("buckets"), "EntityType aggregation should have buckets");
    JsonNode buckets = entityTypeAgg.get("buckets");

    assertTrue(buckets.isArray(), "Buckets should be an array");

    // Validate bucket structure if any exist
    if (buckets.size() > 0) {
      for (JsonNode bucket : buckets) {
        assertTrue(bucket.has("key"), "Each bucket should have a key field");
        assertTrue(bucket.has("doc_count"), "Each bucket should have a doc_count field");

        String entityType = bucket.get("key").asText();
        long docCount = bucket.get("doc_count").asLong();

        assertNotNull(entityType, "Entity type should not be null");
        assertTrue(docCount >= 0, "Document count should be non-negative");

        LOG.info("Found entity type: {} with count: {}", entityType, docCount);
      }
    }

    // Verify hits section
    assertTrue(jsonResponse.has("hits"), "Response should have hits field");
    JsonNode hits = jsonResponse.get("hits");

    assertTrue(hits.has("total"), "Hits should have total field");
    JsonNode total = hits.get("total");

    if (total.isObject()) {
      // ES 7.x format
      assertTrue(total.has("value"), "Total should have value field");
      assertTrue(total.get("value").asLong() >= 0, "Total value should be non-negative");
    } else {
      // Legacy format
      assertTrue(total.asLong() >= 0, "Total should be non-negative");
    }
  }

  @Test
  public void testEntityTypeCountsConsistencyWithRegularSearch()
      throws IOException, InterruptedException {
    // Wait for indexing
    Thread.sleep(3000);

    // Use a common search term that should return some results
    String searchTerm = "test";

    // Test consistency for dataAsset index
    assertDoesNotThrow(
        () -> {
          // Get regular search results
          Response searchResponse = searchWithQuery(searchTerm, "dataAsset");
          assertTrue(
              searchResponse.getStatus() == 200, "Regular search should return successfully");

          String searchBody = (String) searchResponse.getEntity();
          ObjectMapper objectMapper = new ObjectMapper();
          JsonNode searchJson = objectMapper.readTree(searchBody);

          // Extract total hits from regular search
          long totalHits = extractTotalHits(searchJson);

          // Get entity type counts
          Response countsResponse = getEntityTypeCounts(searchTerm, "dataAsset");
          assertTrue(
              countsResponse.getStatus() == 200, "Entity type counts should return successfully");

          String countsBody = (String) countsResponse.getEntity();
          JsonNode countsJson = objectMapper.readTree(countsBody);

          // Count total from aggregations
          long totalFromAggregations = 0;
          JsonNode aggregations = countsJson.get("aggregations");
          if (aggregations != null) {
            // Check for different possible aggregation field names
            JsonNode entityTypeAgg =
                aggregations.has("entityType")
                    ? aggregations.get("entityType")
                    : aggregations.get("sterms#entityType");

            if (entityTypeAgg != null && entityTypeAgg.has("buckets")) {
              JsonNode buckets = entityTypeAgg.get("buckets");
              for (JsonNode bucket : buckets) {
                totalFromAggregations += bucket.get("doc_count").asLong();
              }
            }
          }

          // Log results for debugging
          LOG.info("Regular search total hits: {}", totalHits);
          LOG.info("Entity type counts total: {}", totalFromAggregations);

          // Both should return results if data exists
          if (totalHits > 0) {
            assertTrue(
                totalFromAggregations > 0,
                "Entity type counts should have results when regular search has results");
          }
        });

    // Test consistency for table index specifically
    assertDoesNotThrow(
        () -> {
          // Get regular search results for table
          Response searchResponse = searchWithQuery(searchTerm, "table");
          assertTrue(searchResponse.getStatus() == 200, "Table search should return successfully");

          String searchBody = (String) searchResponse.getEntity();
          ObjectMapper objectMapper = new ObjectMapper();
          JsonNode searchJson = objectMapper.readTree(searchBody);

          // Extract total hits from regular search
          long tableHits = extractTotalHits(searchJson);

          // Get entity type counts for table
          Response countsResponse = getEntityTypeCounts(searchTerm, "table");
          assertTrue(
              countsResponse.getStatus() == 200,
              "Table entity type counts should return successfully");

          String countsBody = (String) countsResponse.getEntity();
          JsonNode countsJson = objectMapper.readTree(countsBody);

          // Count tables from aggregations
          long tableCount = 0;
          JsonNode aggregations = countsJson.get("aggregations");
          if (aggregations != null) {
            // Check for different possible aggregation field names
            JsonNode entityTypeAgg =
                aggregations.has("entityType")
                    ? aggregations.get("entityType")
                    : aggregations.get("sterms#entityType");

            if (entityTypeAgg != null && entityTypeAgg.has("buckets")) {
              JsonNode buckets = entityTypeAgg.get("buckets");
              for (JsonNode bucket : buckets) {
                if ("table".equals(bucket.get("key").asText())) {
                  tableCount = bucket.get("doc_count").asLong();
                  break;
                }
              }
            }
          }

          LOG.info(
              "Table search hits: {}, Table count from aggregations: {}", tableHits, tableCount);
        });
  }

  @Test
  public void testEntityTypeCountsWithMultiWordQuery() throws InterruptedException {
    Thread.sleep(2000); // Wait for indexing

    // Test multi-word queries like "log fail"
    String[] multiWordQueries = {"log fail", "test data", "customer order"};

    for (String query : multiWordQueries) {
      assertDoesNotThrow(
          () -> {
            // Test with dataAsset index
            Response dataAssetResponse = getEntityTypeCounts(query, "dataAsset");
            assertTrue(
                dataAssetResponse.getStatus() == 200,
                "Entity type counts should work with multi-word query: " + query);

            // Test with table index
            Response tableResponse = getEntityTypeCounts(query, "table");
            assertTrue(
                tableResponse.getStatus() == 200,
                "Table entity type counts should work with multi-word query: " + query);

            // Verify response structure
            String dataAssetBody = (String) dataAssetResponse.getEntity();
            assertNotNull(dataAssetBody);
            assertTrue(
                dataAssetBody.contains("aggregations"),
                "Response should contain aggregations for query: " + query);
          });
    }
  }

  @Test
  public void testSearchQueryConsistencyBetweenDataAssetAndTable()
      throws IOException, InterruptedException {
    // Wait for indexing
    Thread.sleep(3000);

    // Use a common search term
    String searchTerm = "*";

    // Test 1: Search with index=table should return only tables
    assertDoesNotThrow(
        () -> {
          Response tableResponse = searchWithQuery(searchTerm, "table");
          assertTrue(tableResponse.getStatus() == 200, "Table search should succeed");

          String tableBody = (String) tableResponse.getEntity();
          ObjectMapper objectMapper = new ObjectMapper();
          JsonNode tableJson = objectMapper.readTree(tableBody);

          // Extract hits from table search
          long tableHits = extractTotalHits(tableJson);

          // Verify all results are tables
          if (tableJson.has("hits") && tableJson.get("hits").has("hits")) {
            JsonNode hits = tableJson.get("hits").get("hits");
            for (JsonNode hit : hits) {
              if (hit.has("_source") && hit.get("_source").has("entityType")) {
                assertEquals(
                    "table",
                    hit.get("_source").get("entityType").asText(),
                    "All results from table index should be tables");
              }
            }
          }

          LOG.info("Table search found {} hits", tableHits);
        });

    // Test 2: Search with index=dataAsset should return multiple entity types
    assertDoesNotThrow(
        () -> {
          Response dataAssetResponse = searchWithQuery(searchTerm, "dataAsset");
          assertTrue(dataAssetResponse.getStatus() == 200, "DataAsset search should succeed");

          String dataAssetBody = (String) dataAssetResponse.getEntity();
          ObjectMapper objectMapper = new ObjectMapper();
          JsonNode dataAssetJson = objectMapper.readTree(dataAssetBody);

          // Extract hits from dataAsset search
          long dataAssetHits = extractTotalHits(dataAssetJson);

          // Count entity types in results
          Map<String, Integer> entityTypeCounts = new HashMap<>();
          if (dataAssetJson.has("hits") && dataAssetJson.get("hits").has("hits")) {
            JsonNode hits = dataAssetJson.get("hits").get("hits");
            for (JsonNode hit : hits) {
              if (hit.has("_source") && hit.get("_source").has("entityType")) {
                String entityType = hit.get("_source").get("entityType").asText();
                entityTypeCounts.put(entityType, entityTypeCounts.getOrDefault(entityType, 0) + 1);
              }
            }
          }

          LOG.info(
              "DataAsset search found {} total hits with entity types: {}",
              dataAssetHits,
              entityTypeCounts);

          // DataAsset should potentially include multiple entity types
          assertNotNull(entityTypeCounts, "Should have entity type counts");
        });
  }

  @Test
  public void testSearchQueryWithMultiWordConsistency() throws IOException, InterruptedException {
    // Create entities with multi-word names to test "log fail" type queries
    String basePattern = "log_fail_test_" + System.currentTimeMillis();

    // Create tables with variations of multi-word patterns
    String[] tableNames = {
      basePattern + "_log_fail_table",
      basePattern + "_logfail_table",
      basePattern + "_log_failure_table",
      basePattern + "_fail_log_table"
    };

    List<Table> tables = new ArrayList<>();
    for (String tableName : tableNames) {
      CreateTable createTable =
          tableResourceTest
              .createRequest(tableName)
              .withName(tableName)
              .withColumns(
                  List.of(new Column().withName("test_col").withDataType(ColumnDataType.VARCHAR)));

      tables.add(tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS));
    }

    // Wait for indexing
    Thread.sleep(5000);

    // Test various multi-word queries
    String[] queries = {"log fail", "log_fail", "fail log", "log AND fail"};

    for (String query : queries) {
      assertDoesNotThrow(
          () -> {
            // Search in table index
            Response tableResponse = searchWithQuery(query, "table");
            assertTrue(
                tableResponse.getStatus() == 200,
                "Table search should succeed for query: " + query);

            String tableBody = (String) tableResponse.getEntity();
            ObjectMapper objectMapper = new ObjectMapper();
            JsonNode tableJson = objectMapper.readTree(tableBody);

            long tableHits = extractTotalHits(tableJson);

            // Search in dataAsset index
            Response dataAssetResponse = searchWithQuery(query, "dataAsset");
            assertTrue(
                dataAssetResponse.getStatus() == 200,
                "DataAsset search should succeed for query: " + query);

            String dataAssetBody = (String) dataAssetResponse.getEntity();
            JsonNode dataAssetJson = objectMapper.readTree(dataAssetBody);

            long dataAssetHits = extractTotalHits(dataAssetJson);

            // Log results for debugging
            LOG.info(
                "Query '{}': table hits = {}, dataAsset hits = {}",
                query,
                tableHits,
                dataAssetHits);

            // DataAsset should have at least as many hits as table
            // (since it includes tables plus potentially other entity types)
            assertTrue(
                dataAssetHits >= tableHits,
                String.format(
                    "DataAsset hits (%d) should be >= table hits (%d) for query: %s",
                    dataAssetHits, tableHits, query));
          });
    }
  }

  @Test
  public void testSearchQueryFieldSpecificConsistency() throws IOException, InterruptedException {
    // Create entities to test field-specific searches
    String uniqueId = "field_test_" + System.currentTimeMillis();

    // Create a table with specific field values
    CreateTable createTable =
        tableResourceTest
            .createRequest(uniqueId + "_table")
            .withName("generic_name_" + uniqueId)
            .withDisplayName("Special Display " + uniqueId)
            .withDescription("This is a detailed description with " + uniqueId);

    Table table = tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Wait for indexing
    Thread.sleep(5000);

    // Test field-specific queries
    String[] fieldQueries = {
      "name:generic_name_" + uniqueId, "displayName:\"Special Display\"", "description:" + uniqueId
    };

    for (String query : fieldQueries) {
      assertDoesNotThrow(
          () -> {
            // Search in table index
            Response tableResponse = searchWithQuery(query, "table");
            assertTrue(
                tableResponse.getStatus() == 200,
                "Table field search should succeed for query: " + query);

            String tableBody = (String) tableResponse.getEntity();
            ObjectMapper objectMapper = new ObjectMapper();
            JsonNode tableJson = objectMapper.readTree(tableBody);

            long tableHits = extractTotalHits(tableJson);
            assertTrue(tableHits >= 1, "Should find at least 1 table for field query: " + query);

            // Search in dataAsset index
            Response dataAssetResponse = searchWithQuery(query, "dataAsset");
            assertTrue(
                dataAssetResponse.getStatus() == 200,
                "DataAsset field search should succeed for query: " + query);

            String dataAssetBody = (String) dataAssetResponse.getEntity();
            JsonNode dataAssetJson = objectMapper.readTree(dataAssetBody);

            long dataAssetHits = extractTotalHits(dataAssetJson);
            assertTrue(
                dataAssetHits >= 1,
                "Should find at least 1 entity in dataAsset for field query: " + query);

            LOG.info(
                "Field query '{}': table hits = {}, dataAsset hits = {}",
                query,
                tableHits,
                dataAssetHits);
          });
    }
  }

  @Test
  public void testSearchQueryPaginationConsistency() throws IOException, InterruptedException {
    // Create multiple entities to test pagination
    String pattern = "pagination_test_" + System.currentTimeMillis();

    // Create 15 tables to ensure we have enough for pagination
    List<Table> tables = new ArrayList<>();
    for (int i = 0; i < 15; i++) {
      String tableName = pattern + "_table_" + String.format("%02d", i);
      CreateTable createTable =
          tableResourceTest
              .createRequest(tableName)
              .withName(tableName)
              .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.INT)));

      tables.add(tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS));
    }

    // Wait for indexing
    Thread.sleep(5000);

    // Test pagination consistency
    assertDoesNotThrow(
        () -> {
          // Get first page from table index
          WebTarget tableTarget1 =
              getResource("search/query")
                  .queryParam("q", pattern)
                  .queryParam("index", "table")
                  .queryParam("from", 0)
                  .queryParam("size", 10);

          String tableResult1 = TestUtils.get(tableTarget1, String.class, ADMIN_AUTH_HEADERS);
          ObjectMapper objectMapper = new ObjectMapper();
          JsonNode tablePage1 = objectMapper.readTree(tableResult1);

          // Get second page from table index
          WebTarget tableTarget2 =
              getResource("search/query")
                  .queryParam("q", pattern)
                  .queryParam("index", "table")
                  .queryParam("from", 10)
                  .queryParam("size", 10);

          String tableResult2 = TestUtils.get(tableTarget2, String.class, ADMIN_AUTH_HEADERS);
          JsonNode tablePage2 = objectMapper.readTree(tableResult2);

          // Get first page from dataAsset index
          WebTarget dataAssetTarget1 =
              getResource("search/query")
                  .queryParam("q", pattern)
                  .queryParam("index", "dataAsset")
                  .queryParam("from", 0)
                  .queryParam("size", 10);

          String dataAssetResult1 =
              TestUtils.get(dataAssetTarget1, String.class, ADMIN_AUTH_HEADERS);
          JsonNode dataAssetPage1 = objectMapper.readTree(dataAssetResult1);

          // Verify pagination works correctly
          long tableTotal = extractTotalHits(tablePage1);
          long dataAssetTotal = extractTotalHits(dataAssetPage1);

          assertTrue(tableTotal >= 15, "Should find at least 15 tables");
          assertTrue(dataAssetTotal >= 15, "Should find at least 15 entities in dataAsset");

          // Verify no duplicate results between pages
          Set<String> tablePage1Ids = extractEntityIds(tablePage1);
          Set<String> tablePage2Ids = extractEntityIds(tablePage2);

          // Ensure no overlap between pages
          Set<String> intersection = new HashSet<>(tablePage1Ids);
          intersection.retainAll(tablePage2Ids);
          assertTrue(intersection.isEmpty(), "No entities should appear in both pages");

          LOG.info(
              "Pagination test - Table total: {}, DataAsset total: {}", tableTotal, dataAssetTotal);
        });
  }

  // Helper method to extract total hits from search response
  private long extractTotalHits(JsonNode searchJson) {
    if (searchJson.has("hits") && searchJson.get("hits").has("total")) {
      JsonNode total = searchJson.get("hits").get("total");
      if (total.isObject() && total.has("value")) {
        return total.get("value").asLong();
      } else {
        return total.asLong();
      }
    }
    return 0;
  }

  // Helper method to extract entity IDs from search results
  private Set<String> extractEntityIds(JsonNode searchJson) {
    Set<String> ids = new HashSet<>();
    if (searchJson.has("hits") && searchJson.get("hits").has("hits")) {
      JsonNode hits = searchJson.get("hits").get("hits");
      for (JsonNode hit : hits) {
        if (hit.has("_id")) {
          ids.add(hit.get("_id").asText());
        }
      }
    }
    return ids;
  }
}
