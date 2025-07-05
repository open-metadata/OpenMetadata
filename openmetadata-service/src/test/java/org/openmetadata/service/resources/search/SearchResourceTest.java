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
import static org.junit.jupiter.api.Assertions.assertFalse;
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
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
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
import org.openmetadata.service.resources.dashboards.DashboardResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.glossary.GlossaryResourceTest;
import org.openmetadata.service.resources.glossary.GlossaryTermResourceTest;
import org.openmetadata.service.resources.topics.TopicResourceTest;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class SearchResourceTest extends OpenMetadataApplicationTest {

  private Table testTableWithManyColumns;
  private Topic testTopicWithManyFields;
  private Dashboard testDashboard;
  private Glossary testGlossary;
  private GlossaryTerm testGlossaryTerm;
  private TableResourceTest tableResourceTest;
  private TopicResourceTest topicResourceTest;
  private DashboardResourceTest dashboardResourceTest;
  private GlossaryResourceTest glossaryResourceTest;
  private GlossaryTermResourceTest glossaryTermResourceTest;
  private static final ObjectMapper objectMapper = new ObjectMapper();

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    tableResourceTest = new TableResourceTest();
    topicResourceTest = new TopicResourceTest();
    dashboardResourceTest = new DashboardResourceTest();
    glossaryResourceTest = new GlossaryResourceTest();
    glossaryTermResourceTest = new GlossaryTermResourceTest();

    try {
      tableResourceTest.setup(test);
      topicResourceTest.setup(test);
      dashboardResourceTest.setup(test);
      glossaryResourceTest.setup(test);
      glossaryTermResourceTest.setup(test);
    } catch (Exception e) {
      LOG.warn("Some entities already exist - continuing with test execution");
    }
  }

  @Test
  public void testLongTableNameWithManyColumnsDoesNotCauseClauseExplosion()
      throws IOException, InterruptedException {
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
  public void testSpecialCharacterSearchQueries() throws IOException, InterruptedException {
    // Test characters that are safe for URL parameters first
    // Note: We don't escape '*' and ':' as they're part of valid Lucene syntax
    String[] urlSafeSpecialCharacters = {"!", "(", ")", "^", "~"};

    for (String specialChar : urlSafeSpecialCharacters) {
      String searchQueryWithSpecialChar = "table" + specialChar + "test";

      assertDoesNotThrow(
          () -> {
            Response response = searchWithQuery(searchQueryWithSpecialChar, "table_search_index");
            assertTrue(
                response.getStatus() == 200,
                "Search query with special character '" + specialChar + "' should succeed");

            String responseBody = (String) response.getEntity();
            assertNotNull(responseBody);
          },
          "Search should not throw exception for special character in query: " + specialChar);
    }
  }

  @Test
  public void testUrlEncodingRequiredSpecialCharacters() throws IOException, InterruptedException {
    // Test characters that require URL encoding - focus on verifying no Elasticsearch exceptions
    String[] urlEncodingRequiredChars = {"&", "{", "}", "[", "]", "\"", "\\", "/"};

    for (String specialChar : urlEncodingRequiredChars) {
      String searchQueryWithSpecialChar = "table" + specialChar + "test";

      assertDoesNotThrow(
          () -> {
            Response response =
                searchWithQueryEncoded(searchQueryWithSpecialChar, "table_search_index");
            assertTrue(
                response.getStatus() == 200,
                "Search query with URL-encoded special character '"
                    + specialChar
                    + "' should succeed");

            String responseBody = (String) response.getEntity();
            assertNotNull(responseBody);
          },
          "Search should not throw exception for URL-encoded special character in query: "
              + specialChar);
    }

    // Test specific & character query
    assertDoesNotThrow(
        () -> {
          Response response = searchWithQueryEncoded("data&analytics", "table_search_index");
          assertTrue(response.getStatus() == 200, "Search for 'data&analytics' should succeed");

          String responseBody = (String) response.getEntity();
          assertNotNull(responseBody);
        },
        "Search with & character should work without Elasticsearch exceptions");
  }

  @Test
  public void testSpecialCharacterSearchQueries2() throws IOException, InterruptedException {
    // Test special character queries without creating entities
    // The key test is that these don't throw Elasticsearch exceptions
    String[] searchQueries = {
      "User(Activity)",
      "user!activity",
      "user^data",
      "analytics:purposes",
      "behavior!tracking",
      "Analytics*Dashboard",
      "customer~tracking"
    };

    for (String searchQuery : searchQueries) {
      assertDoesNotThrow(
          () -> {
            Response response = searchWithQuery(searchQuery, "table_search_index");
            assertTrue(
                response.getStatus() == 200, "Search query '" + searchQuery + "' should succeed");

            String responseBody = (String) response.getEntity();
            assertNotNull(responseBody);
          },
          "Search should not throw exception for query: " + searchQuery);
    }
  }

  @Test
  public void testSpecialCharacterSearchInTopicQueries() throws IOException, InterruptedException {
    // Note: '*' and ':' are not escaped as they're part of valid Lucene syntax
    String[] specialCharacters = {"&", "!", "(", ")", "^", "~"};

    for (String specialChar : specialCharacters) {
      String searchQueryWithSpecialChar = "topic" + specialChar + "search";

      assertDoesNotThrow(
          () -> {
            Response response = searchWithQuery(searchQueryWithSpecialChar, "topic_search_index");
            assertTrue(
                response.getStatus() == 200,
                "Search query with special character '" + specialChar + "' should succeed");

            String responseBody = (String) response.getEntity();
            assertNotNull(responseBody);
          },
          "Topic search should not throw exception for special character in query: " + specialChar);
    }
  }

  @Test
  public void testSpecialCharacterSearchInDashboards() throws IOException, InterruptedException {
    // Create dashboards with special characters in display names and descriptions
    CreateDashboard createDashboard1 =
        dashboardResourceTest
            .createRequest("testDashboardSpecial1_" + System.currentTimeMillis())
            .withDisplayName("Sales&Marketing!Dashboard")
            .withDescription("Dashboard for sales(revenue) and marketing*campaigns analysis");

    CreateDashboard createDashboard2 =
        dashboardResourceTest
            .createRequest("testDashboardSpecial2_" + System.currentTimeMillis())
            .withDisplayName("Customer^Analytics:Dashboard")
            .withDescription("Analytics~dashboard with customer[behavior] tracking");

    Dashboard dashboard1 = dashboardResourceTest.createEntity(createDashboard1, ADMIN_AUTH_HEADERS);
    Dashboard dashboard2 = dashboardResourceTest.createEntity(createDashboard2, ADMIN_AUTH_HEADERS);
    assertNotNull(dashboard1);
    assertNotNull(dashboard2);

    Thread.sleep(3000);

    // Test special character queries
    String[] searchQueries = {
      "Sales&Marketing",
      "sales(revenue)",
      "marketing*campaigns",
      "Customer^Analytics",
      "Analytics~dashboard",
      "customer[behavior]"
    };

    for (String searchQuery : searchQueries) {
      assertDoesNotThrow(
          () -> {
            Response response = searchWithQuery(searchQuery, "dashboard_search_index");
            assertTrue(
                response.getStatus() == 200, "Search query '" + searchQuery + "' should succeed");

            String responseBody = (String) response.getEntity();
            assertNotNull(responseBody);
          },
          "Dashboard search should not throw exception for query: " + searchQuery);
    }
  }

  @Test
  public void testSpecialCharacterSearchInGlossaries() throws IOException, InterruptedException {
    // Create glossaries with special characters in display names and descriptions
    CreateGlossary createGlossary1 =
        glossaryResourceTest
            .createRequest("testGlossarySpecial1_" + System.currentTimeMillis())
            .withDisplayName("Business&Technical!Glossary")
            .withDescription("Glossary containing business(terms) and technical*definitions");

    CreateGlossary createGlossary2 =
        glossaryResourceTest
            .createRequest("testGlossarySpecial2_" + System.currentTimeMillis())
            .withDisplayName("Data^Governance:Glossary")
            .withDescription("Governance~glossary with compliance[rules] and policies");

    Glossary glossary1 = glossaryResourceTest.createEntity(createGlossary1, ADMIN_AUTH_HEADERS);
    Glossary glossary2 = glossaryResourceTest.createEntity(createGlossary2, ADMIN_AUTH_HEADERS);
    assertNotNull(glossary1);
    assertNotNull(glossary2);

    Thread.sleep(3000);

    // Test special character queries
    String[] searchQueries = {
      "Business&Technical",
      "business(terms)",
      "technical*definitions",
      "Data^Governance",
      "Governance~glossary",
      "compliance[rules]"
    };

    for (String searchQuery : searchQueries) {
      assertDoesNotThrow(
          () -> {
            Response response = searchWithQuery(searchQuery, "glossary_search_index");
            assertTrue(
                response.getStatus() == 200, "Search query '" + searchQuery + "' should succeed");

            String responseBody = (String) response.getEntity();
            assertNotNull(responseBody);
          },
          "Glossary search should not throw exception for query: " + searchQuery);
    }
  }

  @Test
  public void testSpecialCharacterSearchInGlossaryTerms() throws IOException, InterruptedException {
    // Create a parent glossary first
    CreateGlossary createGlossary =
        glossaryResourceTest
            .createRequest("testGlossaryForTerms_" + System.currentTimeMillis())
            .withDisplayName("Parent Glossary");

    Glossary parentGlossary = glossaryResourceTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);
    assertNotNull(parentGlossary);

    // Create glossary terms with special characters
    CreateGlossaryTerm createTerm1 =
        glossaryTermResourceTest
            .createRequest("testTermSpecial1_" + System.currentTimeMillis())
            .withDisplayName("Revenue&Profit!Metrics")
            .withDescription("Financial metrics for revenue(gross) and profit*margins")
            .withGlossary(parentGlossary.getName())
            .withSynonyms(null)
            .withRelatedTerms(null);

    CreateGlossaryTerm createTerm2 =
        glossaryTermResourceTest
            .createRequest("testTermSpecial2_" + System.currentTimeMillis())
            .withDisplayName("Customer^Satisfaction:Index")
            .withDescription("Index~measuring customer[experience] and satisfaction")
            .withGlossary(parentGlossary.getName())
            .withSynonyms(null)
            .withRelatedTerms(null);

    GlossaryTerm term1 = glossaryTermResourceTest.createEntity(createTerm1, ADMIN_AUTH_HEADERS);
    GlossaryTerm term2 = glossaryTermResourceTest.createEntity(createTerm2, ADMIN_AUTH_HEADERS);
    assertNotNull(term1);
    assertNotNull(term2);

    Thread.sleep(3000);

    // Test special character queries
    String[] searchQueries = {
      "Revenue&Profit",
      "revenue(gross)",
      "profit*margins",
      "Customer^Satisfaction",
      "Index~measuring",
      "customer[experience]"
    };

    for (String searchQuery : searchQueries) {
      assertDoesNotThrow(
          () -> {
            Response response = searchWithQuery(searchQuery, "glossary_term_search_index");
            assertTrue(
                response.getStatus() == 200, "Search query '" + searchQuery + "' should succeed");

            String responseBody = (String) response.getEntity();
            assertNotNull(responseBody);
          },
          "Glossary term search should not throw exception for query: " + searchQuery);
    }
  }

  @Test
  public void testParenthesesAsIndividualCharacters() throws IOException, InterruptedException {
    assertDoesNotThrow(
        () -> {
          Response response1 = searchWithQuery("test(search", "table_search_index");
          Response response2 = searchWithQuery("test)search", "table_search_index");

          assertTrue(response1.getStatus() == 200, "Search for '(' should succeed");
          assertTrue(response2.getStatus() == 200, "Search for ')' should succeed");
        },
        "Search should handle individual parentheses correctly");
  }

  @Test
  public void testValidLuceneSyntaxIsNotEscaped() throws IOException, InterruptedException {
    // Test that valid Lucene syntax with * and : works correctly
    String[] luceneQueries = {
      "*", // Match all wildcard
      "*test*", // Wildcard search
      "name:*", // Field with wildcard
      "displayName:test*", // Field with wildcard suffix
      "name:aaron AND isAdmin:false", // Field queries with boolean
      "email.keyword:test@example.com" // Field query with special chars
    };

    for (String luceneQuery : luceneQueries) {
      assertDoesNotThrow(
          () -> {
            Response response = searchWithQuery(luceneQuery, "table_search_index");
            assertTrue(
                response.getStatus() == 200, "Lucene query '" + luceneQuery + "' should succeed");

            String responseBody = (String) response.getEntity();
            assertNotNull(responseBody);
          },
          "Valid Lucene syntax should work without escaping: " + luceneQuery);
    }
  }

  @Test
  public void testUserSearchWithFieldQueries() throws IOException, InterruptedException {
    // Test the specific use case from the feedback - searching users with field queries
    String[] userSearchQueries = {
      "*aaron* AND isAdmin:false AND isBot:false", // Wildcard with field queries
      "email.keyword:random.user.es@getcollate.io", // Email field query
      "name:john OR name:jane", // OR query with fields
      "teams.keyword:DataEngineering", // Nested field query
      "isAdmin:true", // Boolean field query
      "*@example.com AND isBot:false" // Wildcard email with field query
    };

    for (String userQuery : userSearchQueries) {
      assertDoesNotThrow(
          () -> {
            // Test on user index
            Response response = searchWithQuery(userQuery, "user_search_index");
            assertTrue(
                response.getStatus() == 200,
                "User search query '" + userQuery + "' should succeed");

            String responseBody = (String) response.getEntity();
            assertNotNull(responseBody);

            // Verify the query doesn't have escaped colons (field queries should work)
            assertFalse(
                responseBody.contains("\\:"), "Colon in field queries should not be escaped");
          },
          "User field queries should work correctly: " + userQuery);
    }
  }

  @Test
  public void testProblematicCharactersAreEscaped() throws IOException, InterruptedException {
    // Test that characters that cause Elasticsearch exceptions are properly escaped
    // Some characters need URL encoding to avoid Jersey template parsing issues
    String[][] problematicCharsWithEncodingNeeded = {
      {"!", "false"},
      {"(", "false"},
      {")", "false"},
      {"^", "false"},
      {"~", "false"},
      {"\"", "true"},
      {"\\", "true"},
      {"/", "true"},
      {"+", "false"},
      {"-", "false"},
      {"=", "false"},
      {"&&", "true"},
      {"||", "false"},
      {">", "false"},
      {"<", "false"},
      {"{", "true"},
      {"}", "true"},
      {"[", "true"},
      {"]", "true"},
      {"?", "false"},
      {"|", "false"}
    };

    for (String[] charInfo : problematicCharsWithEncodingNeeded) {
      String problemChar = charInfo[0];
      boolean needsEncoding = Boolean.parseBoolean(charInfo[1]);
      String searchQueryWithProblematicChar = "test" + problemChar + "search";

      assertDoesNotThrow(
          () -> {
            Response response;
            if (needsEncoding) {
              response =
                  searchWithQueryEncoded(searchQueryWithProblematicChar, "table_search_index");
            } else {
              response = searchWithQuery(searchQueryWithProblematicChar, "table_search_index");
            }
            assertTrue(
                response.getStatus() == 200,
                "Search query with problematic character '"
                    + problemChar
                    + "' should succeed after escaping");

            String responseBody = (String) response.getEntity();
            assertNotNull(responseBody);
          },
          "Problematic characters should be escaped and not throw Elasticsearch exceptions: "
              + problemChar);
    }
  }

  @Test
  public void testEmptyQueryReturnsResults() throws IOException, InterruptedException {
    // Test that empty queries return results for different indexes
    String[] indexes = {
      "dataAsset", "all", "table_search_index", "dashboard_search_index", "topic_search_index"
    };

    for (String index : indexes) {
      assertDoesNotThrow(
          () -> {
            Response response = searchWithQuery("", index);
            assertTrue(
                response.getStatus() == 200,
                "Empty query search in index '" + index + "' should succeed");

            String responseBody = (String) response.getEntity();
            validateSearchResponse(responseBody, "empty query in index: " + index);
          },
          "Empty query should work without errors for index: " + index);
    }
  }

  @Test
  public void testNullQueryReturnsResults() throws IOException, InterruptedException {
    // Test that null/missing query parameter returns results
    assertDoesNotThrow(
        () -> {
          WebTarget target =
              getResource("search/query")
                  .queryParam("index", "dataAsset")
                  .queryParam("from", 0)
                  .queryParam("size", 10);
          // Note: No 'q' parameter - should be treated as empty/null query

          String result = TestUtils.get(target, String.class, ADMIN_AUTH_HEADERS);
          validateSearchResponse(result, "missing query parameter");
        },
        "Missing query parameter should work without errors");
  }

  @Test
  public void testWildcardQueryReturnsResults() throws IOException, InterruptedException {
    // Test that wildcard (*) query returns results
    String[] indexes = {"dataAsset", "all", "table_search_index"};

    for (String index : indexes) {
      assertDoesNotThrow(
          () -> {
            Response response = searchWithQuery("*", index);
            assertTrue(
                response.getStatus() == 200,
                "Wildcard query search in index '" + index + "' should succeed");

            String responseBody = (String) response.getEntity();
            validateSearchResponse(responseBody, "wildcard query in index: " + index);
          },
          "Wildcard query should work without errors for index: " + index);
    }
  }

  @Test
  public void testEmptyQueryWithDifferentSortFields() throws IOException, InterruptedException {
    // Test empty queries with different sort fields that are commonly used
    String[] sortFields = {"_score", "totalVotes", "updatedAt", "displayName.keyword"};

    for (String sortField : sortFields) {
      assertDoesNotThrow(
          () -> {
            WebTarget target =
                getResource("search/query")
                    .queryParam("q", "")
                    .queryParam("index", "dataAsset")
                    .queryParam("from", 0)
                    .queryParam("size", 10)
                    .queryParam("sort_field", sortField)
                    .queryParam("sort_order", "desc");

            String result = TestUtils.get(target, String.class, ADMIN_AUTH_HEADERS);
            validateSearchResponse(result, "empty query with sort field: " + sortField);
          },
          "Empty query with sort field '" + sortField + "' should work without errors");
    }
  }

  @Test
  public void testEmptyQueryReturnsDataAssets() throws IOException, InterruptedException {
    // This test specifically validates that empty queries return actual data assets
    // First ensure we have some data by checking with a wildcard query
    Response wildcardResponse = searchWithQuery("*", "dataAsset");
    assertTrue(wildcardResponse.getStatus() == 200, "Wildcard query should work");

    String wildcardResponseBody = (String) wildcardResponse.getEntity();
    assertTrue(
        wildcardResponseBody.contains("\"value\":"), "Wildcard query should show total count");

    // Extract total hits from wildcard query using JSON parsing
    int wildcardTotalHits = getTotalHitsFromResponse(wildcardResponseBody);
    assertTrue(
        wildcardTotalHits > 0, "Wildcard query should return results, got: " + wildcardTotalHits);

    // Now test that empty query returns the same or similar results
    Response emptyResponse = searchWithQuery("", "dataAsset");
    assertTrue(emptyResponse.getStatus() == 200, "Empty query should work");

    String emptyResponseBody = (String) emptyResponse.getEntity();
    assertNotNull(emptyResponseBody, "Empty query response should not be null");
    assertTrue(emptyResponseBody.contains("\"hits\""), "Empty query should contain hits");
    assertTrue(emptyResponseBody.contains("\"total\""), "Empty query should contain total");

    // Extract total hits from empty query and verify it's > 0 using JSON parsing
    int emptyTotalHits = getTotalHitsFromResponse(emptyResponseBody);
    assertTrue(emptyTotalHits > 0, "Empty query should return results, got: " + emptyTotalHits);

    // Both should return similar number of results (for match_all behavior)
    assertTrue(emptyResponseBody.length() > 100, "Empty query should return substantial response");

    // Log the comparison for debugging
    System.out.println("Wildcard query returned " + wildcardTotalHits + " hits");
    System.out.println("Empty query returned " + emptyTotalHits + " hits");
  }

  @Test
  public void testSpecialCharacterSearchAcrossAllEntityTypes()
      throws IOException, InterruptedException {
    CreateDashboard createDashboard =
        dashboardResourceTest
            .createRequest("testDashboardAll_" + System.currentTimeMillis())
            .withDisplayName("Analytics&Reporting!Dashboard")
            .withDescription("Dashboard with (complex) metrics*");

    Dashboard dashboard = dashboardResourceTest.createEntity(createDashboard, ADMIN_AUTH_HEADERS);
    assertNotNull(dashboard);

    CreateGlossary createGlossary =
        glossaryResourceTest
            .createRequest("testGlossaryAll_" + System.currentTimeMillis())
            .withDisplayName("Data^Dictionary:Main")
            .withDescription("Dictionary~containing [important] terms");

    Glossary glossary = glossaryResourceTest.createEntity(createGlossary, ADMIN_AUTH_HEADERS);
    assertNotNull(glossary);

    CreateGlossaryTerm createTerm =
        glossaryTermResourceTest
            .createRequest("testTermAll_" + System.currentTimeMillis())
            .withDisplayName("KPI&Metrics!Definition")
            .withDescription("Definition for key(performance) indicators")
            .withGlossary(glossary.getName())
            .withSynonyms(null)
            .withRelatedTerms(null);

    GlossaryTerm term = glossaryTermResourceTest.createEntity(createTerm, ADMIN_AUTH_HEADERS);
    assertNotNull(term);

    Thread.sleep(3000);

    String[] testQueries = {
      "Analytics&Reporting",
      "(complex) metrics",
      "Data^Dictionary",
      "Dictionary~containing",
      "[important] terms",
      "KPI&Metrics",
      "key(performance)"
    };

    String[] indexes = {
      "all", "dashboard_search_index", "glossary_search_index", "glossary_term_search_index"
    };

    for (String query : testQueries) {
      for (String index : indexes) {
        assertDoesNotThrow(
            () -> {
              Response response = searchWithQuery(query, index);
              assertTrue(
                  response.getStatus() == 200,
                  "Search in index '" + index + "' for query '" + query + "' should succeed");

              String responseBody = (String) response.getEntity();
              assertNotNull(responseBody);
            },
            "Search should work for query '" + query + "' in index '" + index + "'");
      }
    }
  }

  private int getTotalHitsFromResponse(String responseBody) throws IOException {
    JsonNode jsonNode = objectMapper.readTree(responseBody);
    JsonNode hitsNode = jsonNode.get("hits");
    if (hitsNode != null) {
      JsonNode totalNode = hitsNode.get("total");
      if (totalNode != null) {
        // Handle both formats: {"value": 123} and direct number 123
        if (totalNode.isObject() && totalNode.has("value")) {
          return totalNode.get("value").asInt();
        } else if (totalNode.isNumber()) {
          return totalNode.asInt();
        }
      }
    }
    return 0;
  }

  private void validateSearchResponse(String responseBody, String context) throws IOException {
    assertNotNull(responseBody, "Response body should not be null for: " + context);
    assertTrue(responseBody.length() > 0, "Response body should not be empty for: " + context);
    JsonNode jsonNode = objectMapper.readTree(responseBody);
    assertTrue(jsonNode.has("hits"), "Response should contain hits section for: " + context);
    assertTrue(
        jsonNode.get("hits").has("total"), "Response should contain total section for: " + context);
    JsonNode totalNode = jsonNode.get("hits").get("total");
    if (totalNode.isObject()) {
      assertTrue(totalNode.has("value"), "Response should contain total value for: " + context);
    } else {
      assertTrue(totalNode.isNumber(), "Response total should be a number for: " + context);
    }
    int totalHits = getTotalHitsFromResponse(responseBody);
    assertTrue(
        totalHits > 0,
        "Total hits should be greater than 0 for: " + context + ", got: " + totalHits);
  }

  private String getEscapedCharName(String specialChar) {
    return switch (specialChar) {
      case "&" -> "amp";
      case "!" -> "excl";
      case "(" -> "oparen";
      case ")" -> "cparen";
      case "{" -> "obrace";
      case "}" -> "cbrace";
      case "[" -> "obrack";
      case "]" -> "cbrack";
      case "^" -> "caret";
      case "\"" -> "quote";
      case "~" -> "tilde";
      case "*" -> "star";
      case ":" -> "colon";
      case "\\" -> "backslash";
      case "/" -> "slash";
      default -> "unknown";
    };
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

  private Response searchWithQueryEncoded(String query, String index) {
    try {
      // Manually URL encode the query to handle special characters
      String encodedQuery = java.net.URLEncoder.encode(query, "UTF-8");
      WebTarget target =
          getResource("search/query")
              .queryParam("q", encodedQuery)
              .queryParam("index", index)
              .queryParam("from", 0)
              .queryParam("size", 10);

      String result = TestUtils.get(target, String.class, ADMIN_AUTH_HEADERS);
      return Response.ok(result).build();
    } catch (Exception e) {
      LOG.error("Error occurred while executing search query: {}", e.getMessage());
      return Response.status(500).entity(e.getMessage()).build();
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
}
