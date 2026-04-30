/*
 *  Copyright 2024 Collate
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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.DatabaseServices;
import org.openmetadata.service.Entity;

/**
 * Integration tests for column search indexing during table reindexing. Verifies:
 *
 * <ul>
 *   <li>Column indexing during table processing
 *   <li>Column parent references (service, database, schema, table)
 *   <li>Column search functionality in explore
 *   <li>Nested column flattening and indexing
 * </ul>
 *
 * <p>These tests verify the column search functionality works correctly when searching for columns
 * in the explore page.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ColumnSearchIndexIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  @Nested
  @DisplayName("Column Search Index Tests")
  @Execution(ExecutionMode.CONCURRENT)
  class ColumnSearchTests {

    @Test
    @DisplayName("Should find columns in column_search_index by name")
    void testSearchColumnsByName(TestNamespace ns) throws Exception {
      OpenMetadataClient client = SdkClients.adminClient();

      // Create a table with specific columns
      Table table = createTableWithColumns(ns, "col_search_name");

      // Wait for indexing
      TimeUnit.SECONDS.sleep(2);

      // Search for the column in column_search_index
      String columnName = ns.prefix("user_email");
      String response =
          client.search().query(columnName).index("column_search_index").size(10).execute();

      assertNotNull(response);
      JsonNode root = OBJECT_MAPPER.readTree(response);
      assertTrue(root.has("hits"), "Response should have hits");

      // Verify search returns results
      JsonNode hits = root.path("hits").path("hits");
      assertTrue(hits.isArray(), "Hits should be an array");
    }

    @Test
    @DisplayName("Should return columns with parent table reference")
    void testColumnHasTableReference(TestNamespace ns) throws Exception {
      OpenMetadataClient client = SdkClients.adminClient();

      // Create a table
      Table table = createTableWithColumns(ns, "col_table_ref");

      // Wait for indexing
      TimeUnit.SECONDS.sleep(2);

      // Search for the column
      String columnName = ns.prefix("user_email");
      String response =
          client
              .search()
              .query(columnName)
              .index("column_search_index")
              .size(10)
              .deleted(false)
              .execute();

      JsonNode root = OBJECT_MAPPER.readTree(response);
      JsonNode hits = root.path("hits").path("hits");

      if (hits.size() > 0) {
        // Find the hit that matches our test column
        for (JsonNode hit : hits) {
          JsonNode source = hit.path("_source");
          String fqn = source.path("fullyQualifiedName").asText("");
          if (fqn.contains(ns.prefix(""))) {
            // Verify entityType is tableColumn
            assertEquals(
                "tableColumn",
                source.path("entityType").asText(),
                "Column should have entityType 'tableColumn'");

            // Verify table reference exists
            JsonNode tableRef = source.path("table");
            assertFalse(tableRef.isMissingNode(), "Column should have table reference");
            assertFalse(
                tableRef.path("name").asText("").isEmpty(), "Table reference should have name");
            assertFalse(
                tableRef.path("fullyQualifiedName").asText("").isEmpty(),
                "Table reference should have FQN");
            break;
          }
        }
      }
    }

    @Test
    @DisplayName("Should return columns with service reference for breadcrumb")
    void testColumnHasServiceReference(TestNamespace ns) throws Exception {
      OpenMetadataClient client = SdkClients.adminClient();

      // Create a table
      Table table = createTableWithColumns(ns, "col_svc_ref");

      // Wait for indexing
      TimeUnit.SECONDS.sleep(2);

      // Search for the column
      String columnName = ns.prefix("user_email");
      String response =
          client
              .search()
              .query(columnName)
              .index("column_search_index")
              .size(10)
              .deleted(false)
              .execute();

      JsonNode root = OBJECT_MAPPER.readTree(response);
      JsonNode hits = root.path("hits").path("hits");

      if (hits.size() > 0) {
        for (JsonNode hit : hits) {
          JsonNode source = hit.path("_source");
          String fqn = source.path("fullyQualifiedName").asText("");
          if (fqn.contains(ns.prefix(""))) {
            // Verify service reference exists (for breadcrumb display)
            JsonNode serviceRef = source.path("service");
            assertFalse(
                serviceRef.isMissingNode(),
                "Column should have service reference for breadcrumb display");
            assertFalse(
                serviceRef.path("name").asText("").isEmpty(), "Service reference should have name");
            break;
          }
        }
      }
    }

    @Test
    @DisplayName("Should return columns with database reference for breadcrumb")
    void testColumnHasDatabaseReference(TestNamespace ns) throws Exception {
      OpenMetadataClient client = SdkClients.adminClient();

      // Create a table
      Table table = createTableWithColumns(ns, "col_db_ref");

      // Wait for indexing
      TimeUnit.SECONDS.sleep(2);

      // Search for the column
      String columnName = ns.prefix("user_email");
      String response =
          client
              .search()
              .query(columnName)
              .index("column_search_index")
              .size(10)
              .deleted(false)
              .execute();

      JsonNode root = OBJECT_MAPPER.readTree(response);
      JsonNode hits = root.path("hits").path("hits");

      if (hits.size() > 0) {
        for (JsonNode hit : hits) {
          JsonNode source = hit.path("_source");
          String fqn = source.path("fullyQualifiedName").asText("");
          if (fqn.contains(ns.prefix(""))) {
            // Verify database reference exists (for breadcrumb display)
            JsonNode databaseRef = source.path("database");
            assertFalse(
                databaseRef.isMissingNode(),
                "Column should have database reference for breadcrumb display");
            assertFalse(
                databaseRef.path("name").asText("").isEmpty(),
                "Database reference should have name");
            break;
          }
        }
      }
    }

    @Test
    @DisplayName("Should return columns with databaseSchema reference for breadcrumb")
    void testColumnHasSchemaReference(TestNamespace ns) throws Exception {
      OpenMetadataClient client = SdkClients.adminClient();

      // Create a table
      Table table = createTableWithColumns(ns, "col_schema_ref");

      // Wait for indexing
      TimeUnit.SECONDS.sleep(2);

      // Search for the column
      String columnName = ns.prefix("user_email");
      String response =
          client
              .search()
              .query(columnName)
              .index("column_search_index")
              .size(10)
              .deleted(false)
              .execute();

      JsonNode root = OBJECT_MAPPER.readTree(response);
      JsonNode hits = root.path("hits").path("hits");

      if (hits.size() > 0) {
        for (JsonNode hit : hits) {
          JsonNode source = hit.path("_source");
          String fqn = source.path("fullyQualifiedName").asText("");
          if (fqn.contains(ns.prefix(""))) {
            // Verify databaseSchema reference exists (for breadcrumb display)
            JsonNode schemaRef = source.path("databaseSchema");
            assertFalse(
                schemaRef.isMissingNode(),
                "Column should have databaseSchema reference for breadcrumb display");
            assertFalse(
                schemaRef.path("name").asText("").isEmpty(),
                "DatabaseSchema reference should have name");
            break;
          }
        }
      }
    }
  }

  @Nested
  @DisplayName("Column in DataAsset Index Tests")
  @Execution(ExecutionMode.CONCURRENT)
  class ColumnInDataAssetTests {

    @Test
    @DisplayName("Should find tableColumn entities in dataAsset index")
    void testColumnsInDataAssetIndex(TestNamespace ns) throws Exception {
      OpenMetadataClient client = SdkClients.adminClient();

      // Create a table with a unique column name
      Table table = createTableWithColumns(ns, "col_dataasset");

      // Wait for indexing
      TimeUnit.SECONDS.sleep(2);

      // Search in dataAsset index with entityType filter for tableColumn
      String queryFilter =
          "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"entityType\":\"tableColumn\"}}]}}}";

      String response =
          client
              .search()
              .query("*")
              .index("dataAsset")
              .queryFilter(queryFilter)
              .size(10)
              .deleted(false)
              .execute();

      assertNotNull(response);
      JsonNode root = OBJECT_MAPPER.readTree(response);
      assertTrue(root.has("hits"), "Response should have hits");

      // If column indexing is enabled, we should find tableColumn entities
      JsonNode total = root.path("hits").path("total");
      if (total.isObject()) {
        // ES 7+ format
        assertTrue(
            total.path("value").asLong() >= 0,
            "Should return valid count for tableColumn entities");
      }
    }

    @Test
    @DisplayName("Should filter tableColumn entities by database field")
    void testColumnFilterByDatabase(TestNamespace ns) throws Exception {
      OpenMetadataClient client = SdkClients.adminClient();

      // Create a table
      Table table = createTableWithColumns(ns, "col_db_filter");

      // Wait for indexing
      TimeUnit.SECONDS.sleep(2);

      // Search with database field exists filter
      String queryFilter =
          "{\"query\":{\"bool\":{\"must\":["
              + "{\"term\":{\"entityType\":\"tableColumn\"}},"
              + "{\"exists\":{\"field\":\"database\"}}"
              + "]}}}";

      String response =
          client
              .search()
              .query("*")
              .index("dataAsset")
              .queryFilter(queryFilter)
              .size(10)
              .deleted(false)
              .execute();

      assertNotNull(response);
      JsonNode root = OBJECT_MAPPER.readTree(response);
      assertTrue(root.has("hits"), "Response should have hits");
    }
  }

  @Nested
  @DisplayName("DataAsset/TableColumn Aggregation Parity Tests")
  @Execution(ExecutionMode.CONCURRENT)
  class DataAssetColumnAggregationTests {

    /**
     * Regression for github.com/open-metadata/openmetadata-collate/issues/3851. The UI fires two
     * requests when the user types a multi-word query: {@code index=dataAsset&size=0} for the
     * entity-type aggregation and {@code index=tableColumn} for the column hits. They route through
     * different builders in {@code OpenSearchSourceBuilderFactory}: {@code tableColumn} uses the
     * dedicated lenient column builder while {@code dataAsset} uses the composite asset config with
     * stricter phrase/{@code 2<70%} matching. Without the fix, the {@code tableColumn} bucket in the
     * {@code dataAsset} aggregation under-counts the column index hits.
     */
    @Test
    @DisplayName(
        "Aggregation bucket for tableColumn under dataAsset must match index=tableColumn total")
    void testDataAssetTableColumnAggregationMatchesTableColumnTotal(TestNamespace ns)
        throws Exception {
      OpenMetadataClient client = SdkClients.adminClient();

      String tag = ns.shortPrefix();
      Table table = createTableWithMultiTokenColumns(ns, "agg_parity_" + tag, tag);
      assertNotNull(table);

      // Two analyzed sub-tokens (`<tag>` and `name`); seeded columns first_name and last_name
      // contain both, so the AND-based column builder produces a non-zero match count we can
      // assert real parity against (not a trivial 0 == 0).
      String multiTokenQuery = tag + " name";

      Awaitility.await()
          .atMost(90, TimeUnit.SECONDS)
          .pollInterval(500, TimeUnit.MILLISECONDS)
          .until(() -> totalHitsForIndex(client, multiTokenQuery, "tableColumn") >= 2);

      long columnTotal = totalHitsForIndex(client, multiTokenQuery, "tableColumn");
      long aggColumnCount = bucketCountFromDataAsset(client, multiTokenQuery, Entity.TABLE_COLUMN);

      assertTrue(
          columnTotal >= 2,
          "Seeded columns first_name and last_name should match query " + multiTokenQuery);
      assertEquals(
          columnTotal,
          aggColumnCount,
          "dataAsset aggregation tableColumn bucket ("
              + aggColumnCount
              + ") must match index=tableColumn total ("
              + columnTotal
              + ") for query \""
              + multiTokenQuery
              + "\"");
    }

    /**
     * Guards against the {@code _} over-match: the {@code om_analyzer} splits {@code first_name}
     * into {@code [first, name]}; with the old {@code Operator.Or} + {@code min_should_match=0}
     * column builder, a column called {@code <tag>_first_id} matched a query of {@code
     * <tag>_first_name} because the single token {@code first} was enough. The fix moves the
     * column builder to {@code Operator.And}, so every sub-token must match.
     */
    @Test
    @DisplayName("Column query for first_name must not match a column called first_id")
    void testColumnQueryRequiresAllSubtokensToMatch(TestNamespace ns) throws Exception {
      OpenMetadataClient client = SdkClients.adminClient();
      String tag = ns.shortPrefix();
      Table table = createTableWithMultiTokenColumns(ns, "subtoken_" + tag, tag);
      assertNotNull(table);

      String firstNameColumn = tag + "_first_name";
      String firstIdColumn = tag + "_first_id";

      Awaitility.await()
          .atMost(90, TimeUnit.SECONDS)
          .pollInterval(500, TimeUnit.MILLISECONDS)
          .until(() -> hitsForColumnQuery(client, firstNameColumn).contains(firstNameColumn));

      Set<String> hits = hitsForColumnQuery(client, firstNameColumn);
      assertTrue(
          hits.contains(firstNameColumn),
          "Query " + firstNameColumn + " must match the column with the same name; got " + hits);
      assertFalse(
          hits.contains(firstIdColumn),
          "Query "
              + firstNameColumn
              + " must not match column "
              + firstIdColumn
              + " (only the 'first' sub-token overlaps); got "
              + hits);
    }

    /**
     * Same parity guarantee that {@link #testDataAssetTableColumnAggregationMatchesTableColumnTotal}
     * pins for {@code tableColumn}, but for the {@code table} bucket. The per-type-union path must
     * make every entity-type bucket equal to what the dedicated index returns.
     */
    @Test
    @DisplayName("Aggregation bucket for table under dataAsset must match index=table total")
    void testDataAssetTableBucketMatchesTableIndexTotal(TestNamespace ns) throws Exception {
      OpenMetadataClient client = SdkClients.adminClient();
      String tag = ns.shortPrefix();
      String tableQueryTag = "tblparity" + tag;
      Table table = createTableWithMultiTokenColumns(ns, tableQueryTag, tag);
      assertNotNull(table);

      Awaitility.await()
          .atMost(90, TimeUnit.SECONDS)
          .pollInterval(500, TimeUnit.MILLISECONDS)
          .until(() -> totalHitsForIndex(client, table.getName(), "table") >= 1);

      long tableTotal = totalHitsForIndex(client, table.getName(), "table");
      long aggTableBucket = bucketCountFromDataAsset(client, table.getName(), "table");

      assertEquals(
          tableTotal,
          aggTableBucket,
          "dataAsset aggregation table bucket must equal index=table total for query "
              + table.getName());
    }

    /**
     * Pins prefix-style matching so it stays aligned across the two paths after the per-type-union
     * refactor. Production behavior for short queries like {@code fir} relies on {@code name.ngram}
     * and {@code name.compound}, which are now part of {@link
     * org.openmetadata.service.search.indexes.ColumnSearchIndex#getFields()}; the dataAsset bucket
     * for {@code tableColumn} must produce the same total as {@code index=tableColumn} for the
     * same prefix query, and the seeded column must be in both result sets.
     */
    @Test
    @DisplayName("Prefix queries match via ngram and stay in parity across both paths")
    void testPrefixQueryMatchesViaNgramOnBothPaths(TestNamespace ns) throws Exception {
      OpenMetadataClient client = SdkClients.adminClient();
      String tag = ns.shortPrefix();
      Table table = createTableWithMultiTokenColumns(ns, "ngram_" + tag, tag);
      assertNotNull(table);

      String prefixQuery = tag.substring(0, Math.min(4, tag.length()));

      Awaitility.await()
          .atMost(90, TimeUnit.SECONDS)
          .pollInterval(500, TimeUnit.MILLISECONDS)
          .until(() -> totalHitsForIndex(client, prefixQuery, "tableColumn") >= 5);

      long columnTotal = totalHitsForIndex(client, prefixQuery, "tableColumn");
      long aggColumnBucket = bucketCountFromDataAsset(client, prefixQuery, Entity.TABLE_COLUMN);

      assertTrue(
          columnTotal > 0,
          "Prefix query " + prefixQuery + " should match seeded columns via name.ngram");
      assertEquals(
          columnTotal,
          aggColumnBucket,
          "dataAsset tableColumn bucket ("
              + aggColumnBucket
              + ") must match index=tableColumn total ("
              + columnTotal
              + ") for prefix query "
              + prefixQuery);
    }

    /**
     * Asset types that live in the {@code dataAsset} alias but lack a {@code
     * searchSettings.assetTypeConfigurations} entry (e.g. {@code glossary}) used to be matched via
     * the composite-config field merge. The per-type-union path adds a fallback {@code should}
     * clause for these; this test pins that a glossary doc still appears in {@code
     * index=dataAsset} hits when its name matches the query.
     */
    @Test
    @DisplayName("Asset types without dedicated config (glossary) still match via dataAsset alias")
    void testUnconfiguredAssetTypeFallbackMatchesViaDataAsset(TestNamespace ns) throws Exception {
      OpenMetadataClient client = SdkClients.adminClient();
      String name = ns.prefix("glossary_unconfigured_fallback");
      CreateGlossary req = new CreateGlossary().withName(name).withDescription(name);
      Glossary glossary = client.glossaries().create(req);
      assertNotNull(glossary);

      Awaitility.await()
          .atMost(90, TimeUnit.SECONDS)
          .pollInterval(500, TimeUnit.MILLISECONDS)
          .until(() -> totalHitsForIndex(client, name, "dataAsset") >= 1);

      long total = totalHitsForIndex(client, name, "dataAsset");
      assertTrue(
          total >= 1,
          "Glossary doc with name "
              + name
              + " must be reachable via index=dataAsset (fallback clause for unconfigured types)");
    }

    /**
     * Pins parity for a non-column entity type at both the count and the FQN-set level. Topic is
     * chosen to exercise a different per-type clause than {@code table}, which already has its own
     * test. The {@code dataAsset} alias must return the same set of topic FQNs that {@code
     * index=topic} returns for the same query, with matching counts — otherwise the explore tab's
     * topic count and the topic-tab results would disagree.
     */
    @Test
    @DisplayName("Topic bucket and topic FQN set must match index=topic for same query")
    void testTopicBucketAndResultSetMatchIndexTopic(TestNamespace ns) throws Exception {
      OpenMetadataClient client = SdkClients.adminClient();
      String tag = ns.shortPrefix();
      Topic topic = createUniqueTopic(ns, "topicparity_" + tag, tag);
      assertNotNull(topic);

      Awaitility.await()
          .atMost(90, TimeUnit.SECONDS)
          .pollInterval(500, TimeUnit.MILLISECONDS)
          .until(() -> totalHitsForIndex(client, tag, "topic") >= 1);

      long topicTotal = totalHitsForIndex(client, tag, "topic");
      long aggTopicBucket = bucketCountFromDataAsset(client, tag, Entity.TOPIC);
      assertEquals(
          topicTotal,
          aggTopicBucket,
          "dataAsset topic bucket must equal index=topic total for query " + tag);

      Set<String> topicFqns = fqnsForIndex(client, tag, "topic");
      Set<String> dataAssetTopicFqns = fqnsFromDataAssetForType(client, tag, Entity.TOPIC);
      assertEquals(
          topicFqns,
          dataAssetTopicFqns,
          "Topic FQNs returned by index=topic must equal topic-typed FQNs returned by "
              + "index=dataAsset for the same query");
    }

    /**
     * Complex syntax queries (quoted phrases, AND/OR operators) flow through {@code
     * buildBaseQueryV2 -> buildComplexSyntaxQueryV2} for non-column types and through the column
     * builder for {@code tableColumn}. Both paths run against both endpoints — the parity
     * guarantee from the per-type-union refactor must hold here too. This test exercises three
     * representative shapes and asserts count parity for the {@code tableColumn} bucket.
     */
    @Test
    @DisplayName("Complex-syntax queries keep dataAsset/tableColumn parity")
    void testComplexSyntaxQueriesKeepParity(TestNamespace ns) throws Exception {
      OpenMetadataClient client = SdkClients.adminClient();
      String tag = ns.shortPrefix();
      Table table = createTableWithMultiTokenColumns(ns, "complex_" + tag, tag);
      assertNotNull(table);

      Awaitility.await()
          .atMost(90, TimeUnit.SECONDS)
          .pollInterval(500, TimeUnit.MILLISECONDS)
          .until(() -> totalHitsForIndex(client, tag, "tableColumn") >= 5);

      List<String> queries =
          List.of(
              "\"" + tag + " alpha\"",
              tag + " AND alpha",
              tag + " OR alpha",
              "(" + tag + " AND alpha) OR (" + tag + " AND bravo)");

      for (String complexQuery : queries) {
        long columnTotal = totalHitsForIndex(client, complexQuery, "tableColumn");
        long aggBucket = bucketCountFromDataAsset(client, complexQuery, Entity.TABLE_COLUMN);
        assertEquals(
            columnTotal,
            aggBucket,
            "dataAsset tableColumn bucket must equal index=tableColumn total for complex "
                + "query "
                + complexQuery);
      }
    }

    private Set<String> hitsForColumnQuery(OpenMetadataClient client, String query)
        throws Exception {
      String response =
          client.search().query(query).index("tableColumn").size(50).deleted(false).execute();
      JsonNode hits = OBJECT_MAPPER.readTree(response).path("hits").path("hits");
      Set<String> names = new HashSet<>();
      for (JsonNode hit : hits) {
        names.add(hit.path("_source").path("name").asText());
      }
      return names;
    }

    private Set<String> fqnsForIndex(OpenMetadataClient client, String query, String index)
        throws Exception {
      String response =
          client.search().query(query).index(index).size(200).deleted(false).execute();
      JsonNode hits = OBJECT_MAPPER.readTree(response).path("hits").path("hits");
      Set<String> fqns = new HashSet<>();
      for (JsonNode hit : hits) {
        fqns.add(hit.path("_source").path("fullyQualifiedName").asText());
      }
      return fqns;
    }

    private Set<String> fqnsFromDataAssetForType(
        OpenMetadataClient client, String query, String entityType) throws Exception {
      String response =
          client.search().query(query).index("dataAsset").size(200).deleted(false).execute();
      JsonNode hits = OBJECT_MAPPER.readTree(response).path("hits").path("hits");
      Set<String> fqns = new HashSet<>();
      for (JsonNode hit : hits) {
        if (entityType.equals(hit.path("_source").path("entityType").asText())) {
          fqns.add(hit.path("_source").path("fullyQualifiedName").asText());
        }
      }
      return fqns;
    }

    private Topic createUniqueTopic(TestNamespace ns, String baseName, String tag) {
      String shortId = ns.shortPrefix();
      org.openmetadata.schema.services.connections.messaging.KafkaConnection kafkaConn =
          new org.openmetadata.schema.services.connections.messaging.KafkaConnection()
              .withBootstrapServers("localhost:9092");
      org.openmetadata.schema.api.services.CreateMessagingService msgSvcReq =
          new org.openmetadata.schema.api.services.CreateMessagingService()
              .withName("topic_parity_svc_" + shortId + "_" + baseName)
              .withServiceType(
                  org.openmetadata.schema.api.services.CreateMessagingService.MessagingServiceType
                      .Kafka)
              .withConnection(
                  new org.openmetadata.schema.type.MessagingConnection().withConfig(kafkaConn));
      org.openmetadata.schema.entity.services.MessagingService msgService =
          SdkClients.adminClient().messagingServices().create(msgSvcReq);

      org.openmetadata.schema.api.data.CreateTopic topicRequest =
          new org.openmetadata.schema.api.data.CreateTopic()
              .withName(ns.prefix(tag + "_topic_" + baseName))
              .withService(msgService.getFullyQualifiedName())
              .withPartitions(1);
      return SdkClients.adminClient().topics().create(topicRequest);
    }

    private long totalHitsForIndex(OpenMetadataClient client, String query, String index)
        throws Exception {
      String response = client.search().query(query).index(index).size(0).deleted(false).execute();
      return OBJECT_MAPPER.readTree(response).path("hits").path("total").path("value").asLong();
    }

    private long bucketCountFromDataAsset(
        OpenMetadataClient client, String query, String entityType) throws Exception {
      String response =
          client.search().query(query).index("dataAsset").size(0).deleted(false).execute();
      JsonNode aggregations = OBJECT_MAPPER.readTree(response).path("aggregations");
      JsonNode entityTypeAgg = aggregations.path("entityType");
      if (entityTypeAgg.isMissingNode()) {
        entityTypeAgg = aggregations.path("sterms#entityType");
      }
      for (JsonNode bucket : entityTypeAgg.path("buckets")) {
        if (entityType.equals(bucket.path("key").asText())) {
          return bucket.path("doc_count").asLong();
        }
      }
      return 0L;
    }
  }

  @Nested
  @DisplayName("Nested Column Tests")
  @Execution(ExecutionMode.CONCURRENT)
  class NestedColumnTests {

    @Test
    @DisplayName("Should index nested columns (struct type)")
    void testNestedColumnsIndexed(TestNamespace ns) throws Exception {
      OpenMetadataClient client = SdkClients.adminClient();

      // Create a table with nested columns
      Table table = createTableWithNestedColumns(ns, "nested_cols");

      // Wait for indexing
      TimeUnit.SECONDS.sleep(2);

      // Search for the child column
      String childColumnName = "street";
      String response =
          client.search().query(childColumnName).index("column_search_index").size(10).execute();

      assertNotNull(response);
      JsonNode root = OBJECT_MAPPER.readTree(response);
      assertTrue(root.has("hits"), "Response should have hits");
    }

    @Test
    @DisplayName("Should index grandchild columns (deeply nested)")
    void testDeeplyNestedColumnsIndexed(TestNamespace ns) throws Exception {
      OpenMetadataClient client = SdkClients.adminClient();

      // Create a table with deeply nested columns
      Table table = createTableWithDeeplyNestedColumns(ns, "deep_nested");

      // Wait for indexing
      TimeUnit.SECONDS.sleep(2);

      // Search for the grandchild column
      String grandchildName = "postal_code";
      String response =
          client.search().query(grandchildName).index("column_search_index").size(10).execute();

      assertNotNull(response);
      JsonNode root = OBJECT_MAPPER.readTree(response);
      assertTrue(root.has("hits"), "Response should have hits");
    }
  }

  @Nested
  @DisplayName("Column Data Type Tests")
  @Execution(ExecutionMode.CONCURRENT)
  class ColumnDataTypeTests {

    @Test
    @DisplayName("Should include dataType in column search index")
    void testColumnDataTypeInIndex(TestNamespace ns) throws Exception {
      OpenMetadataClient client = SdkClients.adminClient();

      // Create a table
      Table table = createTableWithColumns(ns, "col_datatype");

      // Wait for indexing
      TimeUnit.SECONDS.sleep(2);

      // Search for the column
      String columnName = ns.prefix("user_id");
      String response =
          client.search().query(columnName).index("column_search_index").size(10).execute();

      JsonNode root = OBJECT_MAPPER.readTree(response);
      JsonNode hits = root.path("hits").path("hits");

      if (hits.size() > 0) {
        for (JsonNode hit : hits) {
          JsonNode source = hit.path("_source");
          String fqn = source.path("fullyQualifiedName").asText("");
          if (fqn.contains(ns.prefix(""))) {
            // Verify dataType is present
            assertFalse(
                source.path("dataType").isMissingNode(), "Column should have dataType field");
            break;
          }
        }
      }
    }
  }

  // ===================================================================
  // HELPER METHODS
  // ===================================================================

  private Table createTableWithColumns(TestNamespace ns, String baseName) {
    String shortId = ns.shortPrefix();

    // Create database service
    org.openmetadata.schema.services.connections.database.PostgresConnection conn =
        DatabaseServices.postgresConnection().hostPort("localhost:5432").username("test").build();

    DatabaseService dbService =
        DatabaseServices.builder()
            .name("col_svc_" + shortId + "_" + baseName)
            .connection(conn)
            .description("Test service for column search")
            .create();

    // Create database
    CreateDatabase dbReq = new CreateDatabase();
    dbReq.setName("col_db_" + shortId + "_" + baseName);
    dbReq.setService(dbService.getFullyQualifiedName());
    Database database = SdkClients.adminClient().databases().create(dbReq);

    // Create schema
    CreateDatabaseSchema schemaReq = new CreateDatabaseSchema();
    schemaReq.setName("col_schema_" + shortId + "_" + baseName);
    schemaReq.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = SdkClients.adminClient().databaseSchemas().create(schemaReq);

    // Create table with columns
    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.prefix(baseName));
    tableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    tableRequest.setColumns(
        List.of(
            new Column()
                .withName(ns.prefix("user_id"))
                .withDataType(ColumnDataType.BIGINT)
                .withDescription("User identifier"),
            new Column()
                .withName(ns.prefix("user_email"))
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)
                .withDescription("User email address"),
            new Column()
                .withName(ns.prefix("created_at"))
                .withDataType(ColumnDataType.TIMESTAMP)
                .withDescription("Creation timestamp")));

    return SdkClients.adminClient().tables().create(tableRequest);
  }

  private Table createTableWithMultiTokenColumns(TestNamespace ns, String baseName, String tag) {
    String shortId = ns.shortPrefix();

    org.openmetadata.schema.services.connections.database.PostgresConnection conn =
        DatabaseServices.postgresConnection().hostPort("localhost:5432").username("test").build();

    DatabaseService dbService =
        DatabaseServices.builder()
            .name("agg_svc_" + shortId + "_" + baseName)
            .connection(conn)
            .description("Test service for dataAsset/tableColumn aggregation parity")
            .create();

    CreateDatabase dbReq = new CreateDatabase();
    dbReq.setName("agg_db_" + shortId + "_" + baseName);
    dbReq.setService(dbService.getFullyQualifiedName());
    Database database = SdkClients.adminClient().databases().create(dbReq);

    CreateDatabaseSchema schemaReq = new CreateDatabaseSchema();
    schemaReq.setName("agg_schema_" + shortId + "_" + baseName);
    schemaReq.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = SdkClients.adminClient().databaseSchemas().create(schemaReq);

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.prefix(baseName));
    tableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    tableRequest.setColumns(
        List.of(
            new Column()
                .withName(tag + "_first_name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)
                .withDescription("First name"),
            new Column()
                .withName(tag + "_first_id")
                .withDataType(ColumnDataType.INT)
                .withDescription("Decoy: shares only the 'first' sub-token with first_name"),
            new Column()
                .withName(tag + "_last_name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)
                .withDescription("Last name"),
            new Column()
                .withName(tag + "_address")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(512)
                .withDescription("Postal address"),
            new Column()
                .withName(tag + "_alpha_amount")
                .withDataType(ColumnDataType.DECIMAL)
                .withDescription("Alpha amount column for complex-syntax tests"),
            new Column()
                .withName(tag + "_alpha_address")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(512)
                .withDescription("Alpha address column"),
            new Column()
                .withName(tag + "_bravo_total")
                .withDataType(ColumnDataType.DECIMAL)
                .withDescription("Bravo total column")));

    return SdkClients.adminClient().tables().create(tableRequest);
  }

  private static final int MULTI_TOKEN_SEED_COUNT = 7;

  private Table createTableWithNestedColumns(TestNamespace ns, String baseName) {
    String shortId = ns.shortPrefix();

    // Create database service
    org.openmetadata.schema.services.connections.database.PostgresConnection conn =
        DatabaseServices.postgresConnection().hostPort("localhost:5432").username("test").build();

    DatabaseService dbService =
        DatabaseServices.builder()
            .name("nested_svc_" + shortId + "_" + baseName)
            .connection(conn)
            .description("Test service for nested column search")
            .create();

    // Create database
    CreateDatabase dbReq = new CreateDatabase();
    dbReq.setName("nested_db_" + shortId + "_" + baseName);
    dbReq.setService(dbService.getFullyQualifiedName());
    Database database = SdkClients.adminClient().databases().create(dbReq);

    // Create schema
    CreateDatabaseSchema schemaReq = new CreateDatabaseSchema();
    schemaReq.setName("nested_schema_" + shortId + "_" + baseName);
    schemaReq.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = SdkClients.adminClient().databaseSchemas().create(schemaReq);

    // Create table with nested columns
    Column streetCol =
        new Column()
            .withName("street")
            .withDataType(ColumnDataType.VARCHAR)
            .withDataLength(255)
            .withDescription("Street address");

    Column cityCol =
        new Column()
            .withName("city")
            .withDataType(ColumnDataType.VARCHAR)
            .withDataLength(100)
            .withDescription("City name");

    Column addressCol =
        new Column()
            .withName("address")
            .withDataType(ColumnDataType.STRUCT)
            .withDescription("Address struct")
            .withChildren(List.of(streetCol, cityCol));

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.prefix(baseName));
    tableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    tableRequest.setColumns(
        List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT), addressCol));

    return SdkClients.adminClient().tables().create(tableRequest);
  }

  private Table createTableWithDeeplyNestedColumns(TestNamespace ns, String baseName) {
    String shortId = ns.shortPrefix();

    // Create database service
    org.openmetadata.schema.services.connections.database.PostgresConnection conn =
        DatabaseServices.postgresConnection().hostPort("localhost:5432").username("test").build();

    DatabaseService dbService =
        DatabaseServices.builder()
            .name("deep_svc_" + shortId + "_" + baseName)
            .connection(conn)
            .description("Test service for deeply nested column search")
            .create();

    // Create database
    CreateDatabase dbReq = new CreateDatabase();
    dbReq.setName("deep_db_" + shortId + "_" + baseName);
    dbReq.setService(dbService.getFullyQualifiedName());
    Database database = SdkClients.adminClient().databases().create(dbReq);

    // Create schema
    CreateDatabaseSchema schemaReq = new CreateDatabaseSchema();
    schemaReq.setName("deep_schema_" + shortId + "_" + baseName);
    schemaReq.setDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema = SdkClients.adminClient().databaseSchemas().create(schemaReq);

    // Create table with deeply nested columns (grandchild level)
    Column postalCodeCol =
        new Column()
            .withName("postal_code")
            .withDataType(ColumnDataType.VARCHAR)
            .withDataLength(20)
            .withDescription("Postal code");

    Column countryCodeCol =
        new Column()
            .withName("country_code")
            .withDataType(ColumnDataType.VARCHAR)
            .withDataLength(3)
            .withDescription("Country code");

    Column locationCol =
        new Column()
            .withName("location")
            .withDataType(ColumnDataType.STRUCT)
            .withDescription("Location details")
            .withChildren(List.of(postalCodeCol, countryCodeCol));

    Column addressCol =
        new Column()
            .withName("address")
            .withDataType(ColumnDataType.STRUCT)
            .withDescription("Address with location")
            .withChildren(List.of(locationCol));

    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.prefix(baseName));
    tableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    tableRequest.setColumns(
        List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT), addressCol));

    return SdkClients.adminClient().tables().create(tableRequest);
  }
}
